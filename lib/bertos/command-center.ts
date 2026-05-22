export type CommandCenterAgentId =
  | 'auto'
  | 'bertos-orchestrator'
  | 'ollama-local'
  | 'claude-code'
  | 'codex-cli'
  | 'gemini-cli'
  | 'google-antigravity-cli'
  | 'devin'
  | 'hermes-nous'
  | 'free-claude-code'
  | 'qwen-experimental'
  | 'openclaw'
  | 'browser-skills'
  | 'hyperframes'
  | 'remotion'
  | 'google-managed-agents'

export type CommandCenterTaskType =
  | 'ui-react-change'
  | 'bug-fix'
  | 'build-typecheck-fix'
  | 'provider-integration'
  | 'new-route-page'
  | 'documentation'
  | 'refactor'
  | 'research-planning'
  | 'safety-audit'
  | 'devin-pr-task'
  | 'antigravity-migration'

export type CommandCenterMode =
  | 'plan-only'
  | 'external-prompt'
  | 'safe-local-inspect'
  | 'safe-local-verify'
  | 'daemon-verification'
  | 'patch-proposal'

export interface CommandCenterAgent {
  id: CommandCenterAgentId
  name: string
  role: string
  category: 'local-free' | 'cli-subscription' | 'cloud-teammate' | 'paid-api' | 'experimental-proxy' | 'planned' | 'migration'
  status: 'available' | 'requires-setup' | 'planned' | 'experimental' | 'paid-gated' | 'external-only'
  billing: string
  bestUse: string
  canRunNow: string
  requiresDaemon?: boolean
  requiresApi?: boolean
  copyPromptOnly?: boolean
  warning?: string
  setupPrompt: string
}

export interface CommandCenterPlaybook {
  id: string
  title: string
  category: string
  bestAgent: string
  risk: 'safe' | 'review-required' | 'approval-required'
  requiredTools: string[]
  description: string
  steps: string[]
  prompt: string
}

export const SELF_CODING_SAFETY_ITEMS = [
  'Work only in the standalone BertOS repo.',
  'Do not touch Sylistly or unrelated projects.',
  'Do not print secrets or read .env.local contents.',
  'Do not run paid API calls unless the user explicitly enables them.',
  'Do not push, auto-merge, deploy, or install packages automatically.',
  'Do not claim an integration works unless it is verified.',
  'Use copy-prompt workflows for external agents unless a safe backend exists.',
  'Run npm run typecheck, npm run build, and npm run bertos:safety before reporting done.',
]

export const TASK_TYPE_OPTIONS: Array<{ id: CommandCenterTaskType; label: string; recommendedAgent: CommandCenterAgentId; likelyFiles: string[] }> = [
  { id: 'ui-react-change', label: 'UI/React change', recommendedAgent: 'claude-code', likelyFiles: ['components/bertos', 'app/(bertos)', 'app/globals.css'] },
  { id: 'bug-fix', label: 'Bug fix', recommendedAgent: 'codex-cli', likelyFiles: ['app', 'components', 'lib', 'store'] },
  { id: 'build-typecheck-fix', label: 'Build/typecheck fix', recommendedAgent: 'codex-cli', likelyFiles: ['app', 'components', 'lib', 'package.json', 'tsconfig.json'] },
  { id: 'provider-integration', label: 'Provider integration', recommendedAgent: 'claude-code', likelyFiles: ['lib/bertos/providers', 'app/api/providers', 'components/bertos/panels/SettingsView.tsx'] },
  { id: 'new-route-page', label: 'New route/page', recommendedAgent: 'claude-code', likelyFiles: ['app/(bertos)', 'components/bertos', 'components/bertos/shell'] },
  { id: 'documentation', label: 'Documentation', recommendedAgent: 'codex-cli', likelyFiles: ['README.md', 'docs', 'BERTOS_AUTONOMOUS_PROGRESS.md'] },
  { id: 'refactor', label: 'Refactor', recommendedAgent: 'claude-code', likelyFiles: ['components/bertos', 'lib/bertos', 'store/bertos'] },
  { id: 'research-planning', label: 'Research/planning', recommendedAgent: 'gemini-cli', likelyFiles: ['README.md', 'docs', 'lib/bertos'] },
  { id: 'safety-audit', label: 'Safety audit', recommendedAgent: 'codex-cli', likelyFiles: ['scripts', 'app/api', 'lib/bertos/providers'] },
  { id: 'devin-pr-task', label: 'Devin PR task', recommendedAgent: 'devin', likelyFiles: ['changed files', 'README.md', 'BERTOS_AUTONOMOUS_PROGRESS.md'] },
  { id: 'antigravity-migration', label: 'Anti-Gravity migration task', recommendedAgent: 'gemini-cli', likelyFiles: ['lib/bertos/providers', 'app/api/providers/status/route.ts', 'docs'] },
]

