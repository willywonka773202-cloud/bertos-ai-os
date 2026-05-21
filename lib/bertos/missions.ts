import type { AIModel } from './types'

export type MissionMode = 'plan' | 'patch' | 'review' | 'team' | 'worktree'
export type MissionProvider = 'auto' | 'ollama' | 'gemini' | 'claude' | 'codex' | 'team'
export type MissionRisk = 'low' | 'medium' | 'high'

export interface CodingMission {
  title: string
  goal: string
  mode: MissionMode
  provider: MissionProvider
  risk: MissionRisk
  scope: string[]
  constraints: string[]
  contextQueries: string[]
  likelyFiles: string[]
  validation: string[]
  doneWhen: string[]
  warnings: string[]
  worktreeRecommended: boolean
  estimatedScope: 'small' | 'medium' | 'large'
  suggestedPrompt: string
  providerReason: string
}

export interface MissionTemplate {
  id: string
  label: string
  description: string
  seedPrompt: string
  likelyFiles: string[]
  validation: string[]
  constraints: string[]
}

export const CODING_MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: 'fix-bug',
    label: 'Fix bug',
    description: 'Diagnose and patch a focused broken behavior.',
    seedPrompt: 'Fix this bug without changing unrelated systems: ',
    likelyFiles: ['components/bertos', 'app/api', 'lib/bertos'],
    validation: ['npm run typecheck', 'npm run build'],
    constraints: ['Preserve working behavior.', 'Add focused diagnostics if needed.', 'Do not fake success.'],
  },
  {
    id: 'add-feature',
    label: 'Add feature',
    description: 'Build a scoped feature with reviewable patch output.',
    seedPrompt: 'Add this feature as a focused, reviewable implementation: ',
    likelyFiles: ['components/bertos', 'app/(bertos)', 'app/api', 'lib/bertos'],
    validation: ['npm run typecheck', 'npm run build'],
    constraints: ['Keep scope bounded.', 'Use existing architecture.', 'Avoid duplicate systems.'],
  },
  {
    id: 'ui-polish',
    label: 'UI polish',
    description: 'Improve layout, states, spacing, and interaction quality.',
    seedPrompt: 'Polish this UI flow while keeping behavior intact: ',
    likelyFiles: ['components/bertos', 'app/(bertos)', 'app/globals.css'],
    validation: ['npm run typecheck', 'npm run build'],
    constraints: ['No fake controls.', 'Every button must work or be clearly disabled.', 'Keep mobile usable.'],
  },
  {
    id: 'refactor',
    label: 'Refactor safely',
    description: 'Refactor one subsystem without behavior drift.',
    seedPrompt: 'Refactor this subsystem safely with minimal behavior change: ',
    likelyFiles: ['lib/bertos', 'components/bertos'],
    validation: ['npm run typecheck', 'npm run build', 'npm run bertos:safety'],
    constraints: ['No broad rewrites.', 'Preserve public behavior.', 'Explain risk in the patch summary.'],
  },
  {
    id: 'add-tests',
    label: 'Add tests',
    description: 'Add focused smoke/regression coverage.',
    seedPrompt: 'Add focused regression or smoke coverage for: ',
    likelyFiles: ['scripts', 'lib/bertos', 'app/api'],
    validation: ['npm run typecheck', 'npm run smoke'],
    constraints: ['Tests must be deterministic.', 'Do not require secrets.', 'Do not add brittle UI snapshots.'],
  },
  {
    id: 'diagnose-build',
    label: 'Diagnose failing build',
    description: 'Use errors and repo context to fix validation failures.',
    seedPrompt: 'Diagnose and fix this validation/build failure: ',
    likelyFiles: ['app', 'components', 'lib', 'scripts'],
    validation: ['npm run typecheck', 'npm run build'],
    constraints: ['Fix the root cause.', 'Do not hide errors.', 'Do not weaken validation.'],
  },
  {
    id: 'improve-bertos',
    label: 'Improve BertOS',
    description: 'Generate a scoped self-improvement mission.',
    seedPrompt: 'Improve BertOS in this focused area: ',
    likelyFiles: ['components/bertos', 'lib/bertos', 'app/api'],
    validation: ['npm run typecheck', 'npm run build', 'npm run bertos:safety'],
    constraints: ['Do not create demo-only UI.', 'Use existing patch/context/provider systems.', 'Never touch Sylistly.'],
  },
  {
    id: 'clean-dead-code',
    label: 'Clean dead code',
    description: 'Remove unused code only when safe and validated.',
    seedPrompt: 'Find and remove safe dead code related to: ',
    likelyFiles: ['app', 'components', 'lib', 'scripts'],
    validation: ['npm run typecheck', 'npm run build'],
    constraints: ['Do not remove uncertain code.', 'Report uncertain leftovers.', 'No behavior regressions.'],
  },
  {
    id: 'create-new-app',
    label: 'Create new app',
    description: 'Plan or scaffold a new app surface intentionally.',
    seedPrompt: 'Create a scoped app/product experience for: ',
    likelyFiles: ['app/(bertos)', 'components/bertos', 'lib/bertos'],
    validation: ['npm run typecheck', 'npm run build'],
    constraints: ['Build the actual usable screen.', 'No marketing-only placeholder.', 'Keep routing clean.'],
  },
  {
    id: 'landing-page',
    label: 'Create landing page',
    description: 'Create a polished page with real states and copy.',
    seedPrompt: 'Create a production-quality landing page for: ',
    likelyFiles: ['app/(bertos)', 'components/bertos'],
    validation: ['npm run typecheck', 'npm run build'],
    constraints: ['No fake links.', 'No broken responsive layout.', 'Use existing design language.'],
  },
  {
    id: 'automation',
    label: 'Create automation',
    description: 'Add an honest workflow or scheduled-task scaffold.',
    seedPrompt: 'Create an approval-gated automation workflow for: ',
    likelyFiles: ['app/api', 'components/bertos/agents', 'lib/bertos'],
    validation: ['npm run typecheck', 'npm run build', 'npm run bertos:safety'],
    constraints: ['No automatic destructive writes.', 'No fake background work.', 'Show missing setup clearly.'],
  },
  {
    id: 'product-mvp',
    label: 'Create product MVP',
    description: 'Turn an idea into a scoped build plan and initial patch.',
    seedPrompt: 'Turn this product idea into a scoped MVP inside BertOS: ',
    likelyFiles: ['app/(bertos)', 'components/bertos', 'lib/bertos'],
    validation: ['npm run typecheck', 'npm run build'],
    constraints: ['Scope to one usable vertical slice.', 'Do not overbuild.', 'Keep future work explicit.'],
  },
  {
    id: 'ai-tool',
    label: 'Create AI tool',
    description: 'Build a useful AI workflow with provider routing.',
    seedPrompt: 'Create an AI tool workflow for: ',
    likelyFiles: ['app/api', 'components/bertos', 'lib/bertos/providers'],
    validation: ['npm run typecheck', 'npm run build', 'npm run bertos:safety'],
    constraints: ['Providers must be verified.', 'No fake model output.', 'No secrets in the browser.'],
  },
]

