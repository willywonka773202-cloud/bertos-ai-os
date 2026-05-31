import { askWithProviderRouter, getVerifiedProviderStatuses } from '../providers/router'
import type { AIModel } from '../types'
import { getActiveProject, getProject } from './projects'
import { summarizeProjectStructure } from './files'
import { getGitStatus, isGitRepo } from './git'
import { getLatestValidationReport, listCommandRuns } from './commands'
import { listCodingTasks, tasksFromWorkflowOutput } from './tasks'
import { listDecisionRecords } from './decisions'
import { listPatchProposals } from './patches'
import { buildWorkflowContent, type CodingWorkflowId } from './workflows'
import { recordCodingRun } from './agent-runs'
import { proposeCodingMemory } from './memory-bridge'
import { buildMarkdownMemoryPack } from '../memory/registry'
import {
  askMultipleProviders, selectProviderForMode, synthesizeProviderResponses,
  type ProviderRoutingMode, type ProviderRunLane,
} from './provider-routing'
import { CodingOSError, type CodingProject } from './types'
import type { MemoryKind } from '../types'

export type AssistantIntent =
  | 'explain' | 'plan' | 'review' | 'fix' | 'test'
  | 'next' | 'summarize' | 'tasks' | 'patch' | 'general'

export interface AssistantProviderStatus {
  providerId: string
  providerName: string
  modelOrTool: string
  online: boolean
  error?: string
}

export interface AssistantResult {
  reply: string
  intent: AssistantIntent
  llmUsed: boolean
  providerName?: string
  degraded: boolean
  degradedReason?: string
  outputId?: string
  workflowRunId?: string
  agentRunId?: string
  createdTaskIds: string[]
  memoryProposalIds: string[]
  groundedIn: string[]
  providers: AssistantProviderStatus[]
  projectSlug?: string
  suggestedActions: string[]
  requestedProviderId?: string
  routingMode?: ProviderRoutingMode
  selectionReason?: string
}

const INTENT_TO_SUGGESTIONS: Record<AssistantIntent, string[]> = {
  explain: ['What should I work on next?', 'Find risks in this project', 'Make a plan for a feature'],
  plan: ['Create a patch proposal for this change', 'Turn this idea into tasks', 'Write tests for this'],
  review: ['Help me fix the latest validation failure', 'Create a patch proposal for this change', 'Summarize today’s progress'],
  fix: ['Create a patch proposal for this change', 'Write tests for this', 'Review my current diff'],
  test: ['Create a patch proposal for this change', 'Review my current diff', 'What should I work on next?'],
  next: ['Make a plan for this feature', 'Review my current diff', 'Summarize today’s progress'],
  summarize: ['What should I work on next?', 'Review my current diff', 'Find risks in this project'],
  tasks: ['Make a plan for this feature', 'What should I work on next?', 'Create a patch proposal for this change'],
  patch: ['Review my current diff', 'Write tests for this', 'Help me fix the latest validation failure'],
  general: ['Explain this repo like I’m joining the project', 'What should I work on next?', 'Review my current diff'],
}