export const BUILDER_MODE_OPTIONS: Array<{ id: CommandCenterMode; label: string; description: string }> = [
  { id: 'plan-only', label: 'Plan only', description: 'Compile scope, risks, likely files, and validation. No execution.' },
  { id: 'external-prompt', label: 'Generate external prompt', description: 'Create copyable prompts for Claude, Codex, Gemini, Devin, Qwen, Hermes, and other tools.' },
  { id: 'safe-local-inspect', label: 'Safe local inspect', description: 'Use local context and safe read-only checks when the daemon is available.' },
  { id: 'safe-local-verify', label: 'Safe local verify', description: 'Run allowlisted verification commands through the daemon.' },
  { id: 'daemon-verification', label: 'Daemon-backed verification', description: 'Use daemon-backed repo/build/git checks. Requires npm run bertos:daemon.' },
  { id: 'patch-proposal', label: 'Patch proposal, approval required', description: 'Generate a reviewable patch but do not apply anything without approval.' },
]

export const AGENT_ROSTER: CommandCenterAgent[] = [
  {
    id: 'bertos-orchestrator',
    name: 'BertOS Orchestrator',
    role: 'Routes work across Builder, Playbooks, Workspace, Agents, and Autopilot.',
    category: 'local-free',
    status: 'available',
    billing: 'Local UI and daemon safety layer',
    bestUse: 'Turn rough work into scoped missions and copyable prompts.',
    canRunNow: 'Yes for prompt generation; daemon required for local repo checks.',
    requiresDaemon: false,
    setupPrompt: 'Inspect BertOS command-center routes and improve orchestration without creating duplicate systems.',
  },
  {
    id: 'ollama-local',
    name: 'Ollama / Local Brain',
    role: 'Cheap default summaries and local/private small tasks.',
    category: 'local-free',
    status: 'requires-setup',
    billing: 'Local/free or configured Ollama Cloud',
    bestUse: 'Summaries, classification, simple planning, local fallback.',
    canRunNow: 'Only when Ollama Cloud/local model is configured.',
    setupPrompt: 'Verify Ollama provider setup in BertOS without exposing keys or running unsafe commands.',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    role: 'Architecture, UI repair, refactors, and high-quality review.',
    category: 'cli-subscription',
    status: 'requires-setup',
    billing: 'CLI/subscription',
    bestUse: 'React UI fixes, design cleanup, architectural review, risk analysis.',
    canRunNow: 'Yes if Claude Code CLI is installed and daemon provider bridge is online.',
    requiresDaemon: true,
    setupPrompt: 'Use Claude Code for a focused BertOS UI or architecture task. Preserve safety gates and validation.',
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    role: 'Implementation, verification, build fixes, and repo edits.',
    category: 'cli-subscription',
    status: 'requires-setup',
    billing: 'CLI/subscription',
    bestUse: 'TypeScript/build fixes, scoped implementation, tests, validation.',
    canRunNow: 'Yes if Codex CLI is installed and daemon provider bridge is online.',
    requiresDaemon: true,
    setupPrompt: 'Use Codex for a focused BertOS implementation task. Run typecheck, build, and safety before reporting done.',
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    role: 'Long-context planning and research. Keep until migration is verified.',
    category: 'cli-subscription',
    status: 'requires-setup',
    billing: 'CLI/subscription',
    bestUse: 'Large plans, migration audits, comparison, research.',
    canRunNow: 'Yes if Gemini CLI is installed and reachable through the daemon.',
    requiresDaemon: true,
    warning: 'Treat Gemini CLI as current/legacy until official Anti-Gravity migration is verified locally.',
    setupPrompt: 'Use Gemini CLI for broad BertOS planning. Do not assume Google Anti-Gravity has replaced it.',
  },
  {
    id: 'google-antigravity-cli',
    name: 'Google Anti-Gravity CLI',
    role: 'Planned Google agent workflow after official docs/local commands verify it.',
    category: 'migration',
    status: 'planned',
    billing: 'Unknown until verified',
    bestUse: 'Migration planning only.',
    canRunNow: 'No. Planned/experimental, not default.',
    warning: 'Do not replace Gemini CLI until official documentation and local installation are confirmed.',
    setupPrompt: 'Audit the local Gemini CLI to Google Anti-Gravity migration path. Verify official sources before making routing changes.',
  },
  {
    id: 'devin',
    name: 'Devin',
    role: 'External cloud coding teammate for scoped PR-style work.',
    category: 'cloud-teammate',
    status: 'external-only',
    billing: 'External paid/cloud service',
    bestUse: 'Scoped PR tasks, route smoke checks, issue triage, cloud teammate workflows.',
    canRunNow: 'Copy-prompt only unless safe Devin API credentials and routes are later added.',
    copyPromptOnly: true,
    warning: 'Do not auto-merge Devin output. Review PRs and validation results manually.',
    setupPrompt: 'Create a scoped Devin task for BertOS. Do not auto-merge, do not push, and provide validation evidence.',
  },
  {
    id: 'hermes-nous',
    name: 'Hermes / Nous Proxy',
    role: 'Optional paid proxy. Useful only when paid credits are explicitly enabled.',
    category: 'paid-api',
    status: 'paid-gated',
    billing: 'Paid API credits required',
    bestUse: 'Paid cloud model routing after explicit approval.',
    canRunNow: 'No by default. ENABLE_HERMES_PAID=true is required.',
    requiresApi: true,
    warning: 'No free chat models are available on the current account. Never route silently.',
    setupPrompt: 'Use Hermes/Nous only if paid credits were explicitly approved. Do not assume free models are available.',
  },
  {
    id: 'free-claude-code',
    name: 'Free Claude Code Proxy',
    role: 'Experimental proxy concept, separate from official Claude Code.',
    category: 'experimental-proxy',
    status: 'experimental',
    billing: 'Provider-dependent backend pricing',
    bestUse: 'Experimental review only when explicitly enabled.',
    canRunNow: 'No by default. ENABLE_FCC_PROXY=true is required.',
    warning: 'Not official Anthropic Claude. Do not replace Claude Code.',
    setupPrompt: 'Evaluate FCC Proxy as an experimental BertOS provider. Keep official Claude Code separate.',
  },
  {
    id: 'qwen-experimental',
    name: 'Qwen Experimental',
    role: 'Manual/API experimental long-context and coding model.',
    category: 'experimental-proxy',
    status: 'experimental',
    billing: 'Manual/API provider dependent',
    bestUse: 'Planning, comparison, and implementation prompts when manually available.',
    canRunNow: 'Copy-prompt only unless a verified route is added.',
    copyPromptOnly: true,
    warning: 'Do not claim free unlimited usage.',
    setupPrompt: 'Use Qwen as an experimental planning/coding reviewer. Keep output reviewable and validation-focused.',
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    role: 'Planned local/open agent integration.',
    category: 'planned',
    status: 'planned',
    billing: 'Planned local/open integration',
    bestUse: 'Future local agent loops and tool orchestration.',
    canRunNow: 'No. Planned only.',
    setupPrompt: 'Plan an OpenClaw integration for BertOS without claiming it is installed.',
  },
  {
    id: 'browser-skills',
    name: 'Browser Skills',
    role: 'Planned browser verification and UI smoke-test agent.',
    category: 'planned',
    status: 'planned',
    billing: 'Local tool/plugin dependent',
    bestUse: 'Future route smoke tests, visual verification, and browser workflows.',
    canRunNow: 'No direct BertOS integration yet.',
    setupPrompt: 'Plan browser-based route smoke tests for BertOS using safe local verification.',
  },
  {
    id: 'hyperframes',
    name: 'Hyperframes Video Agent',
    role: 'Planned local video generation pipeline using HTML/CSS/JS animation.',
    category: 'planned',
    status: 'planned',
    billing: 'Local setup dependent; requires Node, FFmpeg, and Hyperframes setup',
    bestUse: 'Future animated video generation from HTML/CSS/JS once installed and verified.',
    canRunNow: 'No. Planned / not installed unless local detection is added.',
    requiresDaemon: true,
    warning: 'Not connected yet. Do not claim video rendering works.',
    setupPrompt: 'Plan a Hyperframes integration for BertOS. Verify Node, FFmpeg, and Hyperframes installation first. Generate setup/implementation steps only; do not claim rendering works.',
  },
  {
    id: 'remotion',
    name: 'Remotion Video Agent',
    role: 'Planned local React video rendering pipeline.',
    category: 'planned',
    status: 'planned',
    billing: 'Local setup dependent; requires Node, FFmpeg/Remotion setup',
    bestUse: 'Future programmatic video generation with React components once installed and verified.',
    canRunNow: 'No. Planned / not installed unless local detection is added.',
    requiresDaemon: true,
    warning: 'Not connected yet. Do not claim Remotion rendering works.',
    setupPrompt: 'Plan a Remotion integration for BertOS. Verify Remotion and FFmpeg installation first. Generate setup/implementation steps only; do not claim video rendering works.',
  },
  {
    id: 'google-managed-agents',
    name: 'Google Managed Agents API',
    role: 'Planned cloud sandbox/managed agent runtime.',
    category: 'migration',
    status: 'planned',
    billing: 'Cloud billing likely; unverified',
    bestUse: 'Future hosted task execution after explicit setup.',
    canRunNow: 'No. Planned only.',
    warning: 'No live paid calls. Do not make this the default.',
    setupPrompt: 'Research Google Managed Agents as a future BertOS runtime. Keep local daemon as the current file/terminal bridge.',
  },
]