const DEFAULT_CONSTRAINTS = [
  'Work only in the standalone bertos-ai-os repo.',
  'Never touch Sylistly, Sylistly remotes, or Sylistly domains.',
  'Never expose secrets or read .env files.',
  'Never fake provider status, terminal output, or test results.',
  'Never auto-push.',
  'Use existing BertOS systems instead of creating duplicates.',
]

const DONE_WHEN = [
  'The change is reviewable as a focused patch.',
  'Typecheck passes.',
  'Build passes when UI/API code changed.',
  'Repo safety passes for repo-sensitive changes.',
  'The UI reports honest working, missing setup, or disabled states.',
]

function titleFromPrompt(prompt: string) {
  const firstLine = prompt.trim().split(/\r?\n/).find(Boolean) ?? 'Coding mission'
  return firstLine.replace(/^[-#*\s]+/, '').slice(0, 90) || 'Coding mission'
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

export function generateMissionSearchTerms(prompt: string) {
  const quoted = Array.from(prompt.matchAll(/"([^"]{2,80})"/g)).map(match => match[1])
  const titleCase = Array.from(prompt.matchAll(/\b[A-Z][A-Za-z0-9_]{2,}\b/g)).map(match => match[0])
  const words = prompt
    .split(/[^A-Za-z0-9_]+/)
    .filter(word => word.length >= 4)
    .slice(0, 24)
  const extras: string[] = []
  if (/\bchat\b/i.test(prompt)) extras.push('ChatView', 'MessageBubble', 'InputBar')
  if (/\bworkspace|patch|file|save|terminal|git\b/i.test(prompt)) extras.push('WorkspaceView', 'patch', 'saveActiveFile', 'runCommand')
  if (/\bevolution|improvement|scan\b/i.test(prompt)) extras.push('EvolutionLabView', 'evolution', 'scan')
  if (/\bprovider|router|model|fallback\b/i.test(prompt)) extras.push('askWithProviderRouter', 'Provider', 'router')
  if (/\bdaemon|cli|terminal\b/i.test(prompt)) extras.push('bertos-daemon', 'run-cli', 'repo/run')
  return unique([...quoted, ...titleCase, ...words, ...extras]).slice(0, 30)
}

export function recommendMissionProvider(prompt: string): { provider: MissionProvider; model: AIModel; reason: string } {
  const lower = prompt.toLowerCase()
  const broad = /\b(all[- ]in[- ]one|entire|everything|platform|architecture|strategy|plan|research|github|telegram|hermes|worktree)\b/.test(lower)
  const ui = /\b(ui|layout|polish|responsive|modal|sidebar|visual|design|ux)\b/.test(lower)
  const implementation = /\b(fix|implement|add|create|patch|route|api|daemon|terminal|workspace|build)\b/.test(lower)

  if (broad && implementation) return { provider: 'team', model: 'auto', reason: 'Using Team Mode because this mixes architecture, implementation, and review risk.' }
  if (broad) return { provider: 'gemini', model: 'gemini-cli', reason: 'Using Gemini first because this needs broad planning or long-context analysis.' }
  if (ui) return { provider: 'claude', model: 'claude-code', reason: 'Using Claude because this is UI/architecture review work before implementation.' }
  if (implementation) return { provider: 'codex', model: 'codex-cli', reason: 'Using Codex because this is a focused implementation task.' }
  return { provider: 'ollama', model: 'ollama-pro', reason: 'Using Ollama first because this is low-risk summary/classification work.' }
}

export function compileCodingMission(prompt: string, template?: MissionTemplate): CodingMission {
  const trimmed = prompt.trim()
  const source = template ? `${template.seedPrompt}${trimmed}` : trimmed
  const lower = source.toLowerCase()
  const broadSignals = ['everything', 'entire app', 'all tabs', 'platform', 'autonomous', 'github', 'telegram', 'hermes', 'worktree']
  const highRiskSignals = ['daemon', 'terminal', 'git', 'delete', 'secrets', 'provider routing', 'auth', 'webhook']
  const large = broadSignals.some(signal => lower.includes(signal))
  const highRisk = highRiskSignals.some(signal => lower.includes(signal))
  const provider = recommendMissionProvider(source)
  const searchTerms = generateMissionSearchTerms(source)
  const likelyFiles = unique([
    ...(template?.likelyFiles ?? []),
    ...(lower.includes('chat') ? ['components/bertos/chat', 'store/bertos/chat.ts', 'app/api/chat/route.ts'] : []),
    ...(lower.includes('workspace') || lower.includes('patch') ? ['components/bertos/workspace/WorkspaceView.tsx', 'app/api/workspace/patch/route.ts', 'lib/bertos/patch'] : []),
    ...(lower.includes('provider') || lower.includes('router') ? ['lib/bertos/providers', 'lib/bertos/router.ts', 'app/api/providers/status/route.ts'] : []),
    ...(lower.includes('daemon') || lower.includes('terminal') ? ['scripts/bertos-daemon.mjs', 'app/api/local-daemon'] : []),
    ...(lower.includes('evolution') ? ['components/bertos/evolution/EvolutionLabView.tsx', 'app/api/evolution/scan/route.ts'] : []),
    ...(lower.includes('coding') || lower.includes('mission') ? ['components/bertos/coding', 'lib/bertos/missions.ts'] : []),
  ]).slice(0, 16)
  const risk: MissionRisk = highRisk ? 'high' : large ? 'medium' : 'low'
  const estimatedScope = large ? 'large' : likelyFiles.length > 5 || highRisk ? 'medium' : 'small'
  const worktreeRecommended = risk === 'high' || estimatedScope === 'large'
  const mode: MissionMode = worktreeRecommended ? 'worktree' : provider.provider === 'team' ? 'team' : 'patch'
  const validation = unique([
    ...(template?.validation ?? []),
    'npm run typecheck',
    'npm run build',
    ...(highRisk || source.includes('Sylistly') ? ['npm run bertos:safety'] : []),
  ])
  const warnings = [
    ...(large ? ['This mission is broad. Split it into plan, implementation, and review passes if the first patch is too large.'] : []),
    ...(worktreeRecommended ? ['This should use a worktree before risky implementation on main.'] : []),
    ...(risk === 'high' ? ['High-risk task: require review before applying patch and run strict validation.'] : []),
  ]

  return {
    title: titleFromPrompt(trimmed),
    goal: source,
    mode,
    provider: provider.provider,
    risk,
    scope: likelyFiles,
    constraints: unique([...DEFAULT_CONSTRAINTS, ...(template?.constraints ?? [])]),
    contextQueries: searchTerms,
    likelyFiles,
    validation,
    doneWhen: DONE_WHEN,
    warnings,
    worktreeRecommended,
    estimatedScope,
    providerReason: provider.reason,
    suggestedPrompt: [
      `Goal: ${source}`,
      '',
      'Context to gather:',
      ...searchTerms.slice(0, 10).map(term => `- ${term}`),
      '',
      'Likely files:',
      ...(likelyFiles.length ? likelyFiles : ['- Ask BertOS context search to locate files']).map(file => `- ${file}`),
      '',
      'Constraints:',
      ...unique([...DEFAULT_CONSTRAINTS, ...(template?.constraints ?? [])]).map(item => `- ${item}`),
      '',
      'Validation:',
      ...validation.map(command => `- ${command}`),
      '',
      'Done when:',
      ...DONE_WHEN.map(item => `- ${item}`),
    ].join('\n'),
  }
}

export function providerToAIModel(provider: MissionProvider): AIModel {
  if (provider === 'codex') return 'codex-cli'
  if (provider === 'claude') return 'claude-code'
  if (provider === 'gemini') return 'gemini-cli'
  if (provider === 'ollama') return 'ollama-pro'
  return 'auto'
}
