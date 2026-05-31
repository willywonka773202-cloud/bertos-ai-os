import { makeRuntimeId, nowIso, readJsonFile, runtimePath, writeJsonFile } from '../runtime-store'
import type { AutomationCandidate } from '../workflows/types'

const CANDIDATES_INDEX = runtimePath('automations', 'candidates.json')

export const CREATOR_OS_AUTOMATION_TEMPLATES: Array<Omit<AutomationCandidate, 'automationCandidateId' | 'sourceRunId' | 'createdAt'>> = [
  {
    title: 'Daily Second Brain Idea Digest',
    trigger: 'cron',
    schedule: '0 8 * * *',
    skillChain: ['second-brain', 'publishing-queue'],
    pluginIds: ['readwise', 'memory', 'outputs'],
    outputDestination: 'data/bertos/outputs/projects/general',
    approvalRequired: false,
    failurePolicy: 'partial_digest',
  },
  {
    title: 'Morning Sponsorship Digest',
    trigger: 'cron',
    schedule: '0 9 * * *',
    skillChain: ['inbox-deal-manager'],
    pluginIds: ['gmail', 'calendar', 'outputs'],
    outputDestination: 'data/bertos/outputs/projects/deals',
    approvalRequired: true,
    failurePolicy: 'partial_digest',
  },
  {
    title: 'Friday Publishing Queue Builder',
    trigger: 'cron',
    schedule: '0 15 * * 5',
    skillChain: ['second-brain', 'publishing-queue'],
    pluginIds: ['memory', 'outputs', 'buffer'],
    outputDestination: 'data/bertos/publishing/queue.json',
    approvalRequired: true,
    failurePolicy: 'pause',
  },
  {
    title: 'Sunday Output and Memory Review',
    trigger: 'cron',
    schedule: '0 17 * * 0',
    skillChain: ['second-brain'],
    pluginIds: ['memory', 'outputs'],
    outputDestination: 'data/bertos/memory/workflow_history',
    approvalRequired: false,
    failurePolicy: 'partial_digest',
  },
  {
    title: 'New Transcript Hook Extraction',
    trigger: 'new_source',
    skillChain: ['youtube-researcher'],
    pluginIds: ['youtube', 'outputs', 'memory'],
    outputDestination: 'data/bertos/outputs/projects/content',
    approvalRequired: false,
    failurePolicy: 'retry',
  },
]

export function createAutomationCandidate(input: {
  sourceRunId: string
  templateTitle?: string
  skillChain?: string[]
  pluginIds?: string[]
}): AutomationCandidate {
  const template = CREATOR_OS_AUTOMATION_TEMPLATES.find(item => !input.templateTitle || item.title === input.templateTitle)
    ?? CREATOR_OS_AUTOMATION_TEMPLATES[0]
  return {
    ...template,
    automationCandidateId: makeRuntimeId('autocand'),
    sourceRunId: input.sourceRunId,
    skillChain: input.skillChain ?? template.skillChain,
    pluginIds: input.pluginIds ?? template.pluginIds,
    createdAt: nowIso(),
  }
}

export async function listAutomationCandidates(limit = 100) {
  const candidates = await readJsonFile<AutomationCandidate[]>(CANDIDATES_INDEX, [])
  return candidates.slice(0, limit)
}

export async function createAndSaveAutomationCandidate(input: {
  sourceRunId: string
  templateTitle?: string
  skillChain?: string[]
  pluginIds?: string[]
}) {
  const candidate = createAutomationCandidate(input)
  const candidates = await readJsonFile<AutomationCandidate[]>(CANDIDATES_INDEX, [])
  await writeJsonFile(CANDIDATES_INDEX, [candidate, ...candidates.filter(item => item.automationCandidateId !== candidate.automationCandidateId)])
  return candidate
}
