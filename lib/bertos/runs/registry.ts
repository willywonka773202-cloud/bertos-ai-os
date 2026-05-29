import { mkdir } from 'node:fs/promises'
import { makeRuntimeId, nowIso, readJsonFile, runtimePath, writeJsonFile } from '../runtime-store'
import type { AgentRun, AgentRunEvent, WorkflowRun } from '../workflows/types'

const AGENT_RUNS = runtimePath('agents', 'runs', 'runs.json')
const WORKFLOW_RUNS = runtimePath('workflows', 'runs', 'runs.json')

export async function listAgentRuns(limit = 100) {
  const runs = await readJsonFile<AgentRun[]>(AGENT_RUNS, [])
  return runs.slice(0, limit)
}

export async function listWorkflowRuns(limit = 100) {
  const runs = await readJsonFile<WorkflowRun[]>(WORKFLOW_RUNS, [])
  return runs.slice(0, limit)
}

export async function saveAgentRun(run: AgentRun) {
  await mkdir(runtimePath('agents', 'runs'), { recursive: true })
  const runs = await readJsonFile<AgentRun[]>(AGENT_RUNS, [])
  await writeJsonFile(AGENT_RUNS, [run, ...runs.filter(item => item.agentRunId !== run.agentRunId)])
  return run
}

export async function saveWorkflowRun(run: WorkflowRun) {
  await mkdir(runtimePath('workflows', 'runs'), { recursive: true })
  const runs = await readJsonFile<WorkflowRun[]>(WORKFLOW_RUNS, [])
  await writeJsonFile(WORKFLOW_RUNS, [run, ...runs.filter(item => item.workflowRunId !== run.workflowRunId)])
  return run
}

export function createAgentRun(input: {
  title: string
  skillIds?: string[]
  pluginIds?: string[]
  workflowRunId?: string
  groundingPackIds?: string[]
  lanes?: AgentRun['lanes']
  outputIds?: string[]
  memoryProposalIds?: string[]
  logs?: string[]
  events?: AgentRunEvent[]
}): AgentRun {
  const now = nowIso()
  const createdEvent: AgentRunEvent = {
    eventId: makeRuntimeId('runevent'),
    type: 'created',
    message: `Agent run created: ${input.title}`,
    at: now,
  }
  return {
    agentRunId: makeRuntimeId('agrun'),
    title: input.title,
    status: 'queued',
    skillIds: input.skillIds ?? [],
    pluginIds: input.pluginIds ?? [],
    workflowRunId: input.workflowRunId,
    groundingPackIds: input.groundingPackIds ?? [],
    lanes: input.lanes ?? [],
    outputIds: input.outputIds ?? [],
    memoryProposalIds: input.memoryProposalIds ?? [],
    validationResults: [],
    logs: input.logs ?? [],
    events: [createdEvent, ...(input.events ?? [])],
    checkpoints: [],
    approvals: [],
    mergeSummary: input.lanes?.length ? 'Lane records created; merge summary pending final synthesis.' : undefined,
    createdAt: now,
    updatedAt: now,
  }
}

export async function listRuntimeRuns(limit = 100) {
  const [agentRuns, workflowRuns] = await Promise.all([listAgentRuns(limit), listWorkflowRuns(limit)])
  return { agentRuns, workflowRuns }
}
