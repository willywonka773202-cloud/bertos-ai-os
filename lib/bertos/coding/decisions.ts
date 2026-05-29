import { makeRuntimeId, nowIso } from '../runtime-store'
import { Collection } from './store'
import { CodingOSError, type DecisionRecord, type DecisionStatus } from './types'

const decisions = new Collection<DecisionRecord & Record<string, unknown>>('decisions.json', 'decisionId')

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map(s => s.trim()).filter(Boolean) : []
}

export interface CreateDecisionInput {
  title: string
  decision: string
  projectId?: string
  context?: string
  alternatives?: string[]
  consequences?: string
  status?: DecisionStatus
  linkedRunIds?: string[]
  linkedOutputIds?: string[]
  linkedTaskIds?: string[]
}

export async function createDecisionRecord(input: CreateDecisionInput): Promise<DecisionRecord> {
  const title = (input.title ?? '').trim()
  const decision = (input.decision ?? '').trim()
  if (!title) throw new CodingOSError('invalid-input', 'Decision title is required.')
  if (!decision) throw new CodingOSError('invalid-input', 'A decision statement is required.')
  const now = nowIso()
  const record: DecisionRecord = {
    decisionId: makeRuntimeId('dec'),
    projectId: input.projectId,
    title,
    context: input.context?.trim() || undefined,
    decision,
    alternatives: list(input.alternatives),
    consequences: input.consequences?.trim() || undefined,
    linkedRunIds: list(input.linkedRunIds),
    linkedOutputIds: list(input.linkedOutputIds),
    linkedTaskIds: list(input.linkedTaskIds),
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'accepted',
  }
  return decisions.insert(record as DecisionRecord & Record<string, unknown>)
}

export async function listDecisionRecords(projectId?: string): Promise<DecisionRecord[]> {
  const all = await decisions.list()
  return projectId ? all.filter(record => record.projectId === projectId) : all
}

export async function getDecisionRecord(decisionId: string): Promise<DecisionRecord | null> {
  return decisions.get(decisionId)
}

export async function updateDecisionRecord(decisionId: string, input: Partial<CreateDecisionInput> & { status?: DecisionStatus }): Promise<DecisionRecord> {
  const existing = await decisions.get(decisionId)
  if (!existing) throw new CodingOSError('not-found', `Decision not found: ${decisionId}`)
  return decisions.update(decisionId, current => ({
    ...current,
    title: input.title?.trim() || current.title,
    decision: input.decision?.trim() || current.decision,
    context: input.context === undefined ? current.context : input.context.trim() || undefined,
    alternatives: input.alternatives === undefined ? current.alternatives : list(input.alternatives),
    consequences: input.consequences === undefined ? current.consequences : input.consequences.trim() || undefined,
    status: input.status ?? current.status,
    updatedAt: nowIso(),
  }))
}

export async function supersedeDecisionRecord(decisionId: string, supersededBy: string): Promise<DecisionRecord> {
  const existing = await decisions.get(decisionId)
  if (!existing) throw new CodingOSError('not-found', `Decision not found: ${decisionId}`)
  return decisions.update(decisionId, current => ({
    ...current,
    status: 'superseded',
    supersededBy,
    updatedAt: nowIso(),
  }))
}
