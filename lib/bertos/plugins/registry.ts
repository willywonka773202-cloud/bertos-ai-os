import { readJsonFile, runtimePath } from '../runtime-store'
import type { PermissionGate, PluginDefinition, PluginPermission, PluginSetupStatus } from './types'

function credentialStatus(credentials: string[], planned = false): PluginSetupStatus {
  if (planned) return 'planned'
  if (credentials.length === 0) return 'ready'
  return credentials.every(key => Boolean(process.env[key])) ? 'ready' : 'missing_credentials'
}

const SAFE_NO_MUTATE = [
  'Read/search operations are allowed only after setup is verified.',
  'Do not store secrets, credentials, cookies, or raw private content in memory.',
  'Degraded mode must say which live tool is missing.',
]

export const BUILT_IN_PLUGINS: PluginDefinition[] = [
  {
    id: 'youtube',
    mention: '@youtube',
    name: 'YouTube',
    purpose: 'Fetch video/channel metadata and transcripts for grounded content research.',
    credentialsRequired: ['YOUTUBE_API_KEY or transcript adapter'],
    tools: [
      { id: 'youtube.transcript', name: 'Get transcript', description: 'Fetch or import a YouTube transcript.', risk: 'safe' },
      { id: 'youtube.latestVideos', name: 'Latest videos', description: 'List latest creator videos when API setup exists.', risk: 'safe' },
    ],
    relatedSkills: ['youtube-researcher'],
    permissions: ['read_external_sources'],
    setupStatus: credentialStatus(['YOUTUBE_API_KEY']),
    safetyRules: [...SAFE_NO_MUTATE, 'Source URLs are required for transcript-grounded output.'],
    exampleUse: '/youtube-researcher @youtube latest_n=10 channel=<url>',
    degradedMode: 'Accept pasted transcript/source URLs and create grounded analysis without live fetching.',
  },
  {
    id: 'readwise',
    mention: '@readwise',
    name: 'Readwise / Second Brain',
    purpose: 'Search saved highlights, notes, bookmarks, and references.',
    credentialsRequired: ['READWISE_TOKEN'],
    tools: [{ id: 'readwise.search', name: 'Search highlights', description: 'Search synced highlights by tag/date/text.', risk: 'safe' }],
    relatedSkills: ['second-brain'],
    permissions: ['read_external_sources'],
    setupStatus: credentialStatus(['READWISE_TOKEN']),
    safetyRules: [...SAFE_NO_MUTATE, 'Every generated idea must link back to original source material.'],
    exampleUse: '/second-brain @readwise timeframe=3d ideas=10',
    degradedMode: 'Use local memory, pasted highlights, and previous BertOS outputs.',
  },
  {
    id: 'gmail',
    mention: '@gmail',
    name: 'Gmail',
    purpose: 'Search inboxes and draft sponsorship/deal-flow responses.',
    credentialsRequired: ['Gmail OAuth connector'],
    tools: [
      { id: 'gmail.search', name: 'Search mail', description: 'Find relevant messages.', risk: 'safe' },
      { id: 'gmail.draft', name: 'Draft reply', description: 'Create a reply draft.', risk: 'approval-required' },
      { id: 'gmail.send', name: 'Send email', description: 'Send an email.', risk: 'approval-required' },
    ],
    relatedSkills: ['inbox-deal-manager'],
    permissions: ['read_external_sources', 'send_email'],
    setupStatus: 'planned',
    safetyRules: [...SAFE_NO_MUTATE, 'Never send email without explicit approval.', 'Do not write private email bodies to memory automatically.'],
    exampleUse: '/brand-deal-manager @gmail summarize sponsorship emails',
    degradedMode: 'Use pasted email summaries or local mock rows; send remains unavailable.',
  },
  {
    id: 'calendar',
    mention: '@calendar',
    name: 'Calendar',
    purpose: 'Inspect availability and propose meeting times.',
    credentialsRequired: ['Calendar OAuth connector'],
    tools: [
      { id: 'calendar.freeBusy', name: 'Free/busy', description: 'Check calendar availability.', risk: 'safe' },
      { id: 'calendar.schedule', name: 'Schedule event', description: 'Create calendar event.', risk: 'approval-required' },
    ],
    relatedSkills: ['inbox-deal-manager'],
    permissions: ['read_external_sources', 'schedule_calendar'],
    setupStatus: 'planned',
    safetyRules: [...SAFE_NO_MUTATE, 'Never schedule events without explicit approval.'],
    exampleUse: '/brand-deal-manager @gmail @calendar suggest meeting times',
    degradedMode: 'Ask user for available windows and create suggestions only.',
  },
  {
    id: 'buffer',
    mention: '@buffer',
    name: 'Buffer',
    purpose: 'Create social publishing queue drafts and schedule approved posts.',
    credentialsRequired: ['BUFFER_ACCESS_TOKEN'],
    tools: [
      { id: 'buffer.createDraft', name: 'Create draft', description: 'Create a Buffer draft.', risk: 'approval-required' },
      { id: 'buffer.schedule', name: 'Schedule post', description: 'Schedule a post.', risk: 'approval-required' },
    ],
    relatedSkills: ['publishing-queue'],
    permissions: ['publish'],
    setupStatus: credentialStatus(['BUFFER_ACCESS_TOKEN']),
    safetyRules: [...SAFE_NO_MUTATE, 'Never publish or schedule without explicit approval.'],
    exampleUse: '/publishing-queue @buffer draft LinkedIn and X variants',
    degradedMode: 'Save queue items locally under the BertOS output registry.',
  },
  {
    id: 'fal',
    mention: '@fal',
    name: 'FAL / Gen Media',
    purpose: 'Generate and edit image, video, and audio assets.',
    credentialsRequired: ['FAL_KEY', 'ENABLE_PAID_MEDIA_APIS=true'],
    tools: [
      { id: 'fal.image', name: 'Generate image', description: 'Generate images.', risk: 'approval-required' },
      { id: 'fal.video', name: 'Generate video', description: 'Generate videos.', risk: 'approval-required' },
    ],
    relatedSkills: ['gen-media-studio'],
    permissions: ['use_paid_api', 'generate_likeness'],
    setupStatus: process.env.FAL_KEY && process.env.ENABLE_PAID_MEDIA_APIS === 'true' ? 'ready' : 'missing_credentials',
    safetyRules: [...SAFE_NO_MUTATE, 'Paid generation requires approval and budget awareness.', 'Likeness/persona generation requires consent.'],
    exampleUse: '/gen-media @fal create 4 thumbnail concepts',
    degradedMode: 'Create prompt cards and placeholder assets in Studio without paid generation.',
  },
  {
    id: 'remotion',
    mention: '@remotion',
    name: 'Remotion',
    purpose: 'Render React-based motion graphics and product videos.',
    credentialsRequired: ['Local Remotion install'],
    tools: [{ id: 'remotion.render', name: 'Render composition', description: 'Render a Remotion composition.', risk: 'approval-required' }],
    relatedSkills: ['motion-graphics'],
    permissions: ['run_local_tools', 'write_local_files'],
    setupStatus: 'planned',
    safetyRules: [...SAFE_NO_MUTATE, 'Verify local install before claiming render support.'],
    exampleUse: '/motion-graphics @remotion create launch intro options',
    degradedMode: 'Create composition JSON and render instructions only.',
  },
  {
    id: 'hyperframes',
    mention: '@hyperframes',
    name: 'Hyperframes',
    purpose: 'Create local motion graphics/video pipelines from web animations.',
    credentialsRequired: ['Local Hyperframes install', 'FFmpeg'],
    tools: [{ id: 'hyperframes.render', name: 'Render animation', description: 'Render local animation/video.', risk: 'approval-required' }],
    relatedSkills: ['motion-graphics'],
    permissions: ['run_local_tools', 'write_local_files'],
    setupStatus: 'planned',
    safetyRules: [...SAFE_NO_MUTATE, 'Verify Node, FFmpeg, and Hyperframes before claiming renders.'],
    exampleUse: '/motion-graphics @hyperframes make B-roll options',
    degradedMode: 'Create template plans and scene JSON only.',
  },
  {
    id: 'paper',
    mention: '@paper',
    name: 'Paper Canvas',
    purpose: 'AI-native design canvas scaffolding and previews.',
    credentialsRequired: ['Paper adapter'],
    tools: [{ id: 'paper.canvas', name: 'Create canvas', description: 'Create a design canvas.', risk: 'safe' }],
    relatedSkills: ['paper-canvas'],
    permissions: ['write_outputs'],
    setupStatus: 'planned',
    safetyRules: SAFE_NO_MUTATE,
    exampleUse: '/paper-canvas @paper create thumbnail concept board',
    degradedMode: 'Create local canvas JSON and PNG/HTML export instructions.',
  },
  {
    id: 'excalidraw',
    mention: '@excalidraw',
    name: 'Excalidraw',
    purpose: 'Create visual-first diagram files and previews.',
    credentialsRequired: [],
    tools: [{ id: 'excalidraw.file', name: 'Create diagram file', description: 'Create Excalidraw-compatible JSON.', risk: 'safe' }],
    relatedSkills: ['excalidraw-diagrams'],
    permissions: ['write_outputs'],
    setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'Prefer low-text diagrams unless the user asks otherwise.'],
    exampleUse: '/diagram @excalidraw explain this workflow',
    degradedMode: 'Create diagram JSON and markdown instructions.',
  },
  {
    id: 'browser',
    mention: '@browser',
    name: 'Browser',
    purpose: 'Preview local apps and inspect web pages when a browser adapter is available.',
    credentialsRequired: ['Browser automation adapter'],
    tools: [{ id: 'browser.preview', name: 'Preview page', description: 'Open/screenshot a URL.', risk: 'safe' }],
    relatedSkills: ['youtube-researcher', 'paper-canvas'],
    permissions: ['read_external_sources'],
    setupStatus: 'planned',
    safetyRules: [...SAFE_NO_MUTATE, 'Cite checked external sources.'],
    exampleUse: '/youtube-researcher @browser inspect reference examples',
    degradedMode: 'Use provided URLs and source notes without automated browsing.',
  },
  {
    id: 'filesystem',
    mention: '@filesystem',
    name: 'Filesystem',
    purpose: 'Local BertOS runtime and repo file access through safe paths.',
    credentialsRequired: [],
    tools: [
      { id: 'filesystem.read', name: 'Read file', description: 'Read approved local files.', risk: 'safe' },
      { id: 'filesystem.write', name: 'Write file', description: 'Write runtime artifacts.', risk: 'approval-required' },
      { id: 'filesystem.delete', name: 'Delete file', description: 'Delete local files.', risk: 'approval-required' },
    ],
    relatedSkills: ['youtube-researcher', 'second-brain', 'excalidraw-diagrams', 'paper-canvas', 'motion-graphics', 'gen-media-studio', 'publishing-queue'],
    permissions: ['read_local_files', 'write_local_files', 'delete_files', 'overwrite_files'],
    setupStatus: 'ready',
    safetyRules: ['Never read .env files or secrets.', 'Never delete or overwrite files without approval.', 'Runtime writes stay under data/bertos by default.'],
    exampleUse: '/diagram @filesystem save output to project folder',
    degradedMode: 'Return copyable output if file write is blocked.',
  },
  {
    id: 'memory',
    mention: '@memory',
    name: 'BertOS Memory',
    purpose: 'Search memory and create reviewed memory proposals.',
    credentialsRequired: [],
    tools: [
      { id: 'memory.search', name: 'Search memory', description: 'Search local memory.', risk: 'safe' },
      { id: 'memory.propose', name: 'Propose memory', description: 'Create a memory proposal.', risk: 'safe' },
    ],
    relatedSkills: ['second-brain', 'publishing-queue'],
    permissions: ['read_memory', 'write_memory_proposals'],
    setupStatus: 'ready',
    safetyRules: ['Memory writes are proposals unless approved.', 'Secret-like content is blocked.'],
    exampleUse: '/second-brain @memory create idea digest from saved context',
    degradedMode: 'Use current request context only.',
  },
  {
    id: 'outputs',
    mention: '@outputs',
    name: 'BertOS Outputs',
    purpose: 'Save and search generated artifacts.',
    credentialsRequired: [],
    tools: [
      { id: 'outputs.create', name: 'Create output', description: 'Register an output artifact.', risk: 'safe' },
      { id: 'outputs.search', name: 'Search outputs', description: 'Search output registry.', risk: 'safe' },
    ],
    relatedSkills: ['publishing-queue', 'gen-media-studio'],
    permissions: ['write_outputs'],
    setupStatus: 'ready',
    safetyRules: ['Never overwrite output files silently.', 'Every output gets metadata and a preview descriptor.'],
    exampleUse: '/publishing-queue @outputs collect recent ideas',
    degradedMode: 'Return output metadata without writing files.',
  },

  // ── Everyday Coding OS plugins (local-first). ──
  {
    id: 'filesystem', mention: '@filesystem', name: 'Filesystem',
    purpose: 'Read and (with approval) write project files within the active repo root.',
    credentialsRequired: [], relatedSkills: ['codebase-explainer', 'feature-builder'],
    tools: [
      { id: 'fs.list', name: 'List files', description: 'List browsable files/dirs.', risk: 'safe' },
      { id: 'fs.read', name: 'Read file', description: 'Read a non-sensitive file (secrets redacted).', risk: 'safe' },
      { id: 'fs.write', name: 'Write file', description: 'Write via an approved patch only.', risk: 'approval-required' },
    ],
    permissions: ['read_local_files', 'write_local_files'], setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'Path traversal and null bytes are blocked.', '.env/keys/credentials are never read or written.'],
    exampleUse: '/explain-codebase @filesystem', degradedMode: 'Local-ready; writes always go through an approved patch.',
  },
  {
    id: 'git', mention: '@git', name: 'Git (read-only)',
    purpose: 'Read git status, diff, and log. Mutations require approval.',
    credentialsRequired: [], relatedSkills: ['pr-reviewer', 'release-manager'],
    tools: [
      { id: 'git.status', name: 'Status', description: 'Working-tree status.', risk: 'safe' },
      { id: 'git.diff', name: 'Diff', description: 'Read the working diff (secrets redacted).', risk: 'safe' },
      { id: 'git.commit', name: 'Commit/Push', description: 'Mutating git operations.', risk: 'approval-required' },
    ],
    permissions: ['run_local_tools'], setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'push/commit/reset --hard/clean/pull require approval and never run automatically.'],
    exampleUse: '/review-diff @git', degradedMode: 'Read-only ready when the project path is a git repo.',
  },
  {
    id: 'command-runner', mention: '@command-runner', name: 'Command Runner',
    purpose: 'Run allowlisted, project-scoped commands (validation) with no shell.',
    credentialsRequired: [], relatedSkills: ['build-fixer', 'test-writer'],
    tools: [
      { id: 'cmd.run', name: 'Run allowlisted', description: 'Run an allowlisted command (e.g. npm run typecheck).', risk: 'safe' },
      { id: 'cmd.risky', name: 'Run risky', description: 'Mutating/off-allowlist commands.', risk: 'approval-required' },
    ],
    permissions: ['run_local_tools'], setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'shell:false, allowlist enforced, metacharacters/rm/sudo/curl|sh blocked, timeouts applied.'],
    exampleUse: '/fix-build @command-runner', degradedMode: 'Local-ready for allowlisted commands.',
  },
  {
    id: 'project-registry', mention: '@project-registry', name: 'Project Registry',
    purpose: 'Register, activate, and inspect local projects and their health.',
    credentialsRequired: [], relatedSkills: ['daily-coding-planner', 'codebase-explainer'],
    tools: [{ id: 'proj.register', name: 'Register', description: 'Register a repo (path-validated).', risk: 'safe' }, { id: 'proj.health', name: 'Health', description: 'Project health summary.', risk: 'safe' }],
    permissions: ['read_local_files', 'write_outputs'], setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'Sensitive/invalid paths are rejected.'],
    exampleUse: '/daily-dev @project-registry', degradedMode: 'Local-ready.',
  },
  {
    id: 'code-search', mention: '@code-search', name: 'Code Search',
    purpose: 'Search project file contents safely (excludes build dirs & secrets).',
    credentialsRequired: [], relatedSkills: ['codebase-explainer', 'bug-hunter'],
    tools: [{ id: 'search.content', name: 'Content search', description: 'Search file contents.', risk: 'safe' }],
    permissions: ['read_local_files'], setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'node_modules/.next/.env and binaries are excluded.'],
    exampleUse: '/debug @code-search "TypeError"', degradedMode: 'Local-ready.',
  },
  {
    id: 'patcher', mention: '@patcher', name: 'Patcher',
    purpose: 'Create patch proposals and (after approval) apply them with backups.',
    credentialsRequired: [], relatedSkills: ['feature-builder', 'bug-hunter', 'refactor-planner'],
    tools: [
      { id: 'patch.propose', name: 'Propose', description: 'Create a patch proposal (no write).', risk: 'safe' },
      { id: 'patch.apply', name: 'Apply', description: 'Apply an approved patch (backups + checksums).', risk: 'approval-required' },
    ],
    permissions: ['write_local_files', 'overwrite_files'], setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'Apply is impossible without approval.', 'Conflicts block apply; backups + checksums recorded; re-apply refused.'],
    exampleUse: '/build-feature @patcher', degradedMode: 'Proposals are local-ready; apply is approval-gated.',
  },
  {
    id: 'test-runner', mention: '@test-runner', name: 'Test Runner',
    purpose: 'Run the project test/validation commands and capture reports.',
    credentialsRequired: [], relatedSkills: ['test-writer', 'build-fixer'],
    tools: [{ id: 'test.run', name: 'Run tests', description: 'Run allowlisted test command.', risk: 'safe' }],
    permissions: ['run_local_tools'], setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'Only allowlisted commands; output redacted.'],
    exampleUse: '/write-tests @test-runner', degradedMode: 'Local-ready for allowlisted commands.',
  },
  {
    id: 'provider', mention: '@provider', name: 'AI Provider Router',
    purpose: 'Route AI requests to a verified-online provider; honest local fallback otherwise.',
    credentialsRequired: ['Ollama / CLI / API provider (varies)'], relatedSkills: ['feature-builder', 'codebase-explainer'],
    tools: [{ id: 'provider.ask', name: 'Ask', description: 'Route a prompt to an online provider.', risk: 'safe' }],
    permissions: ['read_external_sources', 'run_local_tools'], setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'Paid APIs are gated and off by default.', 'Never claims an offline provider produced output.'],
    exampleUse: '/explain-codebase @provider', degradedMode: 'If no provider is online, the assistant uses local deterministic mode and says so.',
  },
  {
    id: 'outputs', mention: '@outputs', name: 'Output Registry',
    purpose: 'Persist coding artifacts (plans, reviews, reports) with metadata.',
    credentialsRequired: [], relatedSkills: ['codebase-explainer', 'release-manager'],
    tools: [{ id: 'outputs.create', name: 'Create artifact', description: 'Save a version-safe artifact.', risk: 'safe' }],
    permissions: ['write_outputs'], setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'Version-safe writes; secrets redacted.'],
    exampleUse: '/daily-dev @outputs', degradedMode: 'Local-ready.',
  },
  {
    id: 'memory', mention: '@memory', name: 'Memory (proposals)',
    purpose: 'Read project memory and propose durable lessons for review.',
    credentialsRequired: [], relatedSkills: ['refactor-planner', 'release-manager'],
    tools: [{ id: 'memory.propose', name: 'Propose', description: 'Create a memory proposal (review-only).', risk: 'safe' }],
    permissions: ['read_memory', 'write_memory_proposals'], setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'Never writes memory automatically; secrets blocked.'],
    exampleUse: '/review-diff @memory', degradedMode: 'Proposal-only; approval writes to scoped files.',
  },
  {
    id: 'approvals', mention: '@approvals', name: 'Approvals (Guardian Gates)',
    purpose: 'Gate every risky action behind explicit approval.',
    credentialsRequired: [], relatedSkills: ['feature-builder', 'release-manager'],
    tools: [{ id: 'approvals.request', name: 'Request', description: 'Create an approval request.', risk: 'safe' }, { id: 'approvals.decide', name: 'Decide', description: 'Approve/reject (operator).', risk: 'approval-required' }],
    permissions: [], setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'Patch apply/push/deploy/delete/paid-API/memory-write all gate here.'],
    exampleUse: '/release-check @approvals', degradedMode: 'Local-ready.',
  },
  {
    id: 'runs', mention: '@runs', name: 'Run Ledger',
    purpose: 'Record every coding action as a run with lane logs and links.',
    credentialsRequired: [], relatedSkills: ['daily-coding-planner', 'pr-reviewer'],
    tools: [{ id: 'runs.record', name: 'Record run', description: 'Persist an AgentRun + WorkflowRun.', risk: 'safe' }],
    permissions: ['write_outputs'], setupStatus: 'ready',
    safetyRules: [...SAFE_NO_MUTATE, 'Read-only ledger of real runs.'],
    exampleUse: '/daily-dev @runs', degradedMode: 'Local-ready.',
  },
]

