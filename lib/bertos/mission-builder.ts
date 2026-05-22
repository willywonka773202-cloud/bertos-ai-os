import {
  TASK_TYPE_OPTIONS,
  buildSelfCodingPrompt,
  recommendAgentForTask,
  type CommandCenterAgentId,
  type CommandCenterMode,
  type CommandCenterTaskType,
} from '@/lib/bertos/command-center'

export interface Mission {
  title: string
  goal: string
  mode: 'plan' | 'patch' | 'review' | 'team' | 'worktree'
  provider: 'auto' | 'ollama-pro' | 'gemini-cli' | 'claude-code' | 'codex-cli' | 'team'
  risk: 'low' | 'medium' | 'high'
  scope: string[]
  constraints: string[]
  contextQueries: string[]
  likelyFiles: string[]
  validation: string[]
  doneWhen: string[]
  warnings: string[]
  recommendedAgent: CommandCenterAgentId
  suggestedPrompt: string
}

const KEY_FILES = ['package.json', 'tsconfig.json', 'next.config', 'AGENTS.md', '.env.example']

function inferTaskType(lower: string): CommandCenterTaskType {
  if (/\b(anti-gravity|antigravity|gemini migration|migration)\b/.test(lower)) return 'antigravity-migration'
  if (/\b(devin|pull request|pr task)\b/.test(lower)) return 'devin-pr-task'
  if (/\b(provider|router|model|cli|api key|hermes|qwen|fcc)\b/.test(lower)) return 'provider-integration'
  if (/\b(route|page|screen|tab)\b/.test(lower)) return 'new-route-page'
  if (/\b(typecheck|build|compile|validation)\b/.test(lower)) return 'build-typecheck-fix'
  if (/\b(ui|react|layout|component|button|modal|panel|sidebar)\b/.test(lower)) return 'ui-react-change'
  if (/\b(docs|readme|document)\b/.test(lower)) return 'documentation'
  if (/\b(audit|security|safety)\b/.test(lower)) return 'safety-audit'
  if (/\b(refactor|cleanup|move|rename)\b/.test(lower)) return 'refactor'
  if (/\b(plan|research|strategy|compare)\b/.test(lower)) return 'research-planning'
  return 'bug-fix'
}

function titleFromTask(task: string) {
  const compact = task.trim().replace(/\s+/g, ' ')
  return compact.length > 70 ? `${compact.slice(0, 67)}...` : compact || 'BertOS mission'
}

export function buildMission(rawTask: string, fileTree: string[] = []): Mission {
  const lower = rawTask.toLowerCase()
  const words = rawTask.split(/\s+/).filter(word => word.length > 3)
  const taskType = inferTaskType(lower)
  const agent = recommendAgentForTask(taskType, rawTask)
  const taskTypeMeta = TASK_TYPE_OPTIONS.find(option => option.id === taskType) ?? TASK_TYPE_OPTIONS[0]

  let mode: Mission['mode'] = 'patch'
  if (/\b(plan|design|architect|outline|strategy|think|explore)\b/.test(lower)) mode = 'plan'
  else if (/\b(review|audit|check|assess|analyze|inspect)\b/.test(lower)) mode = 'review'
  else if (/\b(worktree|isolated|sandbox|branch-per-task)\b/.test(lower)) mode = 'worktree'
  else if (/\b(team|multi-step|orchestrat|pipeline|chain)\b/.test(lower)) mode = 'team'

  let provider: Mission['provider'] = 'auto'
  if (agent.id === 'codex-cli') provider = 'codex-cli'
  else if (agent.id === 'claude-code') provider = 'claude-code'
  else if (agent.id === 'gemini-cli') provider = 'gemini-cli'
  else if (agent.id === 'ollama-local') provider = 'ollama-pro'
  if (mode === 'team') provider = 'team'

  let risk: Mission['risk'] = 'low'
  if (/\b(delete|remove|drop|destroy|migrate|schema|breaking|major|overhaul|rewrite)\b/.test(lower)) risk = 'high'
  else if (/\b(refactor|move|rename|update|change|modify|restructure)\b/.test(lower)) risk = 'medium'
  if (words.length > 60) risk = 'high'

  const scope: string[] = []
  if (/\b(ui|button|component|view|layout|modal|toast|panel|tab|sidebar)\b/.test(lower)) scope.push('UI components')
  if (/\b(api|route|endpoint|server|backend|fetch|handler)\b/.test(lower)) scope.push('API routes')
  if (/\b(store|state|zustand|context)\b/.test(lower)) scope.push('State management')
  if (/\b(type|interface|schema|model)\b/.test(lower)) scope.push('TypeScript types')
  if (/\b(test|spec|coverage|jest|vitest)\b/.test(lower)) scope.push('Tests')
  if (/\b(config|setting|env|environment|secret)\b/.test(lower)) scope.push('Configuration')
  if (scope.length === 0) scope.push('General codebase')

  const likelyFiles = [
    ...taskTypeMeta.likelyFiles,
    ...fileTree.slice(0, 300).filter(file => {
      const lowerFile = file.toLowerCase()
      return words.some(word => lowerFile.includes(word.toLowerCase())) || KEY_FILES.some(key => lowerFile.endsWith(key.toLowerCase()))
    }),
  ].filter((file, index, all) => all.indexOf(file) === index).slice(0, 12)

  const contextQueries = words
    .filter(word => word.length > 4 && !/^(that|this|with|from|into|have|will|should|would|could)$/.test(word))
    .slice(0, 8)

  const constraints = [
    'Never touch Sylistly repo.',
    'Never expose secrets or .env contents.',
    'Never auto-push to git.',
    'Require explicit approval before applying patches.',
    'Return full file content in patches, not prose-only diffs.',
  ]
  if (risk === 'high') constraints.push('High risk: use plan/worktree flow before applying.')

  const validation = ['npm run typecheck', 'npm run build', 'npm run bertos:safety']
  if (/\b(test|spec)\b/.test(lower)) validation.splice(2, 0, 'npm test')

  const doneWhen = [
    'npm run typecheck passes with 0 errors.',
    'npm run build passes.',
    'npm run bertos:safety passes.',
    'Feature works exactly as described.',
    'No fake success, placeholder output, or unimplemented stubs.',
    'No accidental changes to unrelated files.',
  ]

  const warnings: string[] = []
  if (rawTask.trim().length < 20) warnings.push('Task description is short; add detail for better results.')
  if (rawTask.trim().length > 3000) warnings.push('Task is very long; split it into smaller missions if output gets broad.')
  if (risk === 'high') warnings.push('High-risk operation; review carefully before applying.')
  if (agent.status === 'paid-gated') warnings.push(`${agent.name} is paid-gated and must not be used silently.`)
  if (agent.copyPromptOnly || agent.status === 'planned') warnings.push(`${agent.name} is copy-prompt/planned unless a verified backend exists.`)

  const commandCenterMode: CommandCenterMode = mode === 'plan' ? 'plan-only' : mode === 'worktree' ? 'plan-only' : 'patch-proposal'
  const suggestedPrompt = buildSelfCodingPrompt({
    title: titleFromTask(rawTask),
    description: rawTask,
    taskType,
    mode: commandCenterMode,
    agentId: agent.id,
    extraContext: likelyFiles,
  })

  return {
    title: titleFromTask(rawTask),
    goal: rawTask.trim(),
    mode,
    provider,
    risk,
    scope,
    constraints,
    contextQueries,
    likelyFiles,
    validation,
    doneWhen,
    warnings,
    recommendedAgent: agent.id,
    suggestedPrompt,
  }
}
