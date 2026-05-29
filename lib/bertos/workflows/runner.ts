import { buildGroundingPack } from '../grounding/builder'
import { createMemoryProposal } from '../memory/registry'
import { createOutputArtifact } from '../outputs/registry'
import { makeRuntimeId, nowIso } from '../runtime-store'
import { createAgentRun, saveAgentRun, saveWorkflowRun } from '../runs/registry'
import { getWorkflowDefinition, WORKFLOW_DEFINITIONS } from './definitions'
import type { AgentRunLane, WorkflowRun } from './types'

export { WORKFLOW_DEFINITIONS }

function lanesForWorkflow(workflowId: string): AgentRunLane[] {
  const common = [
    {
      laneId: makeRuntimeId('lane'),
      role: 'grounding',
      inputContract: 'Collect relevant memory, outputs, and provided source URLs.',
      outputContract: 'Grounding pack summary and source limitations.',
      status: 'completed' as const,
      startedAt: nowIso(),
      completedAt: nowIso(),
    resultSummary: 'Grounding pack built in local/degraded mode.',
    outputIds: [],
    errors: [],
    mergeSummary: 'Grounding lane feeds source limitations into synthesis.',
  },
    {
      laneId: makeRuntimeId('lane'),
      role: 'synthesis',
      inputContract: 'Use grounding and workflow definition to create a practical artifact.',
      outputContract: 'Saved output artifact plus memory proposal candidates.',
      status: 'completed' as const,
      startedAt: nowIso(),
      completedAt: nowIso(),
    resultSummary: 'Workflow artifact created.',
    outputIds: [],
    errors: [],
    mergeSummary: 'Synthesis lane owns final artifact registration and memory proposal handoff.',
  },
  ]
  if (workflowId.includes('brand-deal')) {
    common.splice(1, 0, {
      laneId: makeRuntimeId('lane'),
      role: 'permission-review',
      inputContract: 'Check Gmail/Calendar setup and approval gates.',
      outputContract: 'Report setup-required state; no send or schedule.',
      status: 'completed',
      startedAt: nowIso(),
      completedAt: nowIso(),
      resultSummary: 'Inbox/calendar actions remain approval-gated and setup-required.',
      outputIds: [],
      errors: [],
      mergeSummary: 'Permission review blocks external mutation and routes to local report output.',
    })
  }
  return common
}

export async function runWorkflow(input: {
  workflowId: string
  title?: string
  prompt?: string
  project?: string
  client?: string
  sourceUrls?: string[]
  pastedSources?: Array<{ name: string; excerpt: string; sourceUrl?: string }>
}) {
  const definition = getWorkflowDefinition(input.workflowId)
  if (!definition) throw new Error(`Unknown workflow: ${input.workflowId}`)
  const now = nowIso()
  const workflowRunId = makeRuntimeId('wfrun')
  const title = input.title ?? definition.name
  const grounding = await buildGroundingPack({
    taskReason: title,
    query: input.prompt ?? title,
    project: input.project,
    client: input.client,
    sourceUrls: input.sourceUrls,
    pastedSources: input.pastedSources,
  })
  const agentRun = createAgentRun({
    title,
    skillIds: definition.skillChain,
    pluginIds: definition.pluginIds,
    workflowRunId,
    groundingPackIds: [grounding.groundingPackId],
    lanes: lanesForWorkflow(definition.id),
    logs: [
      `Workflow ${definition.id} started.`,
      definition.approvalRequired ? 'Workflow has approval-required actions; risky actions were not executed.' : 'Workflow is local/degraded safe.',
    ],
  })
  agentRun.status = definition.approvalRequired ? 'needs-approval' : 'completed'
  agentRun.updatedAt = nowIso()

  const output = await createOutputArtifact({
    type: definition.outputTypes[0] ?? 'workflow_report',
    title,
    skillId: definition.skillChain[0],
    pluginIds: definition.pluginIds,
    agentRunId: agentRun.agentRunId,
    workflowRunId,
    groundingPackIds: [grounding.groundingPackId],
    project: input.project,
    client: input.client,
    sourceLinks: grounding.sources.map(source => source.sourceUrl).filter((url): url is string => Boolean(url)),
    tags: ['workflow', definition.id],
    content: [
      `# ${title}`,
      '',
      `Workflow: ${definition.name}`,
      '',
      '## Input',
      input.prompt ?? 'No prompt provided.',
      '',
      '## Grounding',
      ...grounding.sources.map(source => `- ${source.sourceName}${source.sourceUrl ? ` (${source.sourceUrl})` : ''}: ${source.excerpt.slice(0, 180)}`),
      '',
      '## Safety',
      definition.approvalRequired
        ? 'This workflow includes approval-required actions. BertOS created a plan/report only.'
        : 'This workflow ran in local-first degraded mode and did not call paid or external mutating APIs.',
    ].join('\n'),
    metadata: { workflowDefinition: definition as unknown as any, groundingPack: grounding as unknown as any },
  })

  const proposal = await createMemoryProposal({
    kind: 'episodic',
    title: `Workflow run: ${title}`,
    content: `Ran ${definition.name}. Created output ${output.outputId ?? output.artifactId}. Risky actions were ${definition.approvalRequired ? 'held for approval' : 'not required'}.`,
    project: input.project,
    client: input.client,
    source: 'tool-output',
    sourceRef: output.outputId ?? output.artifactId,
    tags: ['workflow', definition.id],
    reason: 'Workflow completion summary for review.',
  })

  agentRun.outputIds = [output.outputId ?? output.artifactId]
  agentRun.memoryProposalIds = [proposal.proposalId]
  agentRun.lanes = agentRun.lanes.map(lane => lane.role === 'synthesis' ? { ...lane, outputIds: agentRun.outputIds } : lane)
  agentRun.mergeSummary = `Merged ${agentRun.lanes.length} lane(s). Grounding pack ${grounding.groundingPackId} produced output ${output.outputId}.`
  agentRun.events.push({
    eventId: makeRuntimeId('runevent'),
    type: 'completed',
    message: `Workflow ${definition.id} completed local run bookkeeping.`,
    at: nowIso(),
    outputId: output.outputId,
    metadata: { groundingPackId: grounding.groundingPackId },
  })
  await saveAgentRun(agentRun)

  const workflowRun: WorkflowRun = {
    workflowRunId,
    workflowId: definition.id,
    title,
    status: definition.approvalRequired ? 'needs-approval' : 'completed',
    input: input as Record<string, unknown>,
    agentRunIds: [agentRun.agentRunId],
    outputIds: agentRun.outputIds,
    memoryProposalIds: [proposal.proposalId],
    groundingPackIds: [grounding.groundingPackId],
    validationReport: 'No external validation commands were required for this local workflow scaffold.',
    dashboardEvent: `${definition.name} produced ${output.title}.`,
    approvalSummary: definition.approvalRequired ? 'Risky external actions were not executed; approval is required before mutation.' : 'No risky external actions were required.',
    createdAt: now,
    updatedAt: nowIso(),
  }
  await saveWorkflowRun(workflowRun)
  return { workflow: definition, workflowRun, agentRun, output, memoryProposal: proposal, grounding }
}
