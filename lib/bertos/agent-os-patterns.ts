import type { MissionMode, MissionRisk } from './missions'

export type AgentOSPatternId =
  | 'repo-microagent'
  | 'aci-command-surface'
  | 'trajectory-ledger'
  | 'approval-checkpoints'
  | 'sandbox-boundary'
  | 'workflow-blocks'
  | 'browser-observe-act'
  | 'memory-handoff'

export interface AgentOSPattern {
  id: AgentOSPatternId
  label: string
  source: string
  summary: string
  promptRules: string[]
}

export const AGENT_OS_PATTERNS: AgentOSPattern[] = [
  {
    id: 'repo-microagent',
    label: 'Repository microagent context',
    source: 'OpenHands microagents',
    summary: 'Load compact repository purpose, setup, validation, and safety rules before planning edits.',
    promptRules: [
      'Read AGENTS.md and any repository microagent notes before proposing changes.',
      'Name the exact files and validation commands the mission needs before implementation.',
    ],
  },
  {
    id: 'aci-command-surface',
    label: 'Agent-computer interface',
    source: 'SWE-agent ACI',
    summary: 'Prefer a small, explicit command surface over broad shell improvisation.',
    promptRules: [
      'Use search, file read, patch proposal, and allowlisted validation commands as separate observable steps.',
      'Do not run destructive shell commands or inspect secrets.',
    ],
  },
  {
    id: 'trajectory-ledger',
    label: 'Trajectory ledger',
    source: 'SWE-agent trajectories',
    summary: 'Keep an audit trail of goal, action, observation, files touched, and validation evidence.',
    promptRules: [
      'Report the action/observation trail: context gathered, files changed, commands run, and outcomes.',
      'If validation cannot run, say why and mark the result as unverified.',
    ],
  },
  {
    id: 'approval-checkpoints',
    label: 'Approval checkpoints',
    source: 'LangGraph / HITL agent practice',
    summary: 'Pause before risky writes, deletes, paid calls, pushes, deploys, or broad refactors.',
    promptRules: [
      'Ask for explicit approval before deletes, paid API calls, pushes, deploys, or cross-system mutations.',
      'For high-risk missions, split plan, patch, review, and validation into separate checkpoints.',
    ],
  },
  {
    id: 'sandbox-boundary',
    label: 'Sandbox boundary',
    source: 'OpenHands runtime, E2B, Agent Zero',
    summary: 'Keep agent execution inside a known repo/runtime boundary with visible setup and missing capability states.',
    promptRules: [
      'Operate only inside the BertOS repo and preserve daemon safety gates.',
      'Show missing provider, daemon, browser, or runtime setup honestly instead of pretending execution worked.',
    ],
  },
  {
    id: 'workflow-blocks',
    label: 'Workflow blocks',
    source: 'AutoGPT Platform / CrewAI Flows',
    summary: 'Decompose broad tasks into visible blocks with inputs, outputs, owners, and validation gates.',
    promptRules: [
      'Break broad work into named blocks with one owner, one output, and one validation signal each.',
      'Avoid creating parallel duplicate systems when an existing BertOS route, store, or daemon endpoint fits.',
    ],
  },
  {
    id: 'browser-observe-act',
    label: 'Observe before browser action',
    source: 'Stagehand / Browserbase',
    summary: 'For UI/browser work, observe and extract current state before acting, then verify visually.',
    promptRules: [
      'For UI work, inspect current states before changing layout or behavior.',
      'After frontend changes, verify route loading, key UI states, and console errors when a dev server is available.',
    ],
  },
  {
    id: 'memory-handoff',
    label: 'Memory and handoff artifact',
    source: 'Agent Zero skills, OpenHands SDK',
    summary: 'Leave reusable notes for future agents instead of trapping decisions in chat scrollback.',
    promptRules: [
      'Capture durable decisions, constraints, and follow-up risks in docs, memory, or the final report.',
      'Make the handoff self-contained enough for another BertOS agent to continue.',
    ],
  },
]

interface RecommendOptions {
  prompt: string
  mode: MissionMode
  risk: MissionRisk
  estimatedScope: 'small' | 'medium' | 'large'
}

function byId(id: AgentOSPatternId) {
  const pattern = AGENT_OS_PATTERNS.find(item => item.id === id)
  if (!pattern) throw new Error(`Unknown Agent OS pattern: ${id}`)
  return pattern
}

export function recommendAgentOSPatterns(options: RecommendOptions): AgentOSPattern[] {
  const lower = options.prompt.toLowerCase()
  const ids = new Set<AgentOSPatternId>([
    'repo-microagent',
    'aci-command-surface',
    'trajectory-ledger',
    'sandbox-boundary',
  ])

  if (options.risk === 'high' || options.mode === 'worktree') ids.add('approval-checkpoints')
  if (options.estimatedScope !== 'small' || /\b(team|workflow|pipeline|automation|orchestrat|multi[- ]agent|broad|platform|entire)\b/.test(lower)) {
    ids.add('workflow-blocks')
    ids.add('memory-handoff')
  }
  if (/\b(ui|ux|react|layout|browser|route|page|screen|visual|frontend|component)\b/.test(lower)) ids.add('browser-observe-act')
  if (/\b(memory|docs|handoff|decision|context|agent|agents|operating system|os)\b/.test(lower)) ids.add('memory-handoff')
  if (/\b(delete|push|deploy|paid|secret|token|webhook|telegram|github|daemon|terminal)\b/.test(lower)) ids.add('approval-checkpoints')

  return Array.from(ids).map(byId)
}

export function buildAgentOSPromptSection(patterns: AgentOSPattern[]): string[] {
  return patterns.flatMap(pattern => [
    `- ${pattern.label} (${pattern.source}): ${pattern.summary}`,
    ...pattern.promptRules.map(rule => `  - ${rule}`),
  ])
}

export function summarizeAgentOSPatterns(patterns: AgentOSPattern[]): string[] {
  return patterns.map(pattern => `${pattern.label}: ${pattern.summary}`)
}