export const PLAYBOOK_TEMPLATES: CommandCenterPlaybook[] = [
  {
    id: 'build-failure',
    title: 'Build Failure Fix',
    category: 'Validation',
    bestAgent: 'Codex or Devin',
    risk: 'review-required',
    requiredTools: ['daemon', 'typecheck', 'build'],
    description: 'Run validation, inspect direct errors, patch the root cause, and rerun checks.',
    steps: ['Run typecheck', 'Run build', 'Summarize errors', 'Inspect likely files', 'Propose patch', 'Rerun validation'],
    prompt: 'Fix a BertOS build/typecheck failure. Run npm run typecheck and npm run build, inspect the exact errors, make the smallest safe patch, then rerun npm run typecheck, npm run build, and npm run bertos:safety. Do not push.',
  },
  {
    id: 'bug-triage',
    title: 'Bug Triage',
    category: 'Debug',
    bestAgent: 'Devin or Claude',
    risk: 'review-required',
    requiredTools: ['repo search', 'git diff/log'],
    description: 'Inspect a bug report, find likely files, summarize root cause evidence, and suggest a fix.',
    steps: ['Read issue', 'Search relevant files', 'Check recent git diff/log', 'Summarize root cause', 'Suggest fix', 'Do not auto-merge'],
    prompt: 'Run safe bug triage for BertOS. Inspect the symptom, search relevant files, check recent git diff/log, identify root cause evidence, propose a focused fix, and list validation commands. Do not apply risky changes or push.',
  },
  {
    id: 'route-smoke',
    title: 'Route Smoke Test',
    category: 'QA',
    bestAgent: 'Devin or Codex',
    risk: 'safe',
    requiredTools: ['Next dev server', 'browser or HTTP smoke'],
    description: 'Verify the main BertOS routes load and report broken ones.',
    steps: ['Start app locally', 'Visit primary routes', 'Record failures', 'Inspect direct causes', 'Report fixes'],
    prompt: 'Smoke test BertOS routes: /dashboard, /chat, /builder, /settings, /memory, /brief, /playbooks, /agents, /tasks, /migrations, and /api/providers/status. Report exact failures and do not fake route success.',
  },
  {
    id: 'provider-status-audit',
    title: 'Provider Status Audit',
    category: 'Providers',
    bestAgent: 'Codex or Claude',
    risk: 'safe',
    requiredTools: ['provider status API', 'settings UI'],
    description: 'Audit provider metadata, paid gates, duplicate cards, and status wording.',
    steps: ['Inspect registry/status API', 'Inspect Settings providers', 'Verify paid gates', 'Check duplicates', 'Recommend fixes'],
    prompt: 'Audit BertOS provider status and Settings provider cards. Ensure Hermes/Nous is paid-gated, FCC is experimental, Devin is external/copy-prompt only, Anti-Gravity is planned, and no provider status is faked.',
  },
  {
    id: 'pr-review',
    title: 'PR Review',
    category: 'Review',
    bestAgent: 'Devin or Codex',
    risk: 'review-required',
    requiredTools: ['git diff', 'typecheck', 'build'],
    description: 'Review changed files, run checks, summarize behavior risk, and recommend merge/no-merge.',
    steps: ['Inspect git diff', 'Run validation', 'Review changed routes', 'Summarize risks', 'Recommend next action'],
    prompt: 'Review the current BertOS diff as a PR reviewer. Prioritize bugs, regressions, missing tests, fake integrations, secret exposure, and paid-call risk. Run validation if available and do not push.',
  },
  {
    id: 'small-feature',
    title: 'Small Feature Implementation',
    category: 'Build',
    bestAgent: 'Claude or Devin',
    risk: 'review-required',
    requiredTools: ['repo search', 'typecheck', 'build'],
    description: 'Implement one scoped feature with clear validation and no unrelated rewrites.',
    steps: ['Clarify scope', 'Inspect likely files', 'Patch focused surface', 'Run validation', 'Report changed files'],
    prompt: 'Implement one small BertOS feature. Keep the patch scoped, use existing architecture, avoid duplicate systems, and run npm run typecheck, npm run build, and npm run bertos:safety before reporting.',
  },
  {
    id: 'self-coding-feature',
    title: 'Self-Coding Feature',
    category: 'Builder',
    bestAgent: 'Claude, Codex, or Qwen',
    risk: 'approval-required',
    requiredTools: ['Builder', 'Workspace', 'daemon if applying'],
    description: 'Safely add or improve self-coding workflows with approval gates.',
    steps: ['Compile mission', 'Gather context', 'Generate patch proposal', 'Review diff', 'Run checks', 'Document limits'],
    prompt: 'Improve a BertOS self-coding workflow. Preserve safety gates, do not auto-apply risky patches, keep provider output honest, and validate with typecheck/build/safety.',
  },
  {
    id: 'memory-update',
    title: 'Memory Update',
    category: 'Memory',
    bestAgent: 'Ollama or Claude',
    risk: 'safe',
    requiredTools: ['session notes'],
    description: 'Summarize the current session into a reusable project memory note.',
    steps: ['Summarize decisions', 'List changed files', 'Record validation results', 'Capture next prompt', 'Avoid secrets'],
    prompt: 'Summarize the current BertOS session into a project memory note. Include decisions, files changed, validation results, known limitations, and next prompt. Do not include secrets.',
  },
  {
    id: 'daily-project-check-in',
    title: 'Daily Project Check-In',
    category: 'Brief',
    bestAgent: 'Gemini or Claude',
    risk: 'safe',
    requiredTools: ['dashboard context', 'tasks', 'provider status'],
    description: 'Summarize progress, blockers, provider health, and next actions.',
    steps: ['Review current mission', 'Review provider health', 'List blockers', 'Recommend next action'],
    prompt: 'Create a daily BertOS project check-in. Summarize progress, blockers, active tasks, provider readiness, and the next best action. Do not claim Gmail/Calendar access.',
  },
  {
    id: 'antigravity-migration-audit',
    title: 'Anti-Gravity Migration Audit',
    category: 'Migration',
    bestAgent: 'Gemini, Claude, or Codex',
    risk: 'safe',
    requiredTools: ['official docs', 'local CLI detection'],
    description: 'Assess Gemini CLI to Google Anti-Gravity migration risk without making it default.',
    steps: ['Verify official docs', 'Check local Gemini CLI', 'Check Anti-Gravity availability', 'List risks', 'Recommend staged migration'],
    prompt: 'Audit BertOS Gemini CLI to Google Anti-Gravity migration readiness. Treat Anti-Gravity as unverified until official docs and local command detection confirm it. Do not replace Gemini CLI or make paid calls.',
  },
  {
    id: 'daily-ideation-trend-scout',
    title: 'Daily Ideation / Trend Scout',
    category: 'Content',
    bestAgent: 'Gemini, Claude, Qwen, or Hermes only if research/tools are configured',
    risk: 'safe',
    requiredTools: ['optional web/search tools', 'daily journal'],
    description: 'Find what is trending and decide what content or project angle to test today.',
    steps: [
      'Check recent best-performing content if data is available',
      'Check GitHub trending or open-source project ideas if web tools are available',
      'Check competitor/social topics if tools are available',
      'Summarize what seems to be working',
      'Recommend 3 ideas to test',
      'Write a daily journal note about what to try',
      'Do not post automatically',
    ],
    prompt: 'Run a Daily Ideation / Trend Scout pass for BertOS. If browser/search tools or performance data are available, use them and cite what was checked. If not, say what data is missing. Summarize what is working, recommend 3 content or project angles to test today, and write a short daily journal note. Do not post automatically.',
  },
  {
    id: 'content-factory',
    title: 'Content Factory',
    category: 'Content',
    bestAgent: 'Hermes if approved tools are configured; Claude, Gemini, or Qwen for writing/planning; Hyperframes/Remotion planned for video',
    risk: 'review-required',
    requiredTools: ['content idea', 'optional research tools', 'approval before publishing'],
    description: 'Turn one idea into a blog post, short video script, social posts, thumbnail concept, newsletter blurb, and journal entry.',
    steps: [
      'Clarify the core idea and target audience',
      'Draft a blog post outline or article',
      'Write a short video script',
      'Write LinkedIn and X/Twitter posts',
      'Create a thumbnail concept and prompt',
      'Write a newsletter blurb',
      'Write a daily journal entry about what to test',
      'Do not auto-post or claim video rendering works',
    ],
    prompt: 'Run the Content Factory playbook. Turn this idea into: blog post, short video script, LinkedIn post, X/Twitter post, thumbnail concept, newsletter blurb, and daily journal entry. Use Hermes only if paid/tool usage was explicitly approved. Treat Hyperframes/Remotion as planned setup prompts only. Do not auto-post.',
  },
]