export async function listPlugins() {
  const runtimePlugins = await readJsonFile<PluginDefinition[]>(runtimePath('plugins', 'registry.json'), [])
  const byId = new Map(BUILT_IN_PLUGINS.map(plugin => [plugin.id, plugin]))
  for (const plugin of runtimePlugins) byId.set(plugin.id, plugin)
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function getPlugin(idOrMention: string) {
  const normalized = idOrMention.replace(/^@/, '')
  return (await listPlugins()).find(plugin => plugin.id === normalized || plugin.mention === idOrMention) ?? null
}

export async function resolvePluginMentions(text: string) {
  const mentions = Array.from(new Set(text.match(/@[a-z0-9-]+/gi) ?? []))
  const plugins = await Promise.all(mentions.map(mention => getPlugin(mention)))
  return plugins.filter((plugin): plugin is PluginDefinition => Boolean(plugin))
}

export async function verifyPluginSetup(idOrMention: string) {
  const plugin = await getPlugin(idOrMention)
  if (!plugin) return { ok: false, status: 'disabled' as PluginSetupStatus, error: 'Unknown plugin.' }
  return {
    ok: plugin.setupStatus === 'ready',
    status: plugin.setupStatus,
    degradedMode: plugin.degradedMode,
    requiredCredentials: plugin.credentialsRequired,
  }
}

const PERMISSION_ALIASES: Record<string, PluginPermission | string> = {
  paid_api: 'use_paid_api',
  paidApi: 'use_paid_api',
  publishing: 'publish',
  memory_write: 'write_memory_proposals',
  memoryWrite: 'write_memory_proposals',
  likeness_generation: 'generate_likeness',
  likenessGeneration: 'generate_likeness',
  file_delete: 'delete_files',
  delete_file: 'delete_files',
  file_overwrite: 'overwrite_files',
  overwrite_file: 'overwrite_files',
}

const APPROVAL_PERMISSIONS = new Set<PluginPermission | string>([
  'use_paid_api',
  'send_email',
  'schedule_calendar',
  'publish',
  'delete_files',
  'overwrite_files',
  'generate_likeness',
  'memory_write',
  'publishing',
  'paid_api',
  'likeness_generation',
])

export function normalizePermissionName(permission: PluginPermission | string) {
  return PERMISSION_ALIASES[permission] ?? permission
}

export function evaluatePermissionGate(input: {
  action: string
  permission: PluginPermission | string
  pluginId?: string
  approved?: boolean
}): PermissionGate {
  const permission = normalizePermissionName(input.permission)
  if (APPROVAL_PERMISSIONS.has(permission) && !input.approved) {
    return {
      gateId: `gate_${input.action}_${permission}`,
      action: input.action,
      pluginId: input.pluginId,
      permission,
      status: 'approval-required',
      reason: `${permission} requires explicit approval before ${input.action}.`,
    }
  }
  if (input.action.toLowerCase().includes('.env') || input.action.toLowerCase().includes('secret')) {
    return {
      gateId: `gate_${input.action}_blocked`,
      action: input.action,
      pluginId: input.pluginId,
      permission,
      status: 'blocked',
      reason: 'Secret-like file/content access is blocked.',
    }
  }
  return {
    gateId: `gate_${input.action}_${permission}`,
    action: input.action,
    pluginId: input.pluginId,
    permission,
    status: 'allowed',
    reason: 'Action is allowed by current permission policy.',
  }
}
