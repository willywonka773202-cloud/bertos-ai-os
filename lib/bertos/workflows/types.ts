import type { OutputArtifactType } from '../outputs/types'

export interface AgentRunLane {
  laneId: string
  role: string
  inputContract: string
  outputContract: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout' | 'skipped'
  startedAt?: string
  completedAt?: string
  resultSummary?: string
  outputIds: string[]
  errors: string[]
  mergeSummary?: string
  partialResult?: string
}

export interface AgentRunEvent {
  eventId: string
  type: 'created' | 'lane-started' | 'lane-completed' | 'tool-call' | 'approval-required' | 'validation' | 'error' | 'completed'
  message: string
  at: string
  laneId?: string
  outputId?: string
  metadata?: Record<string, unknown>
}

export interface AgentRunCheckpoint {
  checkpointId: string
  label: string
  at: string
  state: Record<string, unknown>
}

export interface AgentRunApprovalEvent {
  approvalId: string
  action: string
  status: 'required' | 'approved' | 'denied' | 'not-required'
  reason: string
  requestedAt: string
  resolvedAt?: string
  resolvedBy?: string
}

export interface AgentRun {
  agentRunId: string
  title: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'needs-approval'
  skillIds: string[]
  pluginIds: string[]
  workflowRunId?: string
  groundingPackIds: string[]
  lanes: AgentRunLane[]
  outputIds: string[]
  memoryProposalIds: string[]
  validationResults: Array<{ command: string; status: 'passed' | 'failed' | 'skipped'; output?: string }>
  logs: string[]
  events: AgentRunEvent[]
  checkpoints: AgentRunCheckpoint[]
  approvals: AgentRunApprovalEvent[]
  mergeSummary?: string
  partialFailureSummary?: string
  createdAt: string
  updatedAt: string
}

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  trigger: string
  skillChain: string[]
  pluginIds: string[]
  outputTypes: OutputArtifactType[]
  approvalRequired: boolean
}

export interface WorkflowRun {
  workflowRunId: string
  workflowId: string
  title: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'needs-approval'
  input: Record<string, unknown>
  agentRunIds: string[]
  outputIds: string[]
  memoryProposalIds: string[]
  validationReport?: string
  dashboardEvent?: string
  groundingPackIds?: string[]
  runLogIds?: string[]
  approvalSummary?: string
  createdAt: string
  updatedAt: string
}

export interface AutomationCandidate {
  automationCandidateId: string
  sourceRunId: string
  title: string
  status?: 'candidate' | 'enabled' | 'paused' | 'rejected'
  trigger: 'manual' | 'cron' | 'new_source' | 'new_email' | 'new_output'
  schedule?: string
  timezone?: string
  skillChain: string[]
  pluginIds: string[]
  outputDestination: string
  approvalRequired: boolean
  failurePolicy: 'partial_digest' | 'retry' | 'pause'
  createdAt: string
  updatedAt?: string
}
