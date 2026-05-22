'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  Code2,
  Copy,
  FileText,
  FolderOpen,
  GitBranch,
  GitCommit,
  Loader2,
  PanelBottom,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DaemonHealthBanner } from '@/components/bertos/shell/DaemonHealthBanner'
import { cn } from '@/lib/bertos/cn'
import {
  readPatchReliabilityMetrics,
  recordPatchReliabilityEvent,
  summarizePatchReliability,
  type PatchReliabilityProviderMetrics,
} from '@/lib/bertos/metrics/patch-reliability'
import { useUIStore } from '@/store/bertos/ui'
import { useDaemonHealth } from '@/hooks/useDaemonHealth'
import type { AIModel } from '@/lib/bertos/types'
import { RouteHero } from '@/components/bertos/hermes'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

interface WorkspaceStatus {
  online: boolean
  repo?: {
    root: string
    branch: string
    remote: string
    status: string
    safeRepo: boolean
    blockedReason?: string
  }
  error?: string
}

interface OpenTab {
  path: string
  content: string
  savedContent: string
  language: string
}

interface TerminalEntry {
  id: string
  label: string
  stdout: string
  stderr?: string
  error?: string
  exitCode?: number | null
  durationMs?: number
  timestamp: number
  running?: boolean
}

interface PatchCheckResult {
  command: string
  status: 'passed' | 'failed' | 'skipped'
  exitCode?: number | null
  error?: string
}

interface PatchFile {
  path: string
  operation: 'modify' | 'create' | 'delete'
  before?: string
  after?: string
}

interface PatchProposal {
  summary: string
  provider?: string
  files: PatchFile[]
  commandsToRun: string[]
  riskLevel: 'low' | 'medium' | 'high'
}

interface CanonicalPatchPayload {
  summary: string
  files: Array<{
    path: string
    action: 'create' | 'update' | 'delete'
    content: string
  }>
  validation: {
    commands: string[]
  }
}

interface PerFileDebug {
  path: string
  status: 'included' | 'omitted' | 'chunked' | 'truncated'
  chars?: number
  originalChars?: number
  percentIncluded?: number
  isActive: boolean
  isForced: boolean
  isExplicit: boolean
  reason?: string
}

interface PatchParseDebug {
  raw: string
  rawDiagnostics?: {
    byteLength: number
    charLength: number
    first500: string
    last500: string
  }
  extractedJsonCandidate?: string
  normalized?: CanonicalPatchPayload
  parseError?: string
  repairAttempts: Array<{
    attempt: number
    providerId?: string
    stage?: 'initial' | 'local-cleanup' | 'repair'
    ok: boolean
    error?: string
    rawPreview: string
  }>
  context?: {
    activeFile?: string
    searchTerms: string[]
    filesIncluded: string[]
    filesIncludedFull?: string[]
    filesIncludedSnippetsOnly?: string[]
    totalContextChars?: number
    snippetsCount: number
    componentNames: string[]
    searchHits?: Array<{
      path: string
      matchedTerms: string[]
      snippets: Array<{
        term: string
        lines: Array<{ lineNumber: number; text: string }>
      }>
    }>
  }
  serialization?: {
    promptChars: number
    includedFileCount: number
    includedFilePaths: string[]
    serializedContextPreview: string
    serializedPayloadPreview: string
    fileBodiesPresent: boolean
    truncationWarnings: string[]
  }
  perFile?: PerFileDebug[]
  omittedPaths?: string[]
  activeFileIncluded?: boolean
}

interface PatchResponse {
  ok: boolean
  proposal?: PatchProposal
  canonicalPatch?: CanonicalPatchPayload
  durationMs?: number
  filesIncluded?: string[]
  filesOmitted?: string[]
  activeFileIncluded?: boolean
  provider?: {
    providerId?: string
    providerName?: string
    modelOrTool?: string
    source?: string
    fallbackUsed?: string
    fallbackChain?: string[]
    latencyMs?: number
  }
  error?: string
  raw?: string
  debug?: PatchParseDebug
  routeDebug?: {
    selectedProvider?: string
    routerMode?: string
    taskType?: string
    inventoryShortcutUsed?: boolean
  }
}

interface PatchHistoryEntry {
  id: string
  summary: string
  provider?: string
  riskLevel: PatchProposal['riskLevel']
  files: PatchFile[]
  appliedFiles: string[]
  timestamp: number
}

type ValidationProfileId = 'fast' | 'standard' | 'strict'
type MissionScope = 'small' | 'medium' | 'large'
type MissionRunMode = 'main' | 'worktree'

interface MissionTemplate {
  id: string
  label: string
  description: string
  defaultGoal: string
  likelyFiles: string[]
  provider: AIModel
  providerReason: string
  validationProfile: ValidationProfileId
  riskLevel: PatchProposal['riskLevel']
  scope: MissionScope
  avoid: string[]
  worktreeRecommended?: boolean
  planFirst?: boolean
}

const STORAGE_KEY = 'bertos-workspace-tabs-v2'
const TERMINAL_HISTORY_KEY = 'bertos-workspace-terminal-v1'
const PATCH_HISTORY_KEY = 'bertos-workspace-patch-history-v1'
const MAX_PATCH_FILE_BYTES = 250_000
const MAX_PATCH_TOTAL_BYTES = 700_000

const SAFE_COMMANDS = [
  { label: 'git status', executable: 'git', args: ['status', '--short'] },
  { label: 'git diff', executable: 'git', args: ['diff'] },
  { label: 'git diff --stat', executable: 'git', args: ['diff', '--stat'] },
  { label: 'git log', executable: 'git', args: ['log', '--oneline', '-5'] },
  { label: 'typecheck', executable: 'npm', args: ['run', 'typecheck'], timeoutMs: 180000 },
  { label: 'build', executable: 'npm', args: ['run', 'build'], timeoutMs: 240000 },
  { label: 'lint', executable: 'npm', args: ['run', 'lint'], timeoutMs: 180000 },
  { label: 'test', executable: 'npm', args: ['test'], timeoutMs: 180000 },
  { label: 'npm install', executable: 'npm', args: ['install'], timeoutMs: 300000 },
] as const

const CUSTOM_COMMANDS = new Map<string, { executable: string; args: string[]; timeoutMs?: number }>([
  ['git status', { executable: 'git', args: ['status', '--short'] }],
  ['git status --short', { executable: 'git', args: ['status', '--short'] }],
  ['git diff', { executable: 'git', args: ['diff'] }],
  ['git diff --stat', { executable: 'git', args: ['diff', '--stat'] }],
  ['git log --oneline -5', { executable: 'git', args: ['log', '--oneline', '-5'] }],
  ['npm run typecheck', { executable: 'npm', args: ['run', 'typecheck'], timeoutMs: 180000 }],
  ['npm run build', { executable: 'npm', args: ['run', 'build'], timeoutMs: 240000 }],
  ['npm run lint', { executable: 'npm', args: ['run', 'lint'], timeoutMs: 180000 }],
  ['npm test', { executable: 'npm', args: ['test'], timeoutMs: 180000 }],
  ['npm install', { executable: 'npm', args: ['install'], timeoutMs: 300000 }],
])

const VALIDATION_COMMANDS = new Map<string, { executable: string; args: string[]; timeoutMs?: number }>([
  ['npm run typecheck', { executable: 'npm', args: ['run', 'typecheck'], timeoutMs: 180000 }],
  ['npm run build', { executable: 'npm', args: ['run', 'build'], timeoutMs: 240000 }],
])

const MEMORY_FACTS = [
  'Never touch Sylistly or any sylistly remote.',
  'BertOS is a standalone self-coding AI operating system.',
  'The local daemon is the file and terminal bridge.',
  'Ollama Cloud works for API responses.',
  'Claude Code, Codex CLI, and Gemini CLI are available through the daemon when it is online.',
]

const FILE_ALIASES: Record<string, string[]> = {
  'workspace view': ['components/bertos/workspace/WorkspaceView.tsx'],
  'workspaceview': ['components/bertos/workspace/WorkspaceView.tsx'],
  'patch route': ['app/api/workspace/patch/route.ts'],
  'context engine': ['lib/bertos/context-engine.ts', 'app/api/workspace/patch/route.ts'],
  'provider router': ['lib/bertos/providers/router.ts', 'lib/bertos/router.ts'],
  'provider payload': ['lib/bertos/patch/provider-payload.ts'],
  'patch schema': ['lib/bertos/patch/schema.ts'],
  'daemon': ['scripts/bertos-daemon.mjs'],
  'local daemon': ['scripts/bertos-daemon.mjs', 'lib/bertos/local-daemon.ts'],
  'bertos daemon': ['scripts/bertos-daemon.mjs'],
  'command palette': ['components/bertos/command/CommandPalette.tsx'],
  'commandpalette': ['components/bertos/command/CommandPalette.tsx'],
  'dashboard': ['components/bertos/dashboard/DashboardView.tsx', 'app/(bertos)/dashboard/page.tsx'],
  'dashboardview': ['components/bertos/dashboard/DashboardView.tsx'],
  'prompt library': ['components/bertos/prompts/PromptLibraryView.tsx', 'app/(bertos)/prompts/page.tsx'],
  'promptlibrary': ['components/bertos/prompts/PromptLibraryView.tsx'],
  'provider status': ['components/bertos/shell/ProviderStatusIndicator.tsx', 'app/api/providers/status/route.ts'],
  'run route': ['app/api/local-daemon/run/route.ts'],
  'top bar': ['components/bertos/shell/TopBar.tsx'],
  'topbar': ['components/bertos/shell/TopBar.tsx'],
  'sidebar': ['components/bertos/shell/Sidebar.tsx'],
  'bottom nav': ['components/bertos/shell/BottomNav.tsx'],
  'app shell': ['components/bertos/shell/AppShell.tsx'],
  'page': ['app/page.tsx'],
  'agents': ['AGENTS.md'],
}