export function getAgent(id: CommandCenterAgentId) {
  return AGENT_ROSTER.find(agent => agent.id === id) ?? AGENT_ROSTER[0]
}

export function recommendAgentForTask(taskType: CommandCenterTaskType, description = '') {
  const lower = description.toLowerCase()
  if (lower.includes('devin') || taskType === 'devin-pr-task') return getAgent('devin')
  if (lower.includes('hermes') || lower.includes('nous')) return getAgent('hermes-nous')
  if (lower.includes('hyperframes')) return getAgent('hyperframes')
  if (lower.includes('remotion')) return getAgent('remotion')
  if (lower.includes('anti-gravity') || lower.includes('antigravity') || taskType === 'antigravity-migration') return getAgent('gemini-cli')
  const option = TASK_TYPE_OPTIONS.find(item => item.id === taskType)
  return getAgent(option?.recommendedAgent ?? 'codex-cli')
}

export function buildSelfCodingPrompt(input: {
  title: string
  description: string
  taskType: CommandCenterTaskType
  mode: CommandCenterMode
  agentId: CommandCenterAgentId
  extraContext?: string[]
}) {
  const agent = input.agentId === 'auto' ? recommendAgentForTask(input.taskType, input.description) : getAgent(input.agentId)
  const taskType = TASK_TYPE_OPTIONS.find(item => item.id === input.taskType) ?? TASK_TYPE_OPTIONS[0]
  const mode = BUILDER_MODE_OPTIONS.find(item => item.id === input.mode) ?? BUILDER_MODE_OPTIONS[0]
  const title = input.title.trim() || 'BertOS self-coding task'
  const description = input.description.trim() || 'Inspect the current BertOS repo and propose the safest next improvement.'

  return [
    `MISSION: ${title}`,
    '',
    'You are working in the standalone BertOS Next.js/TypeScript repo.',
    '',
    'Goal:',
    description,
    '',
    'Recommended agent/provider:',
    `- ${agent.name}: ${agent.bestUse}`,
    `- Mode: ${mode.label} - ${mode.description}`,
    `- Billing/status note: ${agent.billing}; ${agent.canRunNow}`,
    ...(agent.warning ? [`- Warning: ${agent.warning}`] : []),
    '',
    'Safety rules:',
    ...SELF_CODING_SAFETY_ITEMS.map(item => `- ${item}`),
    '',
    'Files/areas to inspect first:',
    ...taskType.likelyFiles.map(file => `- ${file}`),
    ...(input.extraContext ?? []).map(item => `- ${item}`),
    '',
    'Implementation phases:',
    '1. Inspect current state and identify the smallest correct surface area.',
    '2. Make focused changes using existing BertOS architecture.',
    '3. Keep external agents as copy-prompt only unless a verified backend route exists.',
    '4. Preserve daemon, Workspace, provider routing, Autopilot, chat, and settings behavior.',
    '5. Update docs or progress notes when behavior or routes change.',
    '',
    'Validation commands:',
    '- npm run typecheck',
    '- npm run build',
    '- npm run bertos:safety',
    '',
    'Final report format:',
    '- Files changed',
    '- What is real vs planned/copy-prompt only',
    '- Validation results',
    '- Safety notes',
    '- Remaining limitations',
    '- Next recommended command or prompt',
  ].join('\n')
}

export function buildMigrationAuditPrompt() {
  return buildSelfCodingPrompt({
    title: 'Audit Gemini CLI to Google Anti-Gravity migration readiness',
    description: 'Verify official Google guidance and local command availability before changing BertOS routing. Keep Gemini CLI supported and do not make Anti-Gravity default until verified.',
    taskType: 'antigravity-migration',
    mode: 'plan-only',
    agentId: 'gemini-cli',
    extraContext: ['app/api/providers/status/route.ts', 'components/bertos/panels/SettingsView.tsx', 'lib/bertos/providers'],
  })
}