const INTENT_RULES: Array<{ intent: AssistantIntent; test: RegExp }> = [
  { intent: 'explain', test: /\b(explain|what is|overview|understand|describe|how does .* work|architecture)\b/i },
  { intent: 'review', test: /\b(review|critique|look at .* diff|review the diff|code review)\b/i },
  { intent: 'fix', test: /\b(fix|failing|broken|error|bug|debug|why .* fail)\b/i },
  { intent: 'test', test: /\b(test|tests|coverage|unit test|write tests)\b/i },
  { intent: 'plan', test: /\b(plan|build a feature|implement|add a feature|design|how (would|should) i)\b/i },
  { intent: 'tasks', test: /\b(task|tasks|todo|turn .* into tasks|break down)\b/i },
  { intent: 'patch', test: /\b(patch|change the code|edit the file|apply a change|propose a patch)\b/i },
  { intent: 'summarize', test: /\b(summari[sz]e|recap|what changed|today|digest)\b/i },
  { intent: 'next', test: /\b(what should i (do|work on)|next step|whats next|what'?s next|prioriti)\b/i },
]

export function detectIntent(message: string): AssistantIntent {
  for (const rule of INTENT_RULES) {
    if (rule.test.test(message)) return rule.intent
  }
  return 'general'
}

const INTENT_TO_WORKFLOW: Partial<Record<AssistantIntent, CodingWorkflowId>> = {
  explain: 'explain-current-project',
  plan: 'feature-request-to-patch-plan',
  review: 'code-review-current-diff',
  fix: 'failing-validation-to-fix-plan',
  test: 'write-tests-plan',
  summarize: 'daily-dev-briefing',
  next: 'daily-dev-briefing',
}

const INTENT_TO_OUTPUT_TYPE: Record<AssistantIntent, string> = {
  explain: 'repo_map', plan: 'feature_plan', review: 'diff_review', fix: 'bug_report',
  test: 'test_report', next: 'daily_dev_briefing', summarize: 'daily_dev_briefing',
  tasks: 'task_plan', patch: 'implementation_plan', general: 'chat_response',
}

const INTENT_TO_MEMORY: Partial<Record<AssistantIntent, MemoryKind>> = {
  plan: 'procedural', review: 'procedural', fix: 'episodic', explain: 'semantic',
}

// Local/free providers (no per-call API billing) vs paid API providers.
const FREE_PROVIDERS = new Set(['ollama-pro', 'claude-code', 'codex-cli', 'gemini-cli', 'openclaw-cli'])
const PAID_PROVIDERS = new Set(['gemini-api-native', 'hermes-nous'])

export interface ProviderTestResult {
  ok: boolean
  ranLiveGeneration: boolean
  providerName?: string
  providerId?: string
  replyPreview?: string
  latencyMs?: number
  reason?: string
  paidAvailableButGated?: boolean
  setupHint?: string
  providers: AssistantProviderStatus[]
}

/**
 * Send a tiny safe test prompt to verify a provider truly responds.
 * Respects "no paid API without approval": only runs a live generation against a free/local
 * provider unless `allowPaid` is explicitly set.
 */
export async function testProvider(opts: { allowPaid?: boolean } = {}): Promise<ProviderTestResult> {
  const providers = await getAssistantProviderStatuses()
  const online = providers.filter(p => p.online)
  if (online.length === 0) {
    return { ok: false, ranLiveGeneration: false, providers, reason: 'No provider is online.', setupHint: 'Start Ollama locally (or make a CLI/API provider available) and test again. BertOS still works in local deterministic mode meanwhile.' }
  }
  const freeOnline = online.find(p => FREE_PROVIDERS.has(p.providerId))
  const paidOnline = online.find(p => PAID_PROVIDERS.has(p.providerId))
  if (!freeOnline && paidOnline && !opts.allowPaid) {
    return { ok: false, ranLiveGeneration: false, providers, paidAvailableButGated: true, reason: `Only a paid provider (${paidOnline.providerName}) is online.`, setupHint: 'Enable paid testing to run a live generation, or start a local provider (Ollama).' }
  }
  const target = freeOnline ?? (opts.allowPaid ? paidOnline : undefined) ?? online[0]
  const started = Date.now()
  const result = await askWithProviderRouter('Reply with exactly: BertOS provider check OK', target.providerId as AIModel, {
    purpose: 'chat', mode: 'chat', temperature: 0, maxTokens: 32,
    deprioritizedProviders: opts.allowPaid ? [] : [...PAID_PROVIDERS],
  })
  if (!result.ok) {
    return { ok: false, ranLiveGeneration: true, providers, providerId: result.selectedProvider, reason: result.error || 'Provider failed to respond.', setupHint: 'Check the provider is running and reachable.' }
  }
  return {
    ok: true, ranLiveGeneration: true, providers,
    providerId: result.selectedProvider ?? result.providerId,
    providerName: result.providerName || result.providerId,
    replyPreview: result.text.trim().slice(0, 120),
    latencyMs: Date.now() - started,
  }
}

export async function getAssistantProviderStatuses(): Promise<AssistantProviderStatus[]> {
  try {
    const statuses = await getVerifiedProviderStatuses()
    return statuses.map(status => ({
      providerId: status.providerId,
      providerName: status.providerName,
      modelOrTool: status.modelOrTool,
      online: status.online,
      error: status.error,
    }))
  } catch {
    return []
  }
}

export async function buildGroundingContext(project: CodingProject, recallQuery?: string): Promise<{ text: string; groundedIn: string[] }> {
  const groundedIn: string[] = ['project metadata']
  const lines: string[] = [
    `Project: ${project.name} (${project.slug})`,
    project.description ? `Description: ${project.description}` : '',
    `Repo path: ${project.repoPath}`,
    `Validation commands: ${project.validationCommands.join(', ') || 'none'}`,
  ]

  const gitRepo = await isGitRepo(project.repoPath).catch(() => false)
  const [structure, git, validation, commands, tasks, decisions, patches] = await Promise.all([
    summarizeProjectStructure(project.projectId).catch(() => null),
    gitRepo ? getGitStatus(project.projectId).catch(() => null) : Promise.resolve(null),
    getLatestValidationReport(project.projectId).catch(() => null),
    listCommandRuns(project.projectId, 5).catch(() => []),
    listCodingTasks({ projectId: project.projectId }).catch(() => []),
    listDecisionRecords(project.projectId).catch(() => []),
    listPatchProposals(project.projectId).catch(() => []),
  ])

  if (structure) {
    groundedIn.push('file structure', 'config files')
    lines.push(`Tech stack: ${structure.techStack.join(', ') || 'none detected'}`)
    lines.push(`Important files: ${structure.importantFiles.join(', ') || 'none'}`)
    lines.push(`Top-level: ${structure.topLevel.map(e => e.name).slice(0, 20).join(', ')}`)
  }
  if (git) {
    groundedIn.push('git status')
    lines.push(`Git: branch ${git.branch}, ${git.clean ? 'clean' : `${git.changedFiles.length} changed / ${git.untrackedFiles.length} untracked`}, diffStat: ${git.diffStat}`)
    if (git.changedFiles.length) lines.push(`Changed files: ${git.changedFiles.slice(0, 15).join(', ')}`)
  }
  if (validation) {
    groundedIn.push('validation report')
    lines.push(`Last validation: ${validation.status} — ${validation.summary}`)
    if (validation.failures.length) lines.push(`Validation failures: ${validation.failures.slice(0, 5).join('; ')}`)
  }
  if (commands.length) {
    groundedIn.push('command runs')
    lines.push(`Recent commands: ${commands.map(c => `${c.command} (${c.status})`).slice(0, 5).join('; ')}`)
  }
  const openTasks = tasks.filter(t => !['done', 'archived'].includes(t.status))
  if (openTasks.length) {
    groundedIn.push('tasks')
    lines.push(`Open tasks: ${openTasks.slice(0, 8).map(t => t.title).join('; ')}`)
  }
  if (decisions.length) {
    groundedIn.push('decisions')
    lines.push(`Decisions: ${decisions.slice(0, 5).map(d => d.title).join('; ')}`)
  }
  const openPatches = patches.filter(p => ['proposed', 'approved'].includes(p.status))
  if (openPatches.length) {
    groundedIn.push('patches')
    lines.push(`Pending patches: ${openPatches.map(p => `${p.title} (${p.status})`).join('; ')}`)
  }

  // ── Shared memory recall ──────────────────────────────────────────────────
  // Pull the most relevant approved memories from the BertOS memory vault so every
  // agent turn builds on prior knowledge instead of starting cold. This is the
  // cross-agent "memory cloud": anything an agent learns and the user approves
  // becomes recallable context for the next agent on a related task. Best-effort —
  // recall never blocks an answer.
  if (recallQuery && recallQuery.trim()) {
    try {
      const pack = await buildMarkdownMemoryPack({ query: recallQuery, project: project.slug, maxTokens: 1200 })
      if (pack.text.trim() && pack.selectedItems.length) {
        groundedIn.push('shared memory')
        lines.push('', `## Recalled memory (${pack.selectedItems.length} relevant${pack.omittedCount ? `, ${pack.omittedCount} more omitted` : ''})`, pack.text.trim())
      }
    } catch {
      // memory recall is best-effort; never let it break grounding
    }
  }

  return { text: lines.filter(Boolean).join('\n'), groundedIn }
}

function buildPrompt(intent: AssistantIntent, message: string, grounding: string): string {
  return [
    'You are the BertOS coding assistant working inside a local-first AI coding OS.',
    'Ground every answer ONLY in the provided project context. Do not invent files, APIs, or results.',
    'Never claim a command was run, a patch was applied, or an external service was called — those require explicit user approval in BertOS.',
    'If you suggest code changes, describe them as a proposed patch; do not pretend to have applied them.',
    'Be concise, concrete, and useful. Use markdown.',
    '',
    '## Project context',
    grounding,
    '',
    `## User intent: ${intent}`,
    '## User message',
    message,
  ].join('\n')
}

export interface RunAssistantInput {
  message: string
  projectId?: string
  /** Force a specific router provider id (e.g. 'ollama-pro', 'claude-code'). */
  providerId?: string
  /** Routing mode used when no explicit providerId is given. */
  routingMode?: ProviderRoutingMode
  allowPaid?: boolean
}

export async function runAssistant(input: RunAssistantInput): Promise<AssistantResult> {
  const message = (input.message ?? '').trim()
  if (!message) throw new CodingOSError('invalid-input', 'A message is required.')

  const project = input.projectId ? await getProject(input.projectId) : await getActiveProject()
  const providers = await getAssistantProviderStatuses()
  const anyOnline = providers.some(p => p.online)
  const intent = detectIntent(message)

  // Resolve which provider to prefer: explicit id > routing mode > auto.
  let preferred: AIModel = 'auto'
  let selectionReason: string | undefined
  if (input.providerId) {
    preferred = input.providerId as AIModel
    selectionReason = `Manually selected ${input.providerId}.`
  } else if (input.routingMode && input.routingMode !== 'auto' && input.routingMode !== 'ask-all') {
    const selection = await selectProviderForMode(input.routingMode, { allowPaid: input.allowPaid })
    if (selection.providerId) preferred = selection.providerId as AIModel
    selectionReason = selection.reason
  }

  // No active project: answer generally but explain that project context is unavailable.
  if (!project) {
    const reply = [
      '**No active project selected.**',
      '',
      'Register or activate a project in the Cockpit Sanctuary so I can ground answers in your repo (files, git status, validation, tasks, decisions).',
      anyOnline ? '' : '\n_No AI provider is currently online, so I am in local deterministic mode._',
    ].filter(Boolean).join('\n')
    return {
      reply, intent, llmUsed: false, degraded: true,
      degradedReason: 'No active project selected.',
      createdTaskIds: [], memoryProposalIds: [], groundedIn: [], providers,
      suggestedActions: ['Register a project in the Cockpit'],
    }
  }

  const { text: grounding, groundedIn } = await buildGroundingContext(project, message)

  let reply = ''
  let llmUsed = false
  let providerName: string | undefined
  let degraded = false
  let degradedReason: string | undefined

  if (anyOnline) {
    const result = await askWithProviderRouter(buildPrompt(intent, message, grounding), preferred, {
      purpose: 'chat', mode: 'chat', temperature: 0.3, maxTokens: 2048,
      deprioritizedProviders: input.allowPaid ? [] : ['gemini-api-native'],
    })
    if (result.ok && result.text.trim()) {
      reply = result.text.trim()
      llmUsed = true
      providerName = result.providerName || result.selectedProvider
    } else {
      degraded = true
      degradedReason = result.error || 'Provider returned no usable response.'
    }
  } else {
    degraded = true
    degradedReason = 'No AI provider is configured/online. Showing a local deterministic answer.'
  }

  // Deterministic fallback grounded in real project data — honestly labelled.
  if (!llmUsed) {
    const workflowId = INTENT_TO_WORKFLOW[intent]
    if (workflowId) {
      const built = await buildWorkflowContent(project, workflowId, { request: message })
      reply = `${built.markdown}\n\n_(${degradedReason})_`
    } else {
      reply = [
        `# BertOS — ${project.name}`,
        '> _Local deterministic mode — no LLM used._',
        '',
        '## Project context',
        '```',
        grounding,
        '```',
        '',
        `I understood your request as **${intent}**. Configure an AI provider in Settings to get an AI-authored answer; meanwhile the grounded project context above is what I can offer locally.`,
      ].join('\n')
    }
  }

  // ── Register the response as an output artifact. ──
  let outputId: string | undefined
  try {
    const { createOutputArtifact } = await import('../outputs/registry')
    const artifact = await createOutputArtifact({
      type: INTENT_TO_OUTPUT_TYPE[intent],
      title: `${intent[0].toUpperCase()}${intent.slice(1)}: ${message.slice(0, 60)}`,
      project: project.slug,
      status: 'ready',
      tags: ['coding-os', 'assistant', intent, llmUsed ? 'llm' : 'local'],
      content: `# ${message}\n\n${reply}`,
      fileName: `assistant-${intent}.md`,
      sourceLinks: [`project:${project.slug}`],
    })
    outputId = artifact.outputId
  } catch {
    // best-effort
  }

  // ── Follow-up tasks for plan/tasks intents. ──
  let createdTaskIds: string[] = []
  if (intent === 'plan' || intent === 'tasks') {
    const created = await tasksFromWorkflowOutput({
      projectId: project.projectId,
      titles: [`Scope: ${message.slice(0, 70)}`, `Implement: ${message.slice(0, 70)}`, `Validate: ${message.slice(0, 50)}`],
      outputId,
    }).catch(() => [])
    createdTaskIds = created.map(t => t.taskId)
  }

  // ── Record the run (AgentRun + WorkflowRun + lanes). ──
  let workflowRunId: string | undefined
  let agentRunId: string | undefined
  try {
    const recorded = await recordCodingRun({
      workflowId: `assistant:${intent}`,
      title: `Assistant (${intent}): ${message.slice(0, 50)}`,
      objective: message.slice(0, 120),
      projectSlug: project.slug,
      skillIds: [`assistant-${intent}`],
      lanes: [
        { role: 'grounding', summary: `Grounded in ${groundedIn.join(', ')}` },
        { role: 'generation', status: llmUsed ? 'completed' : 'skipped', summary: llmUsed ? `Provider ${providerName}` : `Local deterministic (${degradedReason})` },
        { role: 'output', summary: outputId ? `Registered output ${outputId}` : 'no output', outputIds: outputId ? [outputId] : [] },
      ],
      outputIds: outputId ? [outputId] : [],
      taskIds: createdTaskIds,
      providerName,
      llmUsed,
    })
    workflowRunId = recorded.workflowRunId
    agentRunId = recorded.agentRunId
  } catch {
    // best-effort
  }

  // ── Memory proposal for durable intents. ──
  const memoryProposalIds: string[] = []
  const memoryKind = INTENT_TO_MEMORY[intent]
  if (memoryKind && reply.length > 80) {
    const proposalId = await proposeCodingMemory({
      projectSlug: project.slug,
      kind: memoryKind,
      title: `${intent} insight: ${message.slice(0, 80)}`,
      content: reply,
      reason: `Proposed from an assistant ${intent} response for review (never written automatically).`,
      sourceRunId: agentRunId,
      sourceOutputId: outputId,
      tags: ['coding-os', 'assistant', intent],
    })
    if (proposalId) memoryProposalIds.push(proposalId)
  }

  return {
    reply, intent, llmUsed, providerName, degraded, degradedReason,
    outputId, workflowRunId, agentRunId, createdTaskIds, memoryProposalIds,
    groundedIn, providers, projectSlug: project.slug,
    suggestedActions: INTENT_TO_SUGGESTIONS[intent],
    requestedProviderId: input.providerId,
    routingMode: input.routingMode,
    selectionReason,
  }
}

// ── Multi-provider compare ────────────────────────────────────────────────────

export interface ProviderCompareResult {
  reply: string
  lanes: ProviderRunLane[]
  succeeded: string[]
  failed: string[]
  outputId?: string
  agentRunId?: string
  workflowRunId?: string
  providersQueried: string[]
}

export async function runProviderCompare(input: { message: string; projectId?: string; providerIds?: string[]; allowPaid?: boolean }): Promise<ProviderCompareResult> {
  const message = (input.message ?? '').trim()
  if (!message) throw new CodingOSError('invalid-input', 'A message is required.')
  const project = input.projectId ? await getProject(input.projectId) : await getActiveProject()

  const providers = await getAssistantProviderStatuses()
  const onlineIds = providers.filter(p => p.online).map(p => p.providerId)
  const targets = (input.providerIds?.length ? input.providerIds : onlineIds).filter(id => onlineIds.includes(id))

  const grounding = project ? (await buildGroundingContext(project, message)).text : 'No active project — answer generally.'
  const prompt = buildPrompt('general', message, grounding)

  if (targets.length === 0) {
    return { reply: 'No AI provider is online to compare. Configure a provider, then try Ask-all again.', lanes: [], succeeded: [], failed: [], providersQueried: [] }
  }

  const lanes = await askMultipleProviders(prompt, targets, { allowPaid: input.allowPaid })
  const synthesis = synthesizeProviderResponses(lanes)
  const succeeded = lanes.filter(l => l.ok).map(l => l.providerId)
  const failed = lanes.filter(l => !l.ok).map(l => l.providerId)

  let outputId: string | undefined
  try {
    const { createOutputArtifact } = await import('../outputs/registry')
    const artifact = await createOutputArtifact({
      type: 'diff_review', title: `Provider comparison: ${message.slice(0, 50)}`,
      project: project?.slug, status: 'ready', tags: ['coding-os', 'compare', ...succeeded],
      content: synthesis, fileName: 'provider-comparison.md',
    })
    outputId = artifact.outputId
  } catch { /* best-effort */ }

  let agentRunId: string | undefined
  let workflowRunId: string | undefined
  try {
    const recorded = await recordCodingRun({
      workflowId: 'assistant:compare', title: `Compare ${targets.length} providers: ${message.slice(0, 40)}`,
      objective: message.slice(0, 120), projectSlug: project?.slug, skillIds: ['provider-compare'],
      lanes: lanes.map(l => ({ role: `provider:${l.name}`, status: (l.ok ? 'completed' : 'failed') as 'completed' | 'failed', summary: l.ok ? `${l.latencyMs}ms` : (l.error ?? 'failed') })),
      outputIds: outputId ? [outputId] : [], providerName: `multi (${succeeded.length}/${targets.length})`, llmUsed: succeeded.length > 0,
    })
    agentRunId = recorded.agentRunId
    workflowRunId = recorded.workflowRunId
  } catch { /* best-effort */ }

  return { reply: synthesis, lanes, succeeded, failed, outputId, agentRunId, workflowRunId, providersQueried: targets }
}
