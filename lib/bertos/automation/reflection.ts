import { createMemoryProposal, listMemoryProposals } from '../memory/registry'
import { createOutputArtifact, listOutputArtifacts } from '../outputs/registry'
import { listRuntimeRuns } from '../runs/registry'

export type ReflectionCadence = 'daily' | 'weekly'

export async function runReflection(input: {
  cadence: ReflectionCadence
  project?: string
  client?: string
}) {
  const [outputs, proposals, runs] = await Promise.all([
    listOutputArtifacts(25),
    listMemoryProposals('pending'),
    listRuntimeRuns(25),
  ])
  const scopedOutputs = outputs
    .filter(output => !input.project || output.project === input.project)
    .filter(output => !input.client || output.client === input.client)
  const scopedAgentRuns = runs.agentRuns
    .filter(run => !input.project || run.logs.some(log => log.includes(input.project ?? '')))
  const title = `${input.cadence === 'daily' ? 'Daily' : 'Weekly'} BertOS Reflection`
  const lessons = input.cadence === 'weekly'
    ? [
        'Repeated local-first runs should be promoted into automation candidates only after successful outputs exist.',
        'Memory writeback remains proposal-first; pending proposals need human review before becoming durable markdown.',
      ]
    : [
        'Review recent outputs for reusable ideas before writing memory.',
        'Check setup-required integrations before planning external actions.',
      ]

  const output = await createOutputArtifact({
    type: 'automation_digest',
    title,
    project: input.project,
    client: input.client,
    tags: ['reflection', input.cadence],
    status: 'draft',
    content: [
      `# ${title}`,
      '',
      `Cadence: ${input.cadence}`,
      `Outputs reviewed: ${scopedOutputs.length}`,
      `Agent runs reviewed: ${scopedAgentRuns.length}`,
      `Pending memory proposals: ${proposals.length}`,
      '',
      '## Recent Outputs',
      ...(scopedOutputs.slice(0, 8).map(output => `- ${output.title} (${output.outputId}) status=${output.status ?? 'unknown'}`) || ['- None']),
      '',
      '## Candidate Lessons',
      ...lessons.map(lesson => `- ${lesson}`),
      '',
      '## Safety',
      '- No memory was written directly.',
      '- No email, calendar, publishing, paid API, push, deploy, or file deletion action was executed.',
    ].join('\n'),
    metadata: {
      cadence: input.cadence,
      reviewedOutputIds: scopedOutputs.map(output => output.outputId),
      reviewedAgentRunIds: scopedAgentRuns.map(run => run.agentRunId),
      pendingMemoryProposalIds: proposals.map(proposal => proposal.proposalId),
    },
  })

  const proposal = await createMemoryProposal({
    kind: input.cadence === 'weekly' ? 'procedural' : 'episodic',
    title: `${title} lesson`,
    content: lessons.join('\n'),
    project: input.project,
    client: input.client,
    source: 'tool-output',
    sourceRef: output.outputId,
    tags: ['reflection', input.cadence],
    reason: `${title} generated a proposal for human review; no direct memory write occurred.`,
  })

  return { output, memoryProposal: proposal }
}