function extractFileNamesFromTask(task: string): string[] {
  const found = new Set<string>()

  // Exact file names: WorkspaceView.tsx, route.ts, etc.
  const filePatterns = task.matchAll(/\b([\w/-]+\.(?:tsx?|jsx?|mjs|cjs|json|md|css|ya?ml))\b/g)
  for (const match of filePatterns) {
    found.add(match[1])
  }

  // Quoted paths: "components/bertos/workspace/WorkspaceView.tsx"
  const quotedPaths = task.matchAll(/"([^"]{4,120})"/g)
  for (const match of quotedPaths) {
    if (match[1].includes('/') || match[1].includes('.')) found.add(match[1])
  }

  // Backtick paths: `app/api/workspace/patch/route.ts`
  const backtickPaths = task.matchAll(/`([^`]{4,120})`/g)
  for (const match of backtickPaths) {
    if (match[1].includes('/') || match[1].includes('.')) found.add(match[1])
  }

  // Alias matching (case-insensitive)
  const lower = task.toLowerCase()
  for (const [alias, paths] of Object.entries(FILE_ALIASES)) {
    if (lower.includes(alias)) {
      for (const p of paths) found.add(p)
    }
  }

  return Array.from(found).slice(0, 8)
}

const VALIDATION_PROFILES: Record<ValidationProfileId, { label: string; commands: string[]; description: string }> = {
  fast: {
    label: 'FAST',
    commands: ['npm run typecheck'],
    description: 'Use for small TypeScript-only changes.',
  },
  standard: {
    label: 'STANDARD',
    commands: ['npm run typecheck', 'npm run build'],
    description: 'Default profile for normal app changes.',
  },
  strict: {
    label: 'STRICT',
    commands: ['npm run typecheck', 'npm run build', 'npm run bertos:safety', 'npm run bertos -- providers'],
    description: 'Use for daemon, provider, repo safety, or workflow changes.',
  },
}

const TASK_TEMPLATES: MissionTemplate[] = [
  {
    id: 'workspace-bug-fix',
    label: 'Workspace bug fix',
    description: 'Fix a broken Workspace flow without changing unrelated systems.',
    defaultGoal: 'Fix a specific Workspace bug and keep file editing, terminal, patch review, and git workflow stable.',
    likelyFiles: ['components/bertos/workspace/WorkspaceView.tsx', 'app/api/local-daemon/*', 'scripts/bertos-daemon.mjs'],
    provider: 'codex-cli',
    providerReason: 'Using Codex because this is an implementation task touching repo files.',
    validationProfile: 'standard',
    riskLevel: 'medium',
    scope: 'medium',
    avoid: ['Do not rewrite Workspace from scratch.', 'Do not weaken daemon safety.', 'Do not push.'],
  },
  {
    id: 'ui-polish',
    label: 'UI polish',
    description: 'Improve layout, spacing, status states, or interaction polish.',
    defaultGoal: 'Polish a focused BertOS UI surface while preserving working behavior.',
    likelyFiles: ['components/bertos/*', 'app/page.tsx'],
    provider: 'claude-code',
    providerReason: 'Using Claude because this is architecture/UI review and interaction quality work.',
    validationProfile: 'standard',
    riskLevel: 'low',
    scope: 'small',
    avoid: ['Do not add fake controls.', 'Do not hide errors.', 'Do not change provider behavior unless required.'],
  },
  {
    id: 'safe-terminal-fix',
    label: 'Safe terminal fix',
    description: 'Fix daemon command execution, allowlists, or terminal output.',
    defaultGoal: 'Fix a safe terminal or daemon command issue without allowing arbitrary shell execution.',
    likelyFiles: ['scripts/bertos-daemon.mjs', 'app/api/local-daemon/run/route.ts', 'components/bertos/workspace/WorkspaceView.tsx'],
    provider: 'codex-cli',
    providerReason: 'Using Codex because this is implementation and local automation work.',
    validationProfile: 'strict',
    riskLevel: 'high',
    scope: 'medium',
    avoid: ['Do not allow raw PowerShell.', 'Do not expose env files.', 'Do not run destructive commands.'],
    worktreeRecommended: true,
  },
  {
    id: 'evolution-lab',
    label: 'Evolution Lab improvement',
    description: 'Improve scan, backlog, scoring, or proposal workflows.',
    defaultGoal: 'Improve Evolution Lab with honest self-improvement workflows and no fake autonomy.',
    likelyFiles: ['components/bertos/evolution/*', 'app/api/evolution/*'],
    provider: 'codex-cli',
    providerReason: 'Using Codex because this requires focused implementation after a clear plan.',
    validationProfile: 'standard',
    riskLevel: 'medium',
    scope: 'medium',
    avoid: ['Do not auto-write files.', 'Do not auto-push.', 'Do not fake background agents.'],
  },
  {
    id: 'provider-routing',
    label: 'Provider routing fix',
    description: 'Improve provider selection, fallback, metadata, or health behavior.',
    defaultGoal: 'Fix provider routing so BertOS chooses verified providers honestly and shows useful routing reasons.',
    likelyFiles: ['lib/bertos/router.ts', 'lib/bertos/providers/*', 'app/api/providers/status/route.ts', 'components/bertos/*'],
    provider: 'codex-cli',
    providerReason: 'Using Codex because this is implementation across router and API code.',
    validationProfile: 'strict',
    riskLevel: 'high',
    scope: 'medium',
    avoid: ['Do not hallucinate providers.', 'Do not default to paid APIs unless configured.', 'Do not fake status.'],
    worktreeRecommended: true,
  },
  {
    id: 'daemon-bug-fix',
    label: 'Daemon bug fix',
    description: 'Fix local daemon reliability, Windows execution, file safety, or CLI bridge.',
    defaultGoal: 'Fix a daemon bug while preserving Windows-safe execution and repo safety checks.',
    likelyFiles: ['scripts/bertos-daemon.mjs', 'cli/bertos.mjs', 'app/api/local-daemon/*'],
    provider: 'codex-cli',
    providerReason: 'Using Codex because this is repo automation and implementation work.',
    validationProfile: 'strict',
    riskLevel: 'high',
    scope: 'medium',
    avoid: ['Do not expose secrets.', 'Do not edit outside repo.', 'Do not weaken command allowlists.'],
    worktreeRecommended: true,
  },
  {
    id: 'telegram-integration',
    label: 'Telegram integration',
    description: 'Plan or implement secure Telegram notifications/control.',
    defaultGoal: 'Add or improve Telegram bridge infrastructure with secure token handling and approval-only actions.',
    likelyFiles: ['lib/bertos/*', 'app/api/*', 'components/bertos/settings/*'],
    provider: 'gemini-cli',
    providerReason: 'Using Gemini first because this needs integration planning before implementation.',
    validationProfile: 'strict',
    riskLevel: 'high',
    scope: 'large',
    avoid: ['Do not expose bot tokens.', 'Do not auto-approve patches.', 'Do not add fake bot success states.'],
    worktreeRecommended: true,
    planFirst: true,
  },
  {
    id: 'hermes-integration',
    label: 'Hermes integration',
    description: 'Plan or improve Hermes Agent connector behavior.',
    defaultGoal: 'Integrate Hermes as an optional verified provider/agent connector without duplicating the provider system.',
    likelyFiles: ['lib/bertos/providers/*', 'app/api/hermes/*', 'components/bertos/settings/*'],
    provider: 'gemini-cli',
    providerReason: 'Using Gemini first because this is connector architecture and integration planning.',
    validationProfile: 'strict',
    riskLevel: 'high',
    scope: 'large',
    avoid: ['Do not fake Hermes online state.', 'Do not expose HERMES_API_KEY.', 'Do not make Hermes required.'],
    worktreeRecommended: true,
    planFirst: true,
  },
  {
    id: 'github-worktree',
    label: 'GitHub/worktree task',
    description: 'Plan repo attachment, worktrees, branches, or GitHub workflows.',
    defaultGoal: 'Design a safe worktree/GitHub workflow that keeps main stable and never pushes without approval.',
    likelyFiles: ['app/api/worktrees/*', 'components/bertos/projects/*', 'scripts/*'],
    provider: 'gemini-cli',
    providerReason: 'Using Gemini first because this needs workflow planning across repo and UI surfaces.',
    validationProfile: 'strict',
    riskLevel: 'high',
    scope: 'large',
    avoid: ['Do not auto-push.', 'Do not run destructive git commands.', 'Do not create fake worktrees.'],
    worktreeRecommended: true,
    planFirst: true,
  },
  {
    id: 'smoke-tests',
    label: 'Test/smoke script creation',
    description: 'Add focused validation, safety, or smoke scripts.',
    defaultGoal: 'Create focused tests or smoke scripts for a real BertOS workflow.',
    likelyFiles: ['scripts/*', 'package.json', 'app/api/*'],
    provider: 'codex-cli',
    providerReason: 'Using Codex because this is implementation of validation code.',
    validationProfile: 'strict',
    riskLevel: 'medium',
    scope: 'medium',
    avoid: ['Do not add brittle fake tests.', 'Do not require unavailable secrets.', 'Do not weaken existing checks.'],
  },
  {
    id: 'refactor',
    label: 'Refactor',
    description: 'Plan and perform a scoped refactor.',
    defaultGoal: 'Refactor one focused subsystem while preserving behavior and validation.',
    likelyFiles: ['components/bertos/*', 'lib/bertos/*'],
    provider: 'claude-code',
    providerReason: 'Using Claude because this needs architecture/refactor review before implementation.',
    validationProfile: 'standard',
    riskLevel: 'medium',
    scope: 'medium',
    avoid: ['Do not refactor unrelated systems.', 'Do not change public behavior without a reason.', 'Do not skip validation.'],
  },
  {
    id: 'documentation',
    label: 'Documentation',
    description: 'Improve setup, usage, or architecture docs.',
    defaultGoal: 'Update concise BertOS documentation for real local, daemon, provider, or workspace workflows.',
    likelyFiles: ['README.md', 'docs/*', 'AGENTS.md'],
    provider: 'ollama-pro',
    providerReason: 'Using Ollama first to reduce paid usage for documentation drafting.',
    validationProfile: 'fast',
    riskLevel: 'low',
    scope: 'small',
    avoid: ['Do not document fake features as complete.', 'Do not include secrets.', 'Do not reference Sylistly except safety guardrails.'],
  },
]

function operationLabel(operation: PatchFile['operation']) {
  if (operation === 'create') return 'Created file'
  if (operation === 'delete') return 'Deleted file'
  return 'Modified file'
}

function effectiveRiskLevel(proposal: PatchProposal): PatchProposal['riskLevel'] {
  if (proposal.files.some(file => file.operation === 'delete')) return 'high'
  return proposal.riskLevel
}

function validatePatchDryRun(proposal: PatchProposal) {
  const errors: string[] = []
  const seen = new Set<string>()
  let totalBytes = 0

  for (const file of proposal.files) {
    const normalized = file.path.replace(/\\/g, '/').trim()
    if (!normalized) errors.push('Patch contains an empty path.')
    if (normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) errors.push(`${file.path} is absolute; paths must be repo-relative.`)
    if (normalized.split('/').some(part => part === '..')) errors.push(`${file.path} contains path traversal.`)
    if (/(^|\/)(node_modules|\.git|\.next|dist|build|coverage|\.vercel)(\/|$)/i.test(normalized)) errors.push(`${file.path} targets an ignored/generated directory.`)
    if (/(^|\/)\.env(\.|$)/i.test(normalized) || /(secret|token|credential|private-key|api-key)/i.test(normalized)) errors.push(`${file.path} is blocked by secret/config safety rules.`)
    if (!['modify', 'create', 'delete'].includes(file.operation)) errors.push(`${file.path} has malformed action ${String(file.operation)}.`)
    if (seen.has(normalized)) errors.push(`${file.path} appears more than once in the patch.`)
    seen.add(normalized)
    const content = file.after ?? ''
    if (content.includes('\u0000')) errors.push(`${file.path} appears to contain binary content.`)
    if (content.length > MAX_PATCH_FILE_BYTES) errors.push(`${file.path} exceeds the per-file patch size limit.`)
    totalBytes += content.length
  }

  if (totalBytes > MAX_PATCH_TOTAL_BYTES) errors.push('Patch exceeds the total size limit.')
  return errors
}

function normalizeCommandText(commandText: unknown) {
  return typeof commandText === 'string' ? commandText.trim().replace(/\s+/g, ' ') : ''
}

function deriveClientSearchTerms(task: string) {
  const terms = [
    ...Array.from(task.matchAll(/"([^"]{2,80})"/g)).map(match => match[1]),
    ...task.split(/[^A-Za-z0-9]+/).filter(word => word.length >= 4).slice(0, 16),
  ]
  if (/\bsave\b/i.test(task)) terms.push('Save button', 'Save', 'saved', 'Revert', 'Path', 'saveActiveFile', 'Save current file', 'dirty ?')
  if (/\btooltip\b/i.test(task)) terms.push('title=', 'Tooltip', 'aria-label')
  return [...new Set(terms)].slice(0, 24)
}

function createTinyTestProposal(): PatchProposal {
  const stamp = new Date().toISOString()
  return {
    summary: 'Tiny deterministic patch smoke test. Creates a temporary file that can be reverted from patch history.',
    provider: 'BertOS deterministic smoke test',
    riskLevel: 'low',
    commandsToRun: ['npm run typecheck'],
    files: [{
      path: 'tmp/bertos-patch-loop-smoke.md',
      operation: 'create',
      after: [
        '# BertOS Patch Loop Smoke Test',
        '',
        `Created at: ${stamp}`,
        'This file is generated by the Workspace tiny test patch and should be reverted from patch history.',
        '',
      ].join('\n'),
    }],
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42) || 'bertos-task'
}

function estimateScope(goal: string, template: MissionTemplate): MissionScope {
  const normalized = goal.toLowerCase()
  if (template.scope === 'large') return 'large'
  if (/\b(everything|full|entire|all tabs|all providers|rewrite|autonomous|telegram|github|worktree)\b/.test(normalized)) return 'large'
  if (/\b(api|daemon|provider|router|workspace|terminal|patch|multiple files)\b/.test(normalized)) return 'medium'
  return template.scope
}

function recommendProvider(goal: string, template: MissionTemplate): { provider: AIModel; reason: string } {
  const normalized = goal.toLowerCase()
  if (/\b(implement|edit|patch|fix|bug|daemon|terminal|api|route|repo)\b/.test(normalized)) {
    return { provider: 'codex-cli', reason: 'Using Codex because this is an implementation or repo-edit task.' }
  }
  if (/\b(architecture|ui review|ux|refactor|layout|component quality)\b/.test(normalized)) {
    return { provider: 'claude-code', reason: 'Using Claude because this needs architecture, UI, or refactor-quality review.' }
  }
  if (/\b(plan|research|compare|integration|telegram|hermes|github|worktree|long context)\b/.test(normalized)) {
    return { provider: 'gemini-cli', reason: 'Using Gemini first because this needs broad planning or long-context analysis.' }
  }
  if (template.provider === 'ollama-pro') {
    return { provider: 'ollama-pro', reason: 'Using Ollama first to reduce paid usage for this low-risk task.' }
  }
  return { provider: template.provider, reason: template.providerReason }
}

function getMissionWarnings(scope: MissionScope, riskLevel: PatchProposal['riskLevel'], runMode: MissionRunMode, template: MissionTemplate) {
  const warnings: string[] = []
  if (scope === 'large') warnings.push('This task is too broad. Split it into smaller missions or run a plan-only pass first.')
  if (scope === 'large' || riskLevel === 'high' || template.worktreeRecommended) warnings.push('This should use a worktree before implementation.')
  if (runMode === 'main' && (riskLevel === 'high' || scope === 'large')) warnings.push('This should not run on main unless you intentionally accept the risk.')
  if (template.planFirst) warnings.push('Use plan mode first, then run implementation and review as separate missions.')
  return warnings
}

function buildMissionPrompt({
  goal,
  template,
  provider,
  providerReason,
  validationProfile,
  scope,
  riskLevel,
  runMode,
  activeFile,
  openFiles,
}: {
  goal: string
  template: MissionTemplate
  provider: AIModel
  providerReason: string
  validationProfile: ValidationProfileId
  scope: MissionScope
  riskLevel: PatchProposal['riskLevel']
  runMode: MissionRunMode
  activeFile: string
  openFiles: string[]
}) {
  const validation = VALIDATION_PROFILES[validationProfile]
  const branchSlug = slugify(goal || template.defaultGoal)
  const contextFiles = Array.from(new Set([
    ...template.likelyFiles,
    activeFile,
    ...openFiles.slice(0, 5),
  ].filter(Boolean)))
  const warnings = getMissionWarnings(scope, riskLevel, runMode, template)
  const worktreeRecommendation = runMode === 'worktree' || warnings.some(warning => warning.includes('worktree'))
    ? `Create worktree: ../bertos-ai-os-worktrees/${branchSlug} on branch codex/${branchSlug}`
    : 'Run on main only after reviewing git status and keeping the patch scoped.'

  return [
    `Goal:\n${goal.trim() || template.defaultGoal}`,
    `Context files:\n${contextFiles.map(file => `- ${file}`).join('\n')}`,
    `Constraints:\n${[
      'Do not touch Sylistly.',
      'Do not fake output or provider status.',
      'Do not auto-push.',
      'Preserve daemon, Workspace, chat, provider routing, and Ollama Cloud.',
      ...template.avoid,
    ].map(item => `- ${item}`).join('\n')}`,
    `Provider recommendation:\n- ${provider}: ${providerReason}`,
    `Worktree recommendation:\n- ${worktreeRecommendation}`,
    `Validation profile: ${validation.label}\n${validation.commands.map(command => `- ${command}`).join('\n')}`,
    `Done when:\n${[
      'Implementation is scoped to the requested subsystem.',
      'Reviewable diff is produced before applying changes.',
      ...validation.commands.map(command => `${command} passes`),
      'Git status is reported.',
    ].map(item => `- ${item}`).join('\n')}`,
    `Risk level: ${riskLevel}`,
    `Estimated scope: ${scope}`,
    warnings.length ? `Warnings:\n${warnings.map(warning => `- ${warning}`).join('\n')}` : 'Warnings:\n- None',
  ].join('\n\n')
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap(node => node.type === 'dir' ? flattenFiles(node.children ?? []) : [node])
}

function getLanguage(path: string) {
  if (/\.(tsx|ts)$/.test(path)) return 'TypeScript'
  if (/\.(jsx|js|mjs|cjs)$/.test(path)) return 'JavaScript'
  if (/\.json$/.test(path)) return 'JSON'
  if (/\.mdx?$/.test(path)) return 'Markdown'
  if (/\.css$/.test(path)) return 'CSS'
  if (/\.ya?ml$/.test(path)) return 'YAML'
  return 'Text'
}

function commandToLabel(executable: string, args: string[]) {
  return [executable, ...args].join(' ')
}

function getChangedFiles(statusText?: string) {
  return (statusText ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.slice(3).trim())
}

function simpleDiff(before = '', after = '') {
  const oldLines = before.split(/\r?\n/)
  const newLines = after.split(/\r?\n/)
  let prefix = 0
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix += 1
  let oldSuffix = oldLines.length - 1
  let newSuffix = newLines.length - 1
  while (oldSuffix >= prefix && newSuffix >= prefix && oldLines[oldSuffix] === newLines[newSuffix]) {
    oldSuffix -= 1
    newSuffix -= 1
  }
  return {
    before: oldLines.slice(prefix, oldSuffix + 1),
    after: newLines.slice(prefix, newSuffix + 1),
    startLine: prefix + 1,
  }
}

function HealthCheckCard({ status, safe }: { status: WorkspaceStatus | null; safe: boolean }) {
  const items: Array<{ label: string; ok: boolean; detail?: string }> = [
    { label: 'Daemon connected', ok: Boolean(status?.online) },
    { label: 'Repo detected', ok: Boolean(status?.repo?.root) },
    { label: 'Git repo', ok: Boolean(status?.repo?.branch), detail: status?.repo?.branch },
    { label: 'Repo safety', ok: Boolean(status?.repo?.safeRepo), detail: status?.repo?.blockedReason },
    { label: 'Branch', ok: Boolean(status?.repo?.branch), detail: status?.repo?.branch ?? 'unknown' },
  ]
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <div className="mb-2 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-sky-400" />
        <h2 className="text-sm font-semibold text-zinc-200">Workspace Health</h2>
        <Badge variant={safe ? 'success' : 'warning'} className="ml-auto text-[10px]">{safe ? 'ready' : 'offline'}</Badge>
      </div>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2 text-[11px]">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', item.ok ? 'bg-emerald-400' : 'bg-zinc-600')} />
            <span className="text-zinc-400">{item.label}</span>
            {item.detail && <span className="ml-auto truncate text-zinc-600">{item.detail}</span>}
          </div>
        ))}
      </div>
      {!status?.online && (
        <p className="mt-2 text-[11px] text-zinc-600">
          Start the daemon: <code className="text-zinc-500">npm run bertos:daemon</code>
        </p>
      )}
    </section>
  )
}

function PerFileDebugTable({ perFile, activeFile, budget }: { perFile: PerFileDebug[]; activeFile: string; budget: number }) {
  if (!perFile.length) return null
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-zinc-800">
      <div className="border-b border-zinc-800 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Per-file context status
      </div>
      <div className="max-h-56 overflow-auto">
        {perFile.map(f => (
          <div key={f.path} className="flex items-start gap-2 border-b border-zinc-900 px-3 py-1.5 last:border-0">
            <span className={cn(
              'mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase',
              f.status === 'included' ? 'bg-emerald-500/20 text-emerald-300' :
              f.status === 'chunked' ? 'bg-amber-500/20 text-amber-300' :
              f.status === 'truncated' ? 'bg-orange-500/20 text-orange-300' :
              'bg-zinc-800 text-zinc-500'
            )}>
              {f.status}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="truncate font-mono text-[10px] text-zinc-300">{f.path}</span>
                {f.isActive && <span className="shrink-0 rounded bg-violet-500/20 px-1 py-0.5 text-[9px] text-violet-300">active</span>}
                {f.isForced && <span className="shrink-0 rounded bg-blue-500/20 px-1 py-0.5 text-[9px] text-blue-300">forced</span>}
                {f.isExplicit && <span className="shrink-0 rounded bg-sky-500/20 px-1 py-0.5 text-[9px] text-sky-300">explicit</span>}
              </div>
              {f.chars !== undefined && f.originalChars !== undefined && (
                <div className="mt-0.5 text-[10px] text-zinc-600">
                  {f.chars.toLocaleString()} / {f.originalChars.toLocaleString()} chars ({f.percentIncluded ?? 100}%)
                </div>
              )}
              {f.reason && <div className="mt-0.5 text-[10px] text-red-400">{f.reason}</div>}
            </div>
          </div>
        ))}
      </div>
      {activeFile && !perFile.some(f => f.path === activeFile && f.status !== 'omitted') && (
        <div className="border-t border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200">
          Active file not in context. Enable Force Active File to guarantee inclusion.
        </div>
      )}
    </div>
  )
}

function FileTree({
  nodes,
  activePath,
  query,
  onOpen,
}: {
  nodes: FileNode[]
  activePath: string
  query: string
  onOpen: (path: string) => void
}) {
  const normalizedQuery = query.trim().toLowerCase()
  return (
    <div className="space-y-0.5">
      {nodes.map(node => {
        const visible = !normalizedQuery || node.path.toLowerCase().includes(normalizedQuery) || node.type === 'dir'
        if (!visible) return null
        return (
          <div key={node.path}>
            <button
              onClick={() => node.type === 'file' && onOpen(node.path)}
              className={cn(
                'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors',
                node.type === 'file' ? 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5' : 'text-zinc-300',
                activePath === node.path && 'bg-violet-500/15 text-violet-200'
              )}
            >
              {node.type === 'dir'
                ? <FolderOpen className="w-3 h-3 text-zinc-600" />
                : <FileText className="w-3 h-3 text-zinc-600" />}
              <span className="truncate">{node.name}</span>
            </button>
            {node.type === 'dir' && node.children?.length ? (
              <div className="ml-3 border-l border-zinc-800/60 pl-1">
                <FileTree nodes={node.children} activePath={activePath} query={query} onOpen={onOpen} />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function Editor({
  tab,
  safe,
  onChange,
}: {
  tab?: OpenTab
  safe: boolean
  onChange: (content: string) => void
}) {
  const lines = (tab?.content ?? '').split(/\r?\n/).length
  return (
    <div className="grid h-full grid-cols-[52px_1fr] overflow-hidden bg-[#09090B]">
      <div className="select-none border-r border-zinc-900 bg-zinc-950/60 py-4 text-right font-mono text-xs leading-5 text-zinc-700">
        {Array.from({ length: Math.max(lines, 1) }, (_, index) => (
          <div key={index} className="px-3">{index + 1}</div>
        ))}
      </div>
      <textarea
        value={tab?.content ?? ''}
        onChange={event => onChange(event.target.value)}
        disabled={!safe || !tab}
        spellCheck={false}
        placeholder={safe ? 'Open a file from the explorer.' : 'Workspace unavailable until the local daemon is online and repo safety passes.'}
        className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-5 text-zinc-200 placeholder:text-zinc-700 outline-none"
      />
    </div>
  )
}

function DiffBlock({ file }: { file: PatchFile }) {
  const diff = simpleDiff(file.before ?? '', file.after ?? '')
  const diffText = [
    ...diff.before.map(line => `- ${line}`),
    ...diff.after.map(line => `+ ${line}`),
  ].join('\n')
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2 font-mono text-[11px] text-zinc-400">
        <span className="min-w-0 flex-1 truncate">{operationLabel(file.operation)} · {file.path} from line {diff.startLine}</span>
        {(diff.before.length > 0 || diff.after.length > 0) && (
          <>
            <span className="shrink-0 text-emerald-400">+{diff.after.length}</span>
            <span className="shrink-0 text-red-400">-{diff.before.length}</span>
          </>
        )}
        <button
          onClick={() => {
            void navigator.clipboard.writeText(diffText || file.after || file.before || '')
            toast.success('Diff copied.')
          }}
          className="shrink-0 rounded px-1 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-300"
        >
          Copy
        </button>
      </div>
      <div className="max-h-64 overflow-auto font-mono text-[11px] leading-5">
        {diff.before.length === 0 && diff.after.length === 0 ? (
          <div className="px-3 py-2 text-zinc-600">No textual diff detected.</div>
        ) : null}
        {diff.before.slice(0, 120).map((line, index) => (
          <div key={`old-${index}`} className="bg-red-500/10 px-3 text-red-200">
            <span className="mr-2 text-red-500">-</span>{line || ' '}
          </div>
        ))}
        {diff.after.slice(0, 120).map((line, index) => (
          <div key={`new-${index}`} className="bg-emerald-500/10 px-3 text-emerald-200">
            <span className="mr-2 text-emerald-500">+</span>{line || ' '}
          </div>
        ))}
      </div>
    </div>
  )
}

export function WorkspaceView() {
  const { pendingWorkspaceTask, setPendingWorkspaceTask } = useUIStore()
  const { health: daemonHealth, loading: daemonHealthLoading, refresh: refreshDaemonHealth } = useDaemonHealth()
  const [status, setStatus] = useState<WorkspaceStatus | null>(null)
  const [files, setFiles] = useState<FileNode[]>([])
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activeFile, setActiveFile] = useState('')
  const [fileSearch, setFileSearch] = useState('')
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([])
  const [terminalInput, setTerminalInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [task, setTask] = useState('')
  const [provider, setProvider] = useState<AIModel>('auto')
  const [missionGoal, setMissionGoal] = useState('')
  const [missionTemplateId, setMissionTemplateId] = useState('workspace-bug-fix')
  const [missionProfile, setMissionProfile] = useState<ValidationProfileId>('standard')
  const [missionRunMode, setMissionRunMode] = useState<MissionRunMode>('main')
  const [proposal, setProposal] = useState<PatchProposal | null>(null)
  const [proposalProvider, setProposalProvider] = useState<PatchResponse['provider'] | null>(null)
  const [patchDebug, setPatchDebug] = useState<PatchParseDebug | null>(null)
  const [patchRouteDebug, setPatchRouteDebug] = useState<PatchResponse['routeDebug'] | null>(null)
  const [patchError, setPatchError] = useState('')
  const [patchControlError, setPatchControlError] = useState('')
  const [patchChecksRunning, setPatchChecksRunning] = useState(false)
  const [patchCheckResults, setPatchCheckResults] = useState<PatchCheckResult[]>([])
  const [patchApplied, setPatchApplied] = useState(false)
  const [forceActiveFile, setForceActiveFile] = useState(true)
  const [detectedFiles, setDetectedFiles] = useState<string[]>([])
  const [contextSearchRunning, setContextSearchRunning] = useState(false)
  const [patchMetrics, setPatchMetrics] = useState<Record<string, PatchReliabilityProviderMetrics>>({})
  const [selectedPatchFiles, setSelectedPatchFiles] = useState<Set<string>>(new Set())
  const [patchHistory, setPatchHistory] = useState<PatchHistoryEntry[]>([])
  const [generatingPatch, setGeneratingPatch] = useState(false)
  const [applyingPatch, setApplyingPatch] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [generatingCommit, setGeneratingCommit] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const activeTab = tabs.find(tab => tab.path === activeFile)
  const dirty = Boolean(activeTab && activeTab.content !== activeTab.savedContent)
  const dirtyTabs = tabs.filter(tab => tab.content !== tab.savedContent)
  const runningTerminal = terminalEntries.some(entry => entry.running)
  const flatFiles = useMemo(() => flattenFiles(files), [files])
  const safe = Boolean(status?.online && status.repo?.safeRepo)
  const changedFiles = getChangedFiles(status?.repo?.status)
  const missionTemplate = TASK_TEMPLATES.find(template => template.id === missionTemplateId) ?? TASK_TEMPLATES[0]
  const missionScope = estimateScope(missionGoal, missionTemplate)
  const missionProvider = recommendProvider(missionGoal || missionTemplate.defaultGoal, missionTemplate)
  const missionRiskLevel: PatchProposal['riskLevel'] = missionScope === 'large' ? 'high' : missionTemplate.riskLevel
  const missionPrompt = useMemo(() => buildMissionPrompt({
    goal: missionGoal,
    template: missionTemplate,
    provider: missionProvider.provider,
    providerReason: missionProvider.reason,
    validationProfile: missionProfile,
    scope: missionScope,
    riskLevel: missionRiskLevel,
    runMode: missionRunMode,
    activeFile,
    openFiles: tabs.map(tab => tab.path),
  }), [activeFile, missionGoal, missionProfile, missionProvider.provider, missionProvider.reason, missionRiskLevel, missionRunMode, missionScope, missionTemplate, tabs])
  const missionWarnings = getMissionWarnings(missionScope, missionRiskLevel, missionRunMode, missionTemplate)
  const missionSlug = slugify(missionGoal || missionTemplate.defaultGoal)
  const proposalMetric = proposalProvider?.providerId ? patchMetrics[proposalProvider.providerId] : undefined
  const proposalMetricSummary = summarizePatchReliability(proposalMetric)
  const suggestedValidationCommands = (proposal?.commandsToRun ?? []).map(normalizeCommandText).filter(Boolean)
  const allowedSuggestedValidationCommands = suggestedValidationCommands.filter(command => VALIDATION_COMMANDS.has(command))
  const skippedSuggestedValidationCommands = suggestedValidationCommands.filter(command => !VALIDATION_COMMANDS.has(command))
  const canRunSuggestedChecks = Boolean(
    proposal &&
    safe &&
    !patchChecksRunning &&
    allowedSuggestedValidationCommands.length > 0
  )
  const needsMoreContext = Boolean(patchDebug?.context && patchDebug.context.snippetsCount === 0 && patchDebug.context.filesIncluded.length === 0)

  const saveWorkspaceState = useCallback((nextTabs: OpenTab[], nextActiveFile: string) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tabs: nextTabs.map(tab => ({ path: tab.path, language: tab.language })),
      activeFile: nextActiveFile,
    }))
  }, [])

  const setTabsAndPersist = useCallback((updater: (current: OpenTab[]) => OpenTab[], nextActive = activeFile) => {
    setTabs(current => {
      const next = updater(current)
      saveWorkspaceState(next, nextActive)
      return next
    })
  }, [activeFile, saveWorkspaceState])

  const appendTerminal = useCallback((entry: TerminalEntry) => {
    setTerminalEntries(current => {
      const next = [...current, entry].slice(-40)
      localStorage.setItem(TERMINAL_HISTORY_KEY, JSON.stringify(next.slice(-20)))
      return next
    })
  }, [])

  const appendPatchHistory = useCallback((entry: PatchHistoryEntry) => {
    setPatchHistory(current => {
      const next = [entry, ...current].slice(0, 20)
      localStorage.setItem(PATCH_HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const readRepoFile = useCallback(async (path: string): Promise<string> => {
    const res = await fetch(`/api/local-daemon/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Could not read ${path}`)
    return data.content ?? ''
  }, [])

  const writePatchFile = useCallback(async (
    file: PatchFile,
    options: { patchHistoryId?: string; confirmDelete?: boolean } = {},
  ) => {
    const body = file.operation === 'delete'
      ? {
          path: file.path,
          operation: 'delete',
          confirm: options.confirmDelete === true,
          patchHistoryId: options.patchHistoryId,
          confirmPatchHistoryId: options.patchHistoryId,
        }
      : {
          path: file.path,
          operation: file.operation === 'create' ? 'create' : 'write',
          content: file.after ?? '',
        }

    const res = await fetch('/api/local-daemon/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Could not ${file.operation} ${file.path}`)
    return data
  }, [])

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/local-daemon/status', { cache: 'no-store' })
    const data = await res.json()
    setStatus(data)
  }, [])

  const loadFiles = useCallback(async () => {
    const res = await fetch('/api/local-daemon/files', { cache: 'no-store' })
    const data = await res.json()
    setFiles(data.files ?? [])
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([loadStatus(), loadFiles()])
    } finally {
      setLoading(false)
    }
  }, [loadFiles, loadStatus])

  const openFile = useCallback(async (path: string) => {
    const existing = tabs.find(tab => tab.path === path)
    if (existing) {
      setActiveFile(path)
      saveWorkspaceState(tabs, path)
      return
    }

    const res = await fetch(`/api/local-daemon/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Could not open file.')
      return
    }

    const tab: OpenTab = {
      path,
      content: data.content ?? '',
      savedContent: data.content ?? '',
      language: getLanguage(path),
    }
    const nextTabs = [...tabs, tab]
    setTabs(nextTabs)
    setActiveFile(path)
    saveWorkspaceState(nextTabs, path)
  }, [saveWorkspaceState, tabs])

  useEffect(() => {
    const restoredTerminal = localStorage.getItem(TERMINAL_HISTORY_KEY)
    if (restoredTerminal) {
      try { setTerminalEntries(JSON.parse(restoredTerminal)) } catch { /* ignore stale cache */ }
    }
    const restoredPatches = localStorage.getItem(PATCH_HISTORY_KEY)
    if (restoredPatches) {
      try { setPatchHistory(JSON.parse(restoredPatches)) } catch { localStorage.removeItem(PATCH_HISTORY_KEY) }
    }
    setPatchMetrics(readPatchReliabilityMetrics())
    refresh()
  }, [refresh])

  useEffect(() => {
    const restored = localStorage.getItem(STORAGE_KEY)
    if (!restored || flatFiles.length === 0 || tabs.length > 0) return
    let cancelled = false
    try {
      const parsed = JSON.parse(restored) as { tabs?: { path: string }[]; activeFile?: string }
      const paths = (parsed.tabs ?? []).map(tab => tab.path).filter(path => flatFiles.some(file => file.path === path)).slice(0, 6)
      Promise.all(paths.map(async path => {
        const res = await fetch(`/api/local-daemon/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
        if (!res.ok) return null
        const data = await res.json()
        return {
          path,
          content: data.content ?? '',
          savedContent: data.content ?? '',
          language: getLanguage(path),
        } satisfies OpenTab
      })).then(restoredTabs => {
        if (cancelled) return
        const nextTabs = restoredTabs.filter((tab): tab is OpenTab => Boolean(tab))
        setTabs(nextTabs)
        setActiveFile(parsed.activeFile && paths.includes(parsed.activeFile) ? parsed.activeFile : nextTabs[0]?.path ?? '')
      })
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    return () => { cancelled = true }
  }, [flatFiles, openFile, tabs.length])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveActiveFile()
      }
      if (mod && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  useEffect(() => {
    if (pendingWorkspaceTask) {
      setTask(pendingWorkspaceTask)
      setDetectedFiles(extractFileNamesFromTask(pendingWorkspaceTask))
      setPendingWorkspaceTask(null)
    }
  }, [pendingWorkspaceTask, setPendingWorkspaceTask])

  const updateActiveContent = (content: string) => {
    setTabsAndPersist(current => current.map(tab => tab.path === activeFile ? { ...tab, content } : tab))
  }

  const closeTab = (path: string) => {
    const tab = tabs.find(item => item.path === path)
    if (tab && tab.content !== tab.savedContent && !window.confirm(`${path} has unsaved changes. Close it anyway?`)) return
    const nextTabs = tabs.filter(item => item.path !== path)
    const nextActive = activeFile === path ? nextTabs.at(-1)?.path ?? '' : activeFile
    setTabs(nextTabs)
    setActiveFile(nextActive)
    saveWorkspaceState(nextTabs, nextActive)
  }

  const saveActiveFile = async () => {
    if (!activeTab || !dirty || !safe) return
    const res = await fetch('/api/local-daemon/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: activeTab.path, content: activeTab.content }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Save failed.')
      return
    }
    setTabsAndPersist(current => current.map(tab => tab.path === activeTab.path ? { ...tab, savedContent: tab.content } : tab))
    toast.success(`Saved ${activeTab.path}`)
    await loadStatus()
  }

  const reloadActiveFile = async () => {
    if (!activeTab) return
    if (dirty && !window.confirm('Discard unsaved changes and reload this file?')) return
    const res = await fetch(`/api/local-daemon/file?path=${encodeURIComponent(activeTab.path)}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Reload failed.')
      return
    }
    setTabsAndPersist(current => current.map(tab => tab.path === activeTab.path ? {
      ...tab,
      content: data.content ?? '',
      savedContent: data.content ?? '',
    } : tab))
  }

  const runCommand = async (command: { label: string; executable: string; args: readonly string[]; timeoutMs?: number }) => {
    if (!safe) return
    const id = `${Date.now()}-${command.label}`
    appendTerminal({
      id,
      label: command.label,
      stdout: 'Running...',
      timestamp: Date.now(),
      running: true,
    })
    const res = await fetch('/api/local-daemon/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    })
    const data = await res.json()
    setTerminalEntries(current => current.map(entry => entry.id === id ? {
      ...entry,
      stdout: data.stdout ?? '',
      stderr: data.stderr,
      error: data.error,
      exitCode: data.exitCode,
      durationMs: data.durationMs,
      running: false,
    } : entry))
    await loadStatus()
    return data
  }

  const runCustomCommand = async () => {
    const normalized = terminalInput.trim().replace(/\s+/g, ' ')
    const command = CUSTOM_COMMANDS.get(normalized)
    if (!command) {
      toast.error('Command is not allowlisted. Use the safe command buttons or an exact allowed command.')
      return
    }
    setTerminalInput('')
    await runCommand({ label: normalized, ...command })
  }

  const generatePatch = async () => {
    if (!task.trim()) {
      toast.error('Describe the change first.')
      return
    }
    setGeneratingPatch(true)
    setProposal(null)
    setProposalProvider(null)
    setPatchDebug(null)
    setPatchRouteDebug(null)
    setPatchError('')
    setPatchControlError('')
    setPatchCheckResults([])
    setPatchApplied(false)

    // Detect files mentioned in task text and add them to explicit include list
    const taskMentionedFiles = extractFileNamesFromTask(task)
    setDetectedFiles(taskMentionedFiles)

    // If forceActiveFile is on but active file isn't open, fetch it first
    let activeContent = activeTab?.content
    if (forceActiveFile && activeFile && !activeTab) {
      try {
        const res = await fetch(`/api/local-daemon/file?path=${encodeURIComponent(activeFile)}`, { cache: 'no-store' })
        const data = await res.json()
        if (res.ok && typeof data.content === 'string') {
          activeContent = data.content
        } else {
          toast.warning(`Could not fetch active file content for ${activeFile}. Proceeding without it.`)
        }
      } catch {
        toast.warning(`Failed to fetch active file ${activeFile}. Proceeding without it.`)
      }
    }

    try {
      const res = await fetch('/api/workspace/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          provider,
          forceActiveFile,
          explicitIncludePaths: taskMentionedFiles,
          context: {
            repo: status?.repo,
            activeFile,
            activeContent,
            openTabs: tabs.map(tab => ({
              path: tab.path,
              content: tab.content,
            })),
            fileTree: flatFiles.map(file => file.path),
            gitStatus: status?.repo?.status,
            terminalOutput: terminalEntries.slice(-5).map(entry => [
              `$ ${entry.label}`,
              entry.stdout,
              entry.stderr,
              entry.error,
            ].filter(Boolean).join('\n')).join('\n\n'),
            memories: MEMORY_FACTS,
          },
        }),
      })
      const data = await res.json() as PatchResponse
      setPatchDebug(data.debug ?? null)
      setPatchRouteDebug(data.routeDebug ?? null)
      setPatchError(data.error ?? '')
      if (!res.ok || !data.ok || !data.proposal) {
        const providerId = data.provider?.providerId ?? provider
        recordPatchReliabilityEvent({ type: 'generation', providerId, validJson: false, latencyMs: data.provider?.latencyMs })
        setPatchMetrics(readPatchReliabilityMetrics())
        throw new Error(data.error || 'Patch generation failed.')
      }
      const hydratedFiles = await Promise.all(data.proposal.files.map(async file => {
        const open = tabs.find(tab => tab.path === file.path)
        let before = file.before ?? open?.savedContent
        let operation = file.operation

        if (before === undefined && file.operation !== 'create') {
          before = await readRepoFile(file.path)
        }

        if (file.operation === 'create') {
          try {
            before = await readRepoFile(file.path)
            operation = 'modify'
          } catch {
            before = ''
          }
        }

        return {
          ...file,
          operation,
          before: before ?? '',
        }
      }))
      setProposal({ ...data.proposal, files: hydratedFiles })
      setProposalProvider(data.provider ?? null)
      setSelectedPatchFiles(new Set(hydratedFiles.map(file => file.path)))
      recordPatchReliabilityEvent({
        type: 'generation',
        providerId: data.provider?.providerId ?? data.proposal.provider ?? provider,
        validJson: true,
        latencyMs: data.provider?.latencyMs,
      })
      setPatchMetrics(readPatchReliabilityMetrics())
      toast.success(`Patch proposed by ${data.provider?.providerName ?? data.proposal.provider ?? 'provider'}`)
    } catch (error) {
      setPatchError(error instanceof Error ? error.message : 'Patch generation failed.')
      toast.error('Patch generation failed. Open Raw Output for details.')
    } finally {
      setGeneratingPatch(false)
    }
  }

  const generateTinyTestPatch = () => {
    const tiny = createTinyTestProposal()
    setProposal(tiny)
    setProposalProvider({
      providerId: 'bertos-smoke-test',
      providerName: 'BertOS Smoke Test',
      modelOrTool: 'deterministic',
      source: 'router',
      latencyMs: 0,
    })
    setPatchDebug({
      raw: JSON.stringify({
        summary: tiny.summary,
        files: tiny.files.map(file => ({ path: file.path, action: 'create', content: file.after ?? '' })),
        validation: { commands: tiny.commandsToRun },
      }, null, 2),
      rawDiagnostics: {
        byteLength: 0,
        charLength: 0,
        first500: 'Deterministic local smoke patch.',
        last500: 'Deterministic local smoke patch.',
      },
      extractedJsonCandidate: JSON.stringify({
        summary: tiny.summary,
        files: tiny.files.map(file => ({ path: file.path, action: 'create', content: file.after ?? '' })),
        validation: { commands: tiny.commandsToRun },
      }, null, 2),
      normalized: {
        summary: tiny.summary,
        files: tiny.files.map(file => ({ path: file.path, action: 'create', content: file.after ?? '' })),
        validation: { commands: tiny.commandsToRun },
      },
      repairAttempts: [{ attempt: 0, ok: true, rawPreview: 'Deterministic local smoke patch.' }],
    })
    setPatchRouteDebug({
      selectedProvider: 'bertos-smoke-test',
      routerMode: 'patch',
      taskType: 'code_patch',
      inventoryShortcutUsed: false,
    })
    setPatchError('')
    setPatchControlError('')
    setPatchCheckResults([])
    setPatchApplied(false)
    setSelectedPatchFiles(new Set(tiny.files.map(file => file.path)))
    toast.success('Tiny test patch generated. Apply it, then revert it from Patch history.')
  }

  const runTinyPatchSmokeTest = async () => {
    if (!safe) return toast.error('Workspace is not safe.')
    const stamp = Date.now()
    const path = `tmp/bertos-patch-loop-smoke-${stamp}.md`
    const patchHistoryId = `smoke-${stamp}`
    const createFile: PatchFile = {
      path,
      operation: 'create',
      after: `# BertOS Patch Loop Smoke Test\n\nCreated at ${new Date(stamp).toISOString()}\n`,
    }
    const modifyFile: PatchFile = {
      path,
      operation: 'modify',
      before: createFile.after,
      after: `${createFile.after}\nPatched line: dry-run validation, apply, and revert succeeded.\n`,
    }
    const validationErrors = validatePatchDryRun({
      summary: 'Tiny smoke test',
      provider: 'BertOS deterministic smoke test',
      files: [createFile, modifyFile],
      commandsToRun: [],
      riskLevel: 'low',
    })
    if (validationErrors.length) {
      setPatchError(`Tiny smoke dry-run failed: ${validationErrors.join(' ')}`)
      return toast.error('Tiny smoke dry-run failed.')
    }

    setApplyingPatch(true)
    setPatchControlError('')
    setPatchCheckResults([])
    try {
      await writePatchFile(createFile, { patchHistoryId })
      await writePatchFile(modifyFile, { patchHistoryId })
      await writePatchFile({ ...modifyFile, operation: 'delete' }, {
        patchHistoryId,
        confirmDelete: true,
      })
      setPatchDebug({
      raw: JSON.stringify({
          summary: 'Tiny deterministic smoke test completed.',
          files: [{ path, action: 'create', content: createFile.after }],
          validation: { commands: [] },
        }, null, 2),
        rawDiagnostics: {
          byteLength: 0,
          charLength: 0,
          first500: 'Create, modify, and safe delete completed through daemon.',
          last500: 'Create, modify, and safe delete completed through daemon.',
        },
        extractedJsonCandidate: JSON.stringify({
          summary: 'Tiny deterministic smoke test completed.',
          files: [{ path, action: 'create', content: createFile.after }],
          validation: { commands: [] },
        }, null, 2),
        normalized: {
          summary: 'Tiny deterministic smoke test completed.',
          files: [{ path, action: 'create', content: createFile.after ?? '' }],
          validation: { commands: [] },
        },
        repairAttempts: [{ attempt: 0, ok: true, rawPreview: 'Create, modify, and safe delete completed through daemon.' }],
      })
      setPatchRouteDebug({
        selectedProvider: 'bertos-smoke-test',
        routerMode: 'patch',
        taskType: 'code_patch',
        inventoryShortcutUsed: false,
      })
      setPatchError('')
      setPatchApplied(true)
      await refresh()
      toast.success('Tiny patch smoke test created, modified, and reverted a temp file.')
    } catch (error) {
      setPatchError(error instanceof Error ? error.message : 'Tiny patch smoke test failed.')
      toast.error('Tiny patch smoke test failed.')
    } finally {
      setApplyingPatch(false)
    }
  }

  const applyPatch = async () => {
    if (!proposal || selectedPatchFiles.size === 0) return
    if (!safe) return toast.error('Workspace is not safe.')
    const selectedFiles = proposal.files.filter(file => selectedPatchFiles.has(file.path))
    const dryRunErrors = validatePatchDryRun({ ...proposal, files: selectedFiles })
    if (dryRunErrors.length > 0) {
      setPatchError(`Dry-run validation blocked apply: ${dryRunErrors.join(' ')}`)
      toast.error('Dry-run patch validation blocked apply.')
      return
    }
    const hasDelete = selectedFiles.some(file => file.operation === 'delete')
    if (hasDelete && !window.confirm('This patch deletes one or more files. Apply selected delete operations through the safe daemon endpoint?')) return
    setApplyingPatch(true)
    const appliedFiles: string[] = []
    const patchHistoryId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      for (const file of selectedFiles) {
        await writePatchFile(file, {
          patchHistoryId,
          confirmDelete: file.operation === 'delete',
        })
        appliedFiles.push(file.path)
        const existing = tabs.find(tab => tab.path === file.path)
        if (file.operation === 'delete') {
          setTabs(current => current.filter(tab => tab.path !== file.path))
          if (activeFile === file.path) setActiveFile('')
        } else if (existing) {
          setTabs(current => current.map(tab => tab.path === file.path
            ? { ...tab, content: file.after ?? '', savedContent: file.after ?? '' }
            : tab))
        }
      }
      if (appliedFiles.length) {
        appendPatchHistory({
          id: patchHistoryId,
          summary: proposal.summary,
          provider: proposalProvider?.providerName ?? proposal.provider,
          riskLevel: effectiveRiskLevel(proposal),
          files: proposal.files.filter(file => appliedFiles.includes(file.path)),
          appliedFiles,
          timestamp: Date.now(),
        })
        recordPatchReliabilityEvent({
          type: 'apply',
          providerId: proposalProvider?.providerId ?? proposal.provider ?? 'unknown-provider',
          success: true,
        })
        setPatchMetrics(readPatchReliabilityMetrics())
      }
      toast.success('Approved patch files applied.')
      setPatchApplied(true)
      setPatchControlError('')
      await refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Patch apply failed.'
      setPatchControlError(message)
      toast.error(message)
    } finally {
      setApplyingPatch(false)
    }
  }

  const runSuggestedCommands = async () => {
    if (!proposal) {
      setPatchControlError('No patch proposal exists yet.')
      return toast.error('No patch proposal exists yet.')
    }
    if (!safe) {
      setPatchControlError('Suggested checks require the local daemon and a safe BertOS repo.')
      return toast.error('Suggested checks require the local daemon.')
    }
    if (suggestedValidationCommands.length === 0) {
      setPatchControlError('This patch did not include validation commands.')
      return toast.message('This patch did not include validation commands.')
    }
    if (allowedSuggestedValidationCommands.length === 0) {
      const message = `No suggested checks are allowlisted. Skipped: ${suggestedValidationCommands.join(', ')}`
      setPatchControlError(message)
      setPatchCheckResults(suggestedValidationCommands.map(command => ({
        command,
        status: 'skipped',
        error: 'Command is not allowlisted for patch validation.',
      })))
      return toast.error('No suggested checks are allowlisted.')
    }

    setPatchChecksRunning(true)
    setPatchControlError('')
    const results: PatchCheckResult[] = skippedSuggestedValidationCommands.map(command => ({
      command,
      status: 'skipped',
      error: 'Command is not allowlisted for patch validation.',
    }))
    let ran = 0
    let passed = 0
    try {
      for (const commandText of allowedSuggestedValidationCommands) {
        const command = VALIDATION_COMMANDS.get(commandText)
        if (!command) continue
        ran += 1
        const result = await runCommand({ label: commandText, ...command })
        const exitCode = result?.exitCode
        const passedCommand = exitCode === 0
        if (passedCommand) passed += 1
        results.push({
          command: commandText,
          status: passedCommand ? 'passed' : 'failed',
          exitCode,
          error: result?.error || result?.stderr,
        })
      }
      setPatchCheckResults(results)
      if (ran > 0) {
        recordPatchReliabilityEvent({
          type: 'validation',
          providerId: proposalProvider?.providerId ?? proposal.provider ?? 'unknown-provider',
          success: passed === ran,
        })
        setPatchMetrics(readPatchReliabilityMetrics())
      }
      if (passed === ran) toast.success('Suggested checks passed.')
      else toast.error('One or more suggested checks failed.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Suggested checks failed to run.'
      setPatchControlError(message)
      toast.error(message)
    } finally {
      setPatchChecksRunning(false)
    }
  }

  const searchRepoForPatchContext = async () => {
    if (!safe) return toast.error('Repo search requires the local daemon.')
    setContextSearchRunning(true)
    try {
      const terms = deriveClientSearchTerms(task)
      const res = await fetch('/api/local-daemon/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terms,
          globs: ['components/', 'app/', 'lib/'],
          maxResults: 20,
        }),
      })
      const data = await res.json() as {
        results?: Array<{ path: string; matchedTerms: string[]; snippets: unknown[] }>
        error?: string
      }
      if (!res.ok) throw new Error(data.error || `Search failed with HTTP ${res.status}.`)
      const results = data.results ?? []
      setPatchControlError(results.length
        ? `Search found ${results.length} likely file(s): ${results.slice(0, 5).map(result => result.path).join(', ')}. Generate patch again to include this context.`
        : 'Search found no relevant files. Open the target file manually, then Generate patch again.')
      toast.message(results.length ? `Search found ${results.length} likely file(s).` : 'Search found no relevant files.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Repo search failed.'
      setPatchControlError(message)
      toast.error(message)
    } finally {
      setContextSearchRunning(false)
    }
  }

  const useCurrentOpenFilesForContext = () => {
    if (!tabs.length) {
      setPatchControlError('No files are currently open. Open the likely component file first.')
      return toast.message('No files are currently open.')
    }
    setPatchControlError(`Next patch generation will include ${tabs.length} open file(s): ${tabs.slice(0, 4).map(tab => tab.path).join(', ')}`)
    toast.success('Open files will be included on the next patch generation.')
  }

  const revertPatchHistoryEntry = async (entry: PatchHistoryEntry) => {
    if (!safe) return toast.error('Workspace is not safe.')
    const reversible = entry.files.filter(file =>
      file.operation === 'create' ||
      (file.operation === 'modify' && typeof file.before === 'string') ||
      (file.operation === 'delete' && typeof file.before === 'string')
    )
    const skipped = entry.files.filter(file => !reversible.includes(file)).map(file => file.path)

    if (!reversible.length) {
      toast.error('This patch has no safely reversible files.')
      return
    }

    const skippedText = skipped.length ? ` Unsupported files are skipped: ${skipped.join(', ')}` : ''
    if (!window.confirm(`Revert ${reversible.length} file operation(s) from this patch?${skippedText}`)) return

    try {
      for (const file of reversible) {
        if (file.operation === 'create') {
          await writePatchFile({ ...file, operation: 'delete' }, {
            patchHistoryId: entry.id,
            confirmDelete: true,
          })
          setTabs(current => current.filter(tab => tab.path !== file.path))
          if (activeFile === file.path) setActiveFile('')
        } else {
          await writePatchFile({ ...file, operation: 'modify', after: file.before ?? '' })
          setTabs(current => current.map(tab => tab.path === file.path
            ? { ...tab, content: file.before ?? '', savedContent: file.before ?? '' }
            : tab))
        }
      }
      toast.success('Patch reverted. Review git diff before committing.')
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Patch revert failed.')
    }
  }

  const generateCommitMessage = async () => {
    setGeneratingCommit(true)
    try {
      const diff = await runCommand({ label: 'git diff', executable: 'git', args: ['diff'] })
      const res = await fetch('/api/workspace/commit-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diff: diff?.stdout, status: status?.repo?.status }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not generate commit message.')
      setCommitMessage(data.message)
      toast.success('Commit message drafted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Commit message failed.')
    } finally {
      setGeneratingCommit(false)
    }
  }

  const commitChanges = async () => {
    if (!commitMessage.trim()) return toast.error('Write or generate a commit message first.')
    if (!safe || status?.repo?.remote?.toLowerCase().includes('sylistly')) return toast.error('Git actions are blocked by repo safety.')
    if (!window.confirm('Stage current repo changes and create a local commit? This will not push.')) return
    await runCommand({ label: 'git add -A', executable: 'git', args: ['add', '-A'] })
    await runCommand({ label: `git commit -m "${commitMessage}"`, executable: 'git', args: ['commit', '-m', commitMessage], timeoutMs: 120000 })
    await refresh()
  }

  const copyActivePath = async () => {
    if (!activeFile) return
    await navigator.clipboard.writeText(activeFile)
    toast.success('File path copied.')
  }

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-zinc-800/50 bg-zinc-950/60 md:flex">
        <div className="flex items-center justify-between border-b border-zinc-800/50 px-3 py-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-semibold text-zinc-300">BertOS Workspace</span>
          </div>
          <button onClick={refresh} className="text-zinc-600 hover:text-zinc-300">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="border-b border-zinc-800/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            {safe ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
            <Badge variant={safe ? 'success' : 'warning'} className="text-[10px]">
              {safe ? 'Repo safe' : 'Local coding unavailable'}
            </Badge>
          </div>
          <p className="truncate text-[11px] text-zinc-500">{status?.repo?.root ?? status?.error ?? 'Checking daemon...'}</p>
          <p className="truncate text-[11px] text-zinc-600">{status?.repo?.remote ?? 'Start npm run bertos:daemon'}</p>
          {status?.repo?.blockedReason && <p className="text-[11px] text-amber-300">{status.repo.blockedReason}</p>}
        </div>

        <div className="border-b border-zinc-800/50 p-2">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-zinc-600" />
            <input
              ref={searchRef}
              value={fileSearch}
              onChange={event => setFileSearch(event.target.value)}
              placeholder="Quick open (Ctrl+P)"
              className="w-full bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-700"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 p-2">
          {safe ? <FileTree nodes={files} activePath={activeFile} query={fileSearch} onOpen={openFile} /> : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">
              Local coding requires running BertOS locally with <code>npm run bertos:daemon</code>. Vercel can still use Ollama Cloud chat, but cannot edit your Windows files.
            </div>
          )}
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="p-3 pb-0">
          <RouteHero
            eyebrow="active project bay"
            title="Workspace Command Deck"
            subtitle="A guarded local workbench for file inspection, patch reliability, terminal proof, and explicit save/apply actions. The daemon and safe-repo gate decide what can run."
            status={loading || runningTerminal || generatingPatch ? 'active' : safe ? 'nominal' : 'warning'}
            seal={<FolderOpen className="h-5 w-5" />}
            metrics={[
              { label: 'Repo', value: safe ? 'safe' : 'locked', detail: status?.repo?.branch ?? 'daemon pending', tone: safe ? 'emerald' : 'amber' },
              { label: 'Files Indexed', value: flatFiles.length, detail: activeFile || 'no active file', tone: 'cyan' },
              { label: 'Dirty Tabs', value: dirtyTabs.length, detail: dirty ? 'unsaved work present' : 'all saved', tone: dirtyTabs.length ? 'amber' : 'zinc' },
              { label: 'Terminal', value: terminalEntries.length, detail: runningTerminal ? 'command running' : 'local proof log', tone: runningTerminal ? 'cyan' : 'bronze' },
            ]}
          />
        </div>
        <DaemonHealthBanner
          health={daemonHealth}
          loading={daemonHealthLoading}
          onRefresh={refreshDaemonHealth}
          compact={safe}
          className="m-3 mb-0"
        />
        <div className="flex min-h-[48px] items-center gap-2 border-b border-zinc-800/50 px-3">
          <GitBranch className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-zinc-400">{status?.repo?.branch ?? 'unknown branch'}</span>
          <span className="text-xs text-zinc-700">|</span>
          <span className="truncate text-xs text-zinc-500">{activeFile || `${flatFiles.length} files indexed`}</span>
          {dirtyTabs.length > 0 && <Badge variant="warning" className="ml-1 text-[10px]">{dirtyTabs.length} unsaved</Badge>}
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={copyActivePath} disabled={!activeFile}><Copy className="w-3.5 h-3.5" />Path</Button>
            <Button size="sm" variant="ghost" onClick={reloadActiveFile} disabled={!activeTab}><RotateCcw className="w-3.5 h-3.5" />Revert</Button>
            <Button size="sm" variant="secondary" onClick={saveActiveFile} disabled={!dirty || !safe}>
              <Save className="w-3.5 h-3.5" />{dirty ? 'Save' : 'Saved'}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-[38px] items-end gap-1 overflow-x-auto border-b border-zinc-800/50 bg-zinc-950/40 px-2 pt-1">
              {tabs.length === 0 ? (
                <div className="px-2 pb-2 text-xs text-zinc-600">Open a file to start editing.</div>
              ) : tabs.map(tab => {
                const isDirty = tab.content !== tab.savedContent
                return (
                  <button
                    key={tab.path}
                    onClick={() => setActiveFile(tab.path)}
                    className={cn(
                      'flex max-w-56 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 text-xs',
                      activeFile === tab.path
                        ? 'border-zinc-700 bg-[#09090B] text-zinc-200'
                        : 'border-transparent bg-zinc-900/30 text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', isDirty ? 'bg-amber-400' : 'bg-zinc-700')} />
                    <span className="truncate">{tab.path.split(/[\\/]/).pop()}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={event => { event.stopPropagation(); closeTab(tab.path) }}
                      onKeyDown={event => { if (event.key === 'Enter') closeTab(tab.path) }}
                      className="rounded p-0.5 hover:bg-white/10"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="min-h-0 flex-1">
              <Editor tab={activeTab} safe={safe} onChange={updateActiveContent} />
            </div>

            <div className="h-72 border-t border-zinc-800/50 bg-zinc-950/80">
              <div className="flex items-center gap-2 border-b border-zinc-800/50 px-3 py-2">
                <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Safe Terminal</span>
                <div className="ml-auto flex flex-wrap gap-1">
                  {SAFE_COMMANDS.map(command => (
                    <button
                      key={command.label}
                      disabled={!safe}
                      onClick={() => runCommand(command)}
                      className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-200 disabled:opacity-40"
                    >
                      {command.label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setTerminalEntries([])
                      localStorage.removeItem(TERMINAL_HISTORY_KEY)
                    }}
                    className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-200"
                  >
                    clear
                  </button>
                </div>
              </div>
              <div className="flex border-b border-zinc-800/50">
                <input
                  value={terminalInput}
                  onChange={event => setTerminalInput(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') void runCustomCommand() }}
                  placeholder="Custom safe command, e.g. npm run typecheck"
                  className="flex-1 bg-transparent px-3 py-2 font-mono text-xs text-zinc-300 outline-none placeholder:text-zinc-700"
                />
                <Button size="sm" variant="ghost" onClick={runCustomCommand} disabled={!safe || !terminalInput.trim()}>
                  <Play className="w-3.5 h-3.5" />Run
                </Button>
              </div>
              <ScrollArea className="h-[214px]">
                <div className="space-y-3 p-3 font-mono text-xs">
                  {terminalEntries.length === 0 ? (
                    <div className="text-zinc-600">Run a safe command. Output is never faked.</div>
                  ) : terminalEntries.map(entry => (
                    <div key={entry.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                      <div className="mb-2 flex items-center gap-2 text-zinc-500">
                        {entry.running ? <Loader2 className="w-3 h-3 animate-spin" /> : <PanelBottom className="w-3 h-3" />}
                        <span>$ {entry.label}</span>
                        <span className="ml-auto">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        {entry.exitCode !== undefined && <Badge variant={entry.exitCode === 0 ? 'success' : 'error'} className="text-[10px]">exit {entry.exitCode}</Badge>}
                      </div>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-zinc-400">{entry.stdout}</pre>
                      {entry.stderr && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-amber-300">{entry.stderr}</pre>}
                      {entry.error && <pre className="mt-2 whitespace-pre-wrap text-red-300">{entry.error}</pre>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </section>

          <aside className="hidden w-[430px] shrink-0 flex-col border-l border-zinc-800/50 bg-zinc-950/50 xl:flex">
            <ScrollArea className="flex-1">
              <div className="space-y-4 p-4">
                <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <Clipboard className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-semibold text-zinc-200">Mission Builder</h2>
                    <Badge variant={missionScope === 'large' ? 'error' : missionScope === 'medium' ? 'warning' : 'success'} className="ml-auto text-[10px]">
                      {missionScope}
                    </Badge>
                  </div>
                  <textarea
                    value={missionGoal}
                    onChange={event => setMissionGoal(event.target.value)}
                    placeholder="Rough request, e.g. fix chat scrolling or add a provider status smoke check."
                    className="min-h-20 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-700"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select
                      value={missionTemplateId}
                      onChange={event => {
                        const nextTemplate = TASK_TEMPLATES.find(template => template.id === event.target.value)
                        setMissionTemplateId(event.target.value)
                        if (nextTemplate) {
                          setMissionProfile(nextTemplate.validationProfile)
                          setMissionRunMode(nextTemplate.worktreeRecommended ? 'worktree' : 'main')
                        }
                      }}
                      className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300 outline-none"
                    >
                      {TASK_TEMPLATES.map(template => (
                        <option key={template.id} value={template.id}>{template.label}</option>
                      ))}
                    </select>
                    <select
                      value={missionProfile}
                      onChange={event => setMissionProfile(event.target.value as ValidationProfileId)}
                      className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300 outline-none"
                    >
                      {Object.entries(VALIDATION_PROFILES).map(([id, profile]) => (
                        <option key={id} value={id}>{profile.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select
                      value={missionRunMode}
                      onChange={event => setMissionRunMode(event.target.value as MissionRunMode)}
                      className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300 outline-none"
                    >
                      <option value="main">Run on main</option>
                      <option value="worktree">Create worktree</option>
                    </select>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-2 py-1.5 text-[11px] text-zinc-500">
                      {missionProvider.reason}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-[11px] text-zinc-500">
                    <div className="flex items-center gap-2">
                      <Badge variant="info" className="text-[10px]">{missionProvider.provider}</Badge>
                      <span>{VALIDATION_PROFILES[missionProfile].commands.join(' / ')}</span>
                    </div>
                    <div>
                      Worktree: {missionRunMode === 'worktree'
                        ? `../bertos-ai-os-worktrees/${missionSlug} -> codex/${missionSlug}`
                        : 'main branch after review'}
                    </div>
                    <div>{missionTemplate.description}</div>
                  </div>
                  {missionWarnings.length > 0 && (
                    <div className="mt-3 space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">
                      {missionWarnings.map(warning => <div key={warning}>- {warning}</div>)}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(missionPrompt)
                        toast.success('Mission prompt copied.')
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />Copy mission
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setTask(missionPrompt)
                        setProvider(missionProvider.provider)
                        toast.success('Mission loaded into AI Patch Loop.')
                      }}
                    >
                      Use mission
                    </Button>
                  </div>
                  <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2">
                    <summary className="cursor-pointer text-xs text-zinc-400">How to get best Codex results</summary>
                    <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-zinc-600">
                      <li>Use scoped missions with goal, context, constraints, validation, and done-when.</li>
                      <li>Use worktrees for risky daemon, routing, git, or multi-file changes.</li>
                      <li>Run plan first for large integrations, then implementation, then review.</li>
                      <li>Use Team Mode only when the task needs planning, architecture review, and implementation.</li>
                      <li>Keep AGENTS.md for recurring rules so prompts stay shorter.</li>
                    </ul>
                  </details>
                </section>

                <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <h2 className="text-sm font-semibold text-zinc-200">AI Patch Loop</h2>
                    <Badge variant="info" className="ml-auto text-[10px]">review required</Badge>
                  </div>
                  <textarea
                    value={task}
                    onChange={event => {
                      setTask(event.target.value)
                      setDetectedFiles(extractFileNamesFromTask(event.target.value))
                    }}
                    placeholder="Describe a repo change. Mention file names (e.g. WorkspaceView.tsx) and they will be auto-loaded into context."
                    className="min-h-24 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-700"
                  />
                  {detectedFiles.length > 0 && (
                    <div className="mt-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-2">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-sky-400">Detected from task</div>
                      <div className="flex flex-wrap gap-1">
                        {detectedFiles.map(path => (
                          <span key={path} className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                            {path.split(/[\\/]/).pop()}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1 text-[10px] text-zinc-600">These paths will be explicitly included in context.</div>
                    </div>
                  )}
                  {patchDebug?.context && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-900/30 px-2.5 py-1.5 text-[11px] text-zinc-500">
                      <span>Context: <span className="text-zinc-300">{patchDebug.context.filesIncluded.length} file(s)</span></span>
                      <span>{(patchDebug.context.totalContextChars ?? 0).toLocaleString()} chars</span>
                      <span className={patchDebug.activeFileIncluded ? 'text-emerald-400' : 'text-zinc-600'}>
                        {patchDebug.activeFileIncluded ? 'active file included' : 'active file not in context'}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={provider}
                      onChange={event => setProvider(event.target.value as AIModel)}
                      className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300 outline-none"
                    >
                      <option value="auto">Auto</option>
                      <option value="claude-code">Claude</option>
                      <option value="codex-cli">Codex</option>
                      <option value="gemini-cli">Gemini</option>
                      <option value="ollama-pro">Ollama</option>
                    </select>
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-400 select-none">
                      <input
                        type="checkbox"
                        checked={forceActiveFile}
                        onChange={event => setForceActiveFile(event.target.checked)}
                        className="h-3 w-3 rounded accent-violet-500"
                      />
                      Force active file
                    </label>
                    <Button size="sm" onClick={generatePatch} disabled={!safe || generatingPatch || !task.trim()}>
                      {generatingPatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                      Generate patch
                    </Button>
                    <Button size="sm" variant="outline" onClick={generateTinyTestPatch} disabled={!safe || applyingPatch}>
                      Tiny patch
                    </Button>
                    <Button size="sm" variant="ghost" onClick={runTinyPatchSmokeTest} disabled={!safe || applyingPatch}>
                      Smoke
                    </Button>
                  </div>
                  {patchError && (
                    <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
                      <div className="font-medium">Patch generation did not produce apply-ready JSON.</div>
                      <div className="mt-1 text-red-200/80">{patchError}</div>
                      <div className="mt-2 text-red-200/70">
                        Suggested fix: open Raw Output, check the parse failure, then retry with a smaller task or use Mission Builder to scope the request.
                      </div>
                    </div>
                  )}
                  {proposalProvider && (
                    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-[11px] text-zinc-500">
                      Provider: {proposalProvider.providerName ?? proposalProvider.providerId} / {proposalProvider.modelOrTool ?? 'unknown'} / {proposalProvider.source ?? 'unknown'} / {proposalProvider.latencyMs ?? 'n/a'}ms
                      <div className="mt-1">
                        JSON reliability: {proposalMetricSummary.validJsonRate} / avg latency {proposalMetricSummary.averageLatencyMs}
                        {proposalMetricSummary.quarantined && (
                          <Badge variant="error" className="ml-2 text-[10px]">quarantined</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {(patchDebug || patchError) && (
                    <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2">
                      <summary className="cursor-pointer text-xs text-zinc-400">Raw Output / Parse Debug</summary>
                      <div className="mt-2 flex flex-wrap gap-2 border-b border-zinc-800 pb-2">
                        {patchDebug?.raw && (
                          <button
                            onClick={() => {
                              void navigator.clipboard.writeText(patchDebug.raw)
                              toast.success('Raw response copied.')
                            }}
                            className="rounded border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-200"
                          >
                            Copy response
                          </button>
                        )}
                        {patchDebug && (
                          <button
                            onClick={() => {
                              void navigator.clipboard.writeText(JSON.stringify(patchDebug, null, 2))
                              toast.success('Debug JSON copied.')
                            }}
                            className="rounded border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-200"
                          >
                            Copy debug JSON
                          </button>
                        )}
                      </div>
                      <div className="mt-2 space-y-3 text-[11px] text-zinc-500">
                        {patchRouteDebug && (
                          <div className="rounded border border-zinc-800 p-2">
                            Route: selected {patchRouteDebug.selectedProvider ?? 'unknown'} / mode {patchRouteDebug.routerMode ?? 'unknown'} / task {patchRouteDebug.taskType ?? 'unknown'} / inventory shortcut {patchRouteDebug.inventoryShortcutUsed ? 'used' : 'disabled'}
                          </div>
                        )}
                        {patchDebug?.parseError && (
                          <div className="rounded border border-red-500/20 bg-red-500/5 p-2 text-red-200">
                            Parse error: {patchDebug.parseError}
                          </div>
                        )}
                        {patchDebug?.serialization && (
                          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
                            <div className="mb-2 flex items-center justify-between text-zinc-400">
                              <span>Provider payload</span>
                              <button
                                onClick={() => {
                                  void navigator.clipboard.writeText(patchDebug?.serialization?.serializedPayloadPreview ?? '')
                                  toast.success('Payload preview copied.')
                                }}
                                className="text-[10px] text-zinc-600 hover:text-zinc-300"
                              >
                                Copy
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                              <div>Prompt chars: <span className="text-zinc-300">{patchDebug.serialization.promptChars.toLocaleString()}</span></div>
                              <div>Files: <span className="text-zinc-300">{patchDebug.serialization.includedFileCount}</span></div>
                              <div>Budget: <span className="text-zinc-300">{Math.round(patchDebug.serialization.promptChars / 1400)}%</span></div>
                              <div>Bodies: <span className="text-zinc-300">{patchDebug.serialization.fileBodiesPresent ? 'yes' : 'no'}</span></div>
                            </div>
                            {patchDebug.perFile && (
                              <PerFileDebugTable perFile={patchDebug.perFile} activeFile={activeFile} budget={140000} />
                            )}
                            {patchDebug.serialization.truncationWarnings.length > 0 && (
                              <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200">
                                <div className="font-medium">Truncation warnings</div>
                                {patchDebug.serialization.truncationWarnings.map(warning => (
                                  <div key={warning} className="mt-1">{warning}</div>
                                ))}
                              </div>
                            )}
                            <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black/40 p-2 text-zinc-600">
                              payload preview:{'\n'}{patchDebug.serialization.serializedPayloadPreview}
                            </pre>
                          </div>
                        )}
                        {patchDebug?.context && (
                          <div className="rounded border border-zinc-800 bg-zinc-900/40 p-2">
                            <div className="mb-2 text-zinc-400">Context summary</div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                              <div>Active file: <span className="text-zinc-300">{patchDebug.context.activeFile ? patchDebug.context.activeFile.split(/[\\/]/).pop() : 'none'}</span></div>
                              <div>Total chars: <span className="text-zinc-300">{(patchDebug.context.totalContextChars ?? 0).toLocaleString()}</span></div>
                              <div>Included: <span className="text-zinc-300">{patchDebug.context.filesIncluded.length} files</span></div>
                              <div>Snippets: <span className="text-zinc-300">{patchDebug.context.snippetsCount}</span></div>
                            </div>
                            {patchDebug.context.searchTerms.length > 0 && (
                              <div className="mt-1 text-zinc-600">Search: {patchDebug.context.searchTerms.slice(0, 8).join(', ')}</div>
                            )}
                            {needsMoreContext && (
                              <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-amber-200">
                                <div className="font-medium">Need more context</div>
                                <div className="mt-1">BertOS did not find matching files for this patch task.</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button size="sm" variant="outline" onClick={() => void searchRepoForPatchContext()} disabled={contextSearchRunning || !safe}>
                                    {contextSearchRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                    Search repo
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={useCurrentOpenFilesForContext}>
                                    Use current open files
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {patchDebug?.repairAttempts?.length ? (
                          <div>
                            <div className="mb-1 text-zinc-400">Parse timeline</div>
                            <div className="space-y-1">
                              {patchDebug.repairAttempts.map(attempt => (
                                <div key={`${attempt.attempt}-${attempt.providerId ?? 'initial'}`} className="rounded border border-zinc-800 p-2">
                                  Attempt {attempt.attempt} / {attempt.stage ?? 'initial'} / {attempt.providerId ?? 'initial'} / {attempt.ok ? 'valid' : 'failed'}
                                  {attempt.error && <div className="mt-1 text-red-300">{attempt.error}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {patchDebug?.rawDiagnostics && (
                          <div>
                            <div className="mb-1 text-zinc-400">Raw output diagnostics</div>
                            <div className="grid gap-2">
                              <div className="rounded border border-zinc-800 p-2">
                                bytes {patchDebug.rawDiagnostics.byteLength} / chars {patchDebug.rawDiagnostics.charLength}
                              </div>
                              <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black/40 p-2 text-zinc-500">
                                first 500 chars:{'\n'}{patchDebug.rawDiagnostics.first500}
                              </pre>
                              <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black/40 p-2 text-zinc-500">
                                last 500 chars:{'\n'}{patchDebug.rawDiagnostics.last500}
                              </pre>
                            </div>
                          </div>
                        )}
                        {patchDebug?.extractedJsonCandidate && (
                          <div>
                            <div className="mb-1 text-zinc-400">Extracted JSON candidate</div>
                            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black/40 p-2 text-zinc-400">
                              {patchDebug.extractedJsonCandidate}
                            </pre>
                          </div>
                        )}
                        {patchDebug?.normalized && (
                          <div>
                            <div className="mb-1 text-zinc-400">Normalized patch JSON</div>
                            <pre className="max-h-56 overflow-auto rounded border border-zinc-800 bg-black/40 p-2 text-zinc-400">
                              {JSON.stringify(patchDebug.normalized, null, 2)}
                            </pre>
                          </div>
                        )}
                        {patchDebug?.raw && (
                          <div>
                            <div className="mb-1 text-zinc-400">Raw provider output</div>
                            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black/40 p-2 text-zinc-500">
                              {patchDebug.raw}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </section>

                {proposal && (
                  <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-200">Patch proposal</h3>
                      <Badge variant={effectiveRiskLevel(proposal) === 'high' ? 'error' : effectiveRiskLevel(proposal) === 'medium' ? 'warning' : 'success'} className="text-[10px]">
                        {effectiveRiskLevel(proposal)} risk
                      </Badge>
                      {patchApplied && <Badge variant="success" className="text-[10px]">applied</Badge>}
                    </div>
                    <div className="mb-3 grid grid-cols-3 gap-2 text-[10px] text-zinc-500">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
                        1. Review<br /><span className="text-zinc-300">{proposal.files.length} file(s)</span>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
                        2. Apply<br /><span className="text-zinc-300">{patchApplied ? 'done' : 'pending'}</span>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
                        3. Check<br /><span className="text-zinc-300">{allowedSuggestedValidationCommands.length} safe</span>
                      </div>
                    </div>
                    {patchControlError && (
                      <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
                        {patchControlError}
                      </div>
                    )}
                    {proposal.files.some(file => file.operation === 'delete') && (
                      <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
                        This proposal includes delete operations. BertOS requires explicit confirmation and uses the daemon file-delete safety gate.
                      </div>
                    )}
                    <p className="mb-3 text-xs leading-relaxed text-zinc-500">{proposal.summary}</p>
                    <div className="space-y-3">
                      {proposal.files.length === 0 ? (
                        <div className="space-y-2">
                          <div className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-500">
                            No applyable patch was found. The provider responded but did not return file changes.
                            {patchDebug?.raw ? ' The raw response is shown below — it may contain a text explanation.' : ' Try opening the target file and running Generate patch again.'}
                          </div>
                          {patchDebug?.raw && (
                            <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/60">
                              <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
                                <span className="text-[11px] text-zinc-400">Provider response</span>
                                <button
                                  onClick={() => {
                                    void navigator.clipboard.writeText(patchDebug.raw)
                                    toast.success('Response copied.')
                                  }}
                                  className="text-[10px] text-zinc-600 hover:text-zinc-300"
                                >
                                  Copy
                                </button>
                              </div>
                              <pre className="max-h-72 overflow-auto whitespace-pre-wrap p-3 font-mono text-[11px] text-zinc-400">
                                {patchDebug.raw}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : proposal.files.map(file => (
                        <div key={file.path} className="space-y-2">
                          <label className="flex items-center gap-2 text-xs text-zinc-300">
                            <input
                              type="checkbox"
                              checked={selectedPatchFiles.has(file.path)}
                              onChange={event => {
                                setSelectedPatchFiles(current => {
                                  const next = new Set(current)
                                  if (event.target.checked) next.add(file.path)
                                  else next.delete(file.path)
                                  return next
                                })
                              }}
                            />
                            {file.path}
                            <Badge variant={file.operation === 'delete' ? 'error' : file.operation === 'create' ? 'success' : 'default'} className="text-[10px]">
                              {operationLabel(file.operation)}
                            </Badge>
                          </label>
                          <DiffBlock file={file} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {proposal.files.length > 0 && (
                        <Button size="sm" onClick={applyPatch} disabled={applyingPatch || selectedPatchFiles.size === 0 || !safe}>
                          {applyingPatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Apply selected
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void runSuggestedCommands()}
                        disabled={!canRunSuggestedChecks}
                        title={!proposal ? 'No patch proposal exists yet.'
                          : !safe ? 'Start the local daemon and pass repo safety first.'
                          : suggestedValidationCommands.length === 0 ? 'This patch did not include validation commands.'
                          : allowedSuggestedValidationCommands.length === 0 ? 'No suggested commands are allowlisted for patch validation.'
                          : 'Run safe suggested checks through the daemon terminal.'}
                      >
                        {patchChecksRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PanelBottom className="w-3.5 h-3.5" />}
                        Run suggested checks
                      </Button>
                    </div>
                    {suggestedValidationCommands.length > 0 && (
                      <div className="mt-3 space-y-1 text-[11px] text-zinc-600">
                        <div>Suggested checks:</div>
                        {suggestedValidationCommands.map(command => (
                          <div key={command} className="flex items-center gap-2">
                            <Badge variant={VALIDATION_COMMANDS.has(command) ? 'success' : 'warning'} className="text-[10px]">
                              {VALIDATION_COMMANDS.has(command) ? 'safe' : 'skipped'}
                            </Badge>
                            <span className="font-mono">{command}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {patchCheckResults.length > 0 && (
                      <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
                        <div className="text-[11px] text-zinc-500">Last check results</div>
                        {patchCheckResults.map(result => (
                          <div key={result.command} className="flex items-start gap-2 text-[11px] text-zinc-400">
                            <Badge variant={result.status === 'passed' ? 'success' : result.status === 'failed' ? 'error' : 'warning'} className="text-[10px]">
                              {result.status}
                            </Badge>
                            <div className="min-w-0">
                              <div className="truncate font-mono">{result.command}{result.exitCode !== undefined ? ` (exit ${result.exitCode})` : ''}</div>
                              {result.error && <div className="mt-1 line-clamp-3 text-red-300">{result.error}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-sky-400" />
                    <h2 className="text-sm font-semibold text-zinc-200">Patch history</h2>
                    <Badge variant="default" className="ml-auto text-[10px]">{patchHistory.length}</Badge>
                  </div>
                  {patchHistory.length === 0 ? (
                    <p className="text-xs leading-relaxed text-zinc-600">
                      Applied patch snapshots appear here. BertOS stores the previous content for modified files so you can revert an approved patch without leaving the workspace.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {patchHistory.slice(0, 5).map(entry => (
                        <div key={entry.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={entry.riskLevel === 'high' ? 'error' : entry.riskLevel === 'medium' ? 'warning' : 'success'} className="text-[10px]">
                              {entry.riskLevel}
                            </Badge>
                            <span className="truncate text-xs font-medium text-zinc-300">{entry.summary}</span>
                          </div>
                          <div className="mt-1 text-[11px] text-zinc-600">
                            {new Date(entry.timestamp).toLocaleString()} · {entry.provider ?? 'provider'} · {entry.appliedFiles.length} file(s)
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => void revertPatchHistoryEntry(entry)} disabled={!safe}>
                              <RotateCcw className="w-3.5 h-3.5" />Revert patch
                            </Button>
                            <span className="truncate text-[10px] text-zinc-700">{entry.appliedFiles.join(', ')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <GitCommit className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-semibold text-zinc-200">Git workflow</h2>
                  </div>
                  <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
                    <div className="text-[11px] text-zinc-600">Changed files</div>
                    {changedFiles.length ? (
                      <ul className="mt-1 space-y-1 text-xs text-zinc-400">
                        {changedFiles.slice(0, 12).map(file => <li key={file} className="truncate">{file}</li>)}
                      </ul>
                    ) : <p className="mt-1 text-xs text-zinc-600">No repo changes detected.</p>}
                  </div>
                  <textarea
                    value={commitMessage}
                    onChange={event => setCommitMessage(event.target.value)}
                    placeholder="Commit message"
                    className="min-h-20 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-700"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={generateCommitMessage} disabled={generatingCommit || !changedFiles.length}>
                      {generatingCommit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clipboard className="w-3.5 h-3.5" />}
                      Draft message
                    </Button>
                    <Button size="sm" variant="secondary" onClick={commitChanges} disabled={!commitMessage.trim() || !changedFiles.length || !safe}>
                      Commit locally
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toast.message('Push is intentionally disabled in-app until explicit push approval flow is added.')}
                    >
                      Push disabled
                    </Button>
                  </div>
                </section>

                <HealthCheckCard status={status} safe={safe} />
              </div>
            </ScrollArea>
          </aside>
        </div>
      </main>
    </div>
  )
}
