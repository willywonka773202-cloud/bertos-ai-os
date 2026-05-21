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
}

const KEY_FILES = [
  'package.json',
  'tsconfig.json',
  'next.config',
  'agents.md',
  'AGENTS.md',
  '.env.example',
]

export function buildMission(rawTask: string, fileTree: string[] = []): Mission {
  const lower = rawTask.toLowerCase()
  const words = rawTask.split(/\s+/).filter(w => w.length > 3)

  // Mode detection
  let mode: Mission['mode'] = 'patch'
  if (/\b(plan|design|architect|outline|strategy|think|explore)\b/.test(lower)) mode = 'plan'
  else if (/\b(review|audit|check|assess|analyze|inspect)\b/.test(lower)) mode = 'review'
  else if (/\b(worktree|isolated|sandbox|branch-per-task)\b/.test(lower)) mode = 'worktree'
  else if (/\b(team|multi-step|orchestrat|pipeline|chain)\b/.test(lower)) mode = 'team'

  // Provider selection
  let provider: Mission['provider'] = 'auto'
  if (/\b(implement|patch|fix|build|create|add|refactor|generate|write code)\b/.test(lower))
    provider = 'codex-cli'
  if (/\b(review|architecture|design|complex|reason|analyze|explain)\b/.test(lower))
    provider = 'claude-code'
  if (/\b(research|broad|explore|large context|gemini|plan across)\b/.test(lower))
    provider = 'gemini-cli'
  if (/\b(simple|quick|summary|cheap|basic|short)\b/.test(lower))
    provider = 'ollama-pro'
  if (mode === 'team') provider = 'team'

  // Risk
  let risk: Mission['risk'] = 'low'
  if (/\b(delete|remove|drop|destroy|migrate|schema|breaking|major|overhaul|rewrite)\b/.test(lower))
    risk = 'high'
  else if (/\b(refactor|move|rename|update|change|modify|restructure)\b/.test(lower))
    risk = 'medium'
  if (words.length > 60) risk = 'high'  // huge task

  // Scope
  const scope: string[] = []
  if (/\b(ui|button|component|view|layout|modal|toast|panel|tab|sidebar)\b/.test(lower))
    scope.push('UI components')
  if (/\b(api|route|endpoint|server|backend|fetch|handler)\b/.test(lower))
    scope.push('API routes')
  if (/\b(store|state|zustand|context)\b/.test(lower))
    scope.push('State management')
  if (/\b(type|interface|schema|model)\b/.test(lower))
    scope.push('TypeScript types')
  if (/\b(test|spec|coverage|jest|vitest)\b/.test(lower))
    scope.push('Tests')
  if (/\b(style|css|tailwind|theme|color|dark|light)\b/.test(lower))
    scope.push('Styles')
  if (/\b(config|setting|env|environment|secret)\b/.test(lower))
    scope.push('Configuration')
  if (scope.length === 0) scope.push('General codebase')

  // Likely files from the file tree
  const likelyFiles: string[] = []
  const allFiles = fileTree.slice(0, 300)
  for (const file of allFiles) {
    const fileLower = file.toLowerCase()
    let matched = false
    for (const word of words) {
      if (fileLower.includes(word.toLowerCase())) {
        matched = true
        break
      }
    }
    if (matched && !likelyFiles.includes(file)) likelyFiles.push(file)
    // Always include key config files
    if (KEY_FILES.some(k => fileLower.endsWith(k.toLowerCase()))) {
      if (!likelyFiles.includes(file)) likelyFiles.push(file)
    }
  }

  // Context search terms
  const contextQueries = words
    .filter(w => w.length > 4 && !/^(that|this|with|from|into|have|will|should|would|could)$/.test(w))
    .slice(0, 6)

  // Constraints
  const constraints = [
    'Never touch Sylistly repo',
    'Never expose secrets or .env contents',
    'Never auto-push to git — local commits only',
    'Require explicit approval before applying patches',
    'Return full file content in patches (not diffs or prose)',
  ]
  if (risk === 'high') constraints.push('High risk: create worktree or branch before applying')
  if (mode === 'team') constraints.push('Team mode: requires all providers to be available')

  // Validation
  const validation = ['npm run typecheck', 'npm run build', 'npm run bertos:safety']
  if (/\b(test|spec)\b/.test(lower)) validation.splice(2, 0, 'npm test')

  // Done-when
  const doneWhen = [
    'npm run typecheck passes with 0 errors',
    'npm run build passes',
    'npm run bertos:safety passes',
    'Feature works exactly as described in the task',
    'No fake success, placeholder output, or unimplemented stubs',
    'No accidental changes to unrelated files',
  ]

  // Warnings
  const warnings: string[] = []
  if (rawTask.trim().length < 20)
    warnings.push('Task description is very short — add more detail for better results')
  if (rawTask.trim().length > 3000)
    warnings.push('Task is very long — consider splitting into smaller focused missions')
  if (likelyFiles.filter(f => !KEY_FILES.some(k => f.toLowerCase().endsWith(k))).length === 0)
    warnings.push('No task-specific files detected in repo — context will use active file only')
  if (risk === 'high')
    warnings.push('High-risk operation — review the patch carefully before applying')
  if (mode === 'team')
    warnings.push('Team mode is experimental — all providers must be online')
  if (words.length > 80)
    warnings.push('Consider splitting this into 2–3 smaller missions for better results')

  const titleText = rawTask.trim().replace(/\s+/g, ' ')
  const title = titleText.length > 70 ? titleText.slice(0, 67) + '...' : titleText

  return {
    title,
    goal: rawTask.trim(),
    mode,
    provider,
    risk,
    scope,
    constraints,
    contextQueries,
    likelyFiles: likelyFiles.slice(0, 12),
    validation,
    doneWhen,
    warnings,
  }
}
