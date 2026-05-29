import { makeRuntimeId, nowIso } from '../runtime-store'
import { createAgentRun, saveAgentRun, saveWorkflowRun } from '../runs/registry'
import type { AgentRun, AgentRunEvent, AgentRunLane, WorkflowRun } from '../workflows/types'

export interface CodingLaneInput {
  role: string
  status?: AgentRunLane['status']
  summary?: string
  inputContract?: string
  outputContract?: string
  outputIds?: string[]
  errors?: string[]
}

export interface RecordCodingRunInput {
  workflowId: string
  title: string
  objective?: string
  projectSlug?: string
  skillIds?: string[]
  pluginIds?: string[]
  lanes: CodingLaneInput[]
  outputIds?: string[]
  memoryProposalIds?: string[]
  taskIds?: string[]
  commandRunIds?: string[]
  validationResults?: AgentRun['validationResults']
  approvals?: AgentRun['approvals']
  providerName?: string
  llmUsed: boolean
  status?: AgentRun['status']
  error?: string
  logs?: string[]
}

/**
 * Record a coding action as a real AgentRun + WorkflowRun (with lane logs) in the
 * shared run ledger so it appears in /runs alongside Creator OS runs.
 */
export async function recordCodingRun(input: RecordCodingRunInput): Promise<{ workflowRunId: string; agentRunId: string }> {
  const now = nowIso()
  const lanes: AgentRunLane[] = input.lanes.map(lane => ({
    laneId: makeRuntimeId('lane'),
    role: lane.role,
    inputContract: lane.inputContract ?? 'coding-os action',
    outputContract: lane.outputContract ?? 'artifact + ledger record',
    status: lane.status ?? 'completed',
    startedAt: now,
    completedAt: now,
    resultSummary: lane.summary,
    outputIds: lane.outputIds ?? [],
    errors: lane.errors ?? [],
  }))

  const events: AgentRunEvent[] = [
    ...lanes.map<AgentRunEvent>(lane => ({
      eventId: makeRuntimeId('runevent'),
      type: 'lane-completed',
      message: `${lane.role}: ${lane.resultSummary ?? lane.status}`,
      at: now,
      laneId: lane.laneId,
    })),
    {
      eventId: makeRuntimeId('runevent'),
      type: input.error ? 'error' : 'completed',
      message: input.error ?? `Completed ${input.workflowId} (${input.llmUsed ? `provider: ${input.providerName ?? 'configured'}` : 'local deterministic, no LLM'})`,
      at: now,
    },
  ]

  const workflowRunId = makeRuntimeId('wfrun')
  const status: AgentRun['status'] = input.status ?? (input.error ? 'failed' : 'completed')

  const baseRun = createAgentRun({
    title: input.title,
    skillIds: input.skillIds ?? [input.workflowId],
    pluginIds: input.pluginIds ?? [],
    workflowRunId,
    lanes,
    outputIds: input.outputIds ?? [],
    memoryProposalIds: input.memoryProposalIds ?? [],
    events,
    logs: input.logs ?? [],
  })

  const agentRun: AgentRun = {
    ...baseRun,
    status,
    validationResults: input.validationResults ?? [],
    approvals: input.approvals ?? [],
    mergeSummary: input.objective
      ? `${input.objective} — ${lanes.length} lane(s); provider: ${input.llmUsed ? (input.providerName ?? 'configured') : 'local deterministic (no LLM)'}.`
      : baseRun.mergeSummary,
    partialFailureSummary: input.error,
    updatedAt: now,
  }
  await saveAgentRun(agentRun)

  const workflowRun: WorkflowRun = {
    workflowRunId,
    workflowId: input.workflowId,
    title: input.title,
    status,
    input: {
      project: input.projectSlug ?? null,
      objective: input.objective ?? null,
      llmUsed: input.llmUsed,
      provider: input.providerName ?? null,
    },
    agentRunIds: [agentRun.agentRunId],
    outputIds: input.outputIds ?? [],
    memoryProposalIds: input.memoryProposalIds ?? [],
    runLogIds: input.taskIds,
    approvalSummary: input.approvals?.length ? `${input.approvals.length} approval event(s)` : undefined,
    dashboardEvent: `coding:${input.workflowId}`,
    createdAt: now,
    updatedAt: now,
  }
  await saveWorkflowRun(workflowRun)

  return { workflowRunId, agentRunId: agentRun.agentRunId }
}
