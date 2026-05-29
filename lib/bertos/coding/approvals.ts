import { makeRuntimeId, nowIso } from '../runtime-store'
import { Collection } from './store'
import { redactSensitiveText } from './safety'
import {
  CodingOSError,
  type ApprovalActionType,
  type ApprovalRequest,
  type ApprovalRiskLevel,
  type ApprovalStatus,
} from './types'

const approvals = new Collection<ApprovalRequest & Record<string, unknown>>('approvals.json', 'approvalId')

const RISK_BY_ACTION: Record<ApprovalActionType, ApprovalRiskLevel> = {
  file_deletion: 'high',
  file_overwrite: 'medium',
  patch_apply: 'medium',
  git_commit: 'medium',
  git_push: 'high',
  deploy: 'critical',
  send_email: 'high',
  calendar_event: 'medium',
  publish: 'high',
  paid_api: 'high',
  package_install: 'medium',
  sensitive_file_access: 'critical',
  durable_memory_write: 'medium',
  external_connector: 'high',
  persona_generation: 'high',
  risky_command: 'high',
}

export interface CreateApprovalInput {
  actionType: ApprovalActionType
  title: string
  description?: string
  riskLevel?: ApprovalRiskLevel
  projectId?: string
  requestedByAgentRunId?: string
  payloadSummary?: string
  consequences?: string
  rollbackPlan?: string
  targetRef?: string
  sourceRunId?: string
  sourceOutputId?: string
  requiredBefore?: string
}

export async function createApprovalRequest(input: CreateApprovalInput): Promise<ApprovalRequest> {
  const title = (input.title ?? '').trim()
  if (!title) throw new CodingOSError('invalid-input', 'Approval title is required.')

  const payloadRedaction = input.payloadSummary ? redactSensitiveText(input.payloadSummary) : undefined
  const request: ApprovalRequest = {
    approvalId: makeRuntimeId('appr'),
    actionType: input.actionType,
    title,
    description: input.description?.trim() || undefined,
    riskLevel: input.riskLevel ?? RISK_BY_ACTION[input.actionType] ?? 'medium',
    projectId: input.projectId,
    requestedByAgentRunId: input.requestedByAgentRunId,
    requestedAt: nowIso(),
    status: 'pending',
    requiredBefore: input.requiredBefore,
    payloadSummary: payloadRedaction?.text,
    sensitiveFieldsRedacted: Boolean(payloadRedaction?.redacted),
    consequences: input.consequences?.trim() || undefined,
    rollbackPlan: input.rollbackPlan?.trim() || undefined,
    targetRef: input.targetRef,
    sourceRunId: input.sourceRunId,
    sourceOutputId: input.sourceOutputId,
  }
  return approvals.insert(request as ApprovalRequest & Record<string, unknown>)
}

export async function listApprovalRequests(filter: { projectId?: string; status?: ApprovalStatus } = {}): Promise<ApprovalRequest[]> {
  const all = await approvals.list()
  return all
    .filter(item => !filter.projectId || item.projectId === filter.projectId)
    .filter(item => !filter.status || item.status === filter.status)
}

export async function getApprovalRequest(approvalId: string): Promise<ApprovalRequest | null> {
  return approvals.get(approvalId)
}

export async function approveAction(approvalId: string, note?: string): Promise<ApprovalRequest> {
  return transition(approvalId, 'approved', note)
}

export async function rejectAction(approvalId: string, note?: string): Promise<ApprovalRequest> {
  return transition(approvalId, 'rejected', note)
}

async function transition(approvalId: string, status: ApprovalStatus, note?: string): Promise<ApprovalRequest> {
  const existing = await approvals.get(approvalId)
  if (!existing) throw new CodingOSError('not-found', `Approval not found: ${approvalId}`)
  if (existing.status !== 'pending') {
    throw new CodingOSError('conflict', `Approval is already ${existing.status}.`)
  }
  return approvals.update(approvalId, current => ({
    ...current,
    status,
    approvedAt: status === 'approved' ? nowIso() : current.approvedAt,
    rejectedAt: status === 'rejected' ? nowIso() : current.rejectedAt,
    decisionNote: note?.trim() || current.decisionNote,
  }))
}

/** Returns true only if there is an APPROVED approval matching the target. */
export async function isApprovedFor(targetRef: string, actionType: ApprovalActionType): Promise<boolean> {
  const all = await approvals.all()
  return all.some(item => item.targetRef === targetRef && item.actionType === actionType && item.status === 'approved')
}

export async function explainApprovalRequirement(actionType: ApprovalActionType): Promise<string> {
  const map: Partial<Record<ApprovalActionType, string>> = {
    patch_apply: 'Applying a patch writes to real files. BertOS requires explicit approval first and keeps version-safe backups.',
    git_push: 'Pushing changes the remote. This is never automatic in BertOS.',
    file_deletion: 'Deleting files is irreversible without a backup, so it is gated behind approval.',
    deploy: 'Deploys affect production and require explicit approval.',
    paid_api: 'Paid APIs cost money; BertOS gates them behind approval with a visible budget.',
    durable_memory_write: 'Durable memory writes are reviewed so secrets and noise never get stored.',
  }
  return map[actionType] ?? `${actionType} is a guarded action and requires explicit approval.`
}
