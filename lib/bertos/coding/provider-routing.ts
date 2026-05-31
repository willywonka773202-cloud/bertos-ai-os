import { askWithProviderRouter } from '../providers/router'
import type { AIModel } from '../types'
import {
  getProviderHubEntry,
  getProviderSetupGuide,
  isPaidProvider,
  listProviderHub,
  recordProviderHealth,
  type ProviderHubEntry,
} from './provider-hub'

export type ProviderRoutingMode =
  | 'auto' | 'local-only' | 'best-planner' | 'best-coder'
  | 'best-reviewer' | 'long-context' | 'fast-cheap' | 'ask-all'

// Ordered preference (router ids) per mode. selectProviderForMode picks the first ONLINE one.
const MODE_PREFERENCE: Record<Exclude<ProviderRoutingMode, 'ask-all'>, string[]> = {
  auto: ['claude-code', 'codex-cli', 'gemini-cli', 'ollama-pro', 'hermes-nous', 'openclaw-cli', 'gemini-api-native'],
  'local-only': ['ollama-pro', 'claude-code', 'codex-cli', 'gemini-cli', 'openclaw-cli', 'hermes-nous'],
  'best-planner': ['claude-code', 'gemini-cli', 'gemini-api-native', 'ollama-pro', 'hermes-nous'],
  'best-coder': ['codex-cli', 'claude-code', 'ollama-pro', 'gemini-cli'],
  'best-reviewer': ['claude-code', 'gemini-cli', 'codex-cli', 'ollama-pro'],
  'long-context': ['gemini-cli', 'gemini-api-native', 'claude-code', 'ollama-pro'],
  'fast-cheap': ['ollama-pro', 'hermes-nous', 'gemini-cli', 'claude-code'],
}

export interface ProviderSelection {
  providerId: string | null
  mode: ProviderRoutingMode
  reason: string
  fallbackOrder: string[]
}

/** Choose a provider for a routing mode, preferring online + (unless allowPaid) free providers. */
export async function selectProviderForMode(mode: ProviderRoutingMode, opts: { allowPaid?: boolean } = {}): Promise<ProviderSelection> {
  const hub = await listProviderHub()
  const online = new Map(hub.filter(p => p.online).map(p => [p.providerId, p]))
  if (mode === 'ask-all') {
    return { providerId: null, mode, reason: 'Ask-all mode queries every available provider.', fallbackOrder: [...online.keys()] }
  }
  const pref = MODE_PREFERENCE[mode]
  const usable = pref.filter(id => online.has(id) && (opts.allowPaid || !isPaidProvider(id)))
  const chosen = usable[0] ?? null
  return {
    providerId: chosen,
    mode,
    reason: chosen
      ? `Selected ${online.get(chosen)?.name ?? chosen} for "${mode}".`
      : (online.size === 0 ? 'No provider online — local deterministic mode.' : `No online provider matches "${mode}"; falling back to auto.`),
    fallbackOrder: usable,
  }
}

// ── Per-provider testing ──────────────────────────────────────────────────────

export type ProviderTestMode = 'connection' | 'prompt' | 'grounded' | 'patch'

export interface ProviderHubTestResult {
  providerId: string
  name: string
  status: string
  online: boolean
  ranLiveGeneration: boolean
  ok: boolean
  latencyMs?: number
  replyPreview?: string
  reason?: string
  setupHint?: string
  blockedPaid?: boolean
}

const TEST_PROMPTS: Record<ProviderTestMode, string> = {
  connection: '',
  prompt: 'Reply with exactly: BertOS provider check OK',
  grounded: 'In one sentence, confirm you can read a coding prompt. Reply briefly.',
  patch: 'Reply with a one-line description of how you would propose a code patch (no code).',
}

export async function testProviderById(providerId: string, opts: { allowPaid?: boolean; mode?: ProviderTestMode } = {}): Promise<ProviderHubTestResult> {
  const entry = await getProviderHubEntry(providerId)
  const guide = getProviderSetupGuide(providerId)
  const name = entry?.name ?? providerId
  const mode = opts.mode ?? 'prompt'

  if (!entry) {
    return { providerId, name, status: 'setup_required', online: false, ranLiveGeneration: false, ok: false, reason: 'Unknown provider.' }
  }

  if (!entry.online) {
    await recordProviderHealth({ providerId, status: entry.status, online: false, ranLiveGeneration: false, errorSummary: entry.error, mode })
    return { providerId, name, status: entry.status, online: false, ranLiveGeneration: false, ok: false, reason: entry.error ?? 'Offline.', setupHint: guide?.testHint }
  }

  if (isPaidProvider(providerId) && !opts.allowPaid) {
    await recordProviderHealth({ providerId, status: 'online', online: true, ranLiveGeneration: false, errorSummary: 'paid — gated', mode })
    return { providerId, name, status: 'online', online: true, ranLiveGeneration: false, ok: false, blockedPaid: true, reason: 'Paid provider — enable paid testing to run a live generation.', setupHint: guide?.testHint }
  }

  if (mode === 'connection') {
    await recordProviderHealth({ providerId, status: 'online', online: true, ranLiveGeneration: false, mode })
    return { providerId, name, status: 'online', online: true, ranLiveGeneration: false, ok: true, reason: 'Reachable.' }
  }

  const started = Date.now()
  const result = await askWithProviderRouter(TEST_PROMPTS[mode], providerId as AIModel, {
    purpose: 'chat', mode: 'chat', temperature: 0, maxTokens: 48,
    deprioritizedProviders: opts.allowPaid ? [] : [...['gemini-api-native']],
  })
  const latencyMs = Date.now() - started
  // Honest: only count as this provider's result if the router actually used it.
  const usedThis = (result.selectedProvider ?? result.providerId) === providerId
  if (result.ok && usedThis) {
    const preview = result.text.trim().slice(0, 120)
    await recordProviderHealth({ providerId, status: 'online', online: true, ranLiveGeneration: true, latencyMs, replyPreview: preview, mode })
    return { providerId, name, status: 'online', online: true, ranLiveGeneration: true, ok: true, latencyMs, replyPreview: preview }
  }
  const reason = !usedThis && result.ok
    ? `Request fell back to ${result.selectedProvider ?? 'another provider'}; ${name} did not actually answer.`
    : (result.error ?? 'Provider failed to respond.')
  await recordProviderHealth({ providerId, status: 'online', online: true, ranLiveGeneration: true, latencyMs, errorSummary: reason, mode })
  return { providerId, name, status: 'online', online: true, ranLiveGeneration: true, ok: false, latencyMs, reason, setupHint: guide?.testHint }
}

export async function testAllProviders(opts: { allowPaid?: boolean; mode?: ProviderTestMode } = {}): Promise<ProviderHubTestResult[]> {
  const hub = await listProviderHub()
  const results: ProviderHubTestResult[] = []
  for (const entry of hub) {
    // Offline / paid-gated providers are checked at connection level only (no spend, no hang).
    const mode: ProviderTestMode = entry.online && (!isPaidProvider(entry.providerId) || opts.allowPaid) ? (opts.mode ?? 'prompt') : 'connection'
    results.push(await testProviderById(entry.providerId, { allowPaid: opts.allowPaid, mode }))
  }
  return results
}

// ── Multi-provider compare ────────────────────────────────────────────────────

export interface ProviderRunLane {
  providerId: string
  name: string
  ok: boolean
  text: string
  latencyMs: number
  error?: string
}

export interface MultiProviderComparison {
  lanes: ProviderRunLane[]
  synthesis: string
  succeeded: string[]
  failed: string[]
  providersQueried: string[]
}

/** Ask the same prompt to several providers (online only). Each lane uses exactly that provider. */
export async function askMultipleProviders(prompt: string, providerIds: string[], opts: { allowPaid?: boolean } = {}): Promise<ProviderRunLane[]> {
  const hub = await listProviderHub()
  const online = new Map(hub.filter(p => p.online).map(p => [p.providerId, p]))
  const targets = providerIds.filter(id => online.has(id) && (opts.allowPaid || !isPaidProvider(id)))

  return Promise.all(targets.map(async providerId => {
    const started = Date.now()
    try {
      const result = await askWithProviderRouter(prompt, providerId as AIModel, {
        purpose: 'chat', mode: 'chat', temperature: 0.2, maxTokens: 1024,
        deprioritizedProviders: opts.allowPaid ? [] : ['gemini-api-native'],
      })
      const usedThis = (result.selectedProvider ?? result.providerId) === providerId
      return {
        providerId,
        name: online.get(providerId)?.name ?? providerId,
        ok: result.ok && usedThis,
        text: result.ok && usedThis ? result.text.trim() : '',
        latencyMs: Date.now() - started,
        error: result.ok && !usedThis ? `Fell back to ${result.selectedProvider}; this provider did not answer.` : (result.ok ? undefined : result.error),
      }
    } catch (error) {
      return { providerId, name: online.get(providerId)?.name ?? providerId, ok: false, text: '', latencyMs: Date.now() - started, error: error instanceof Error ? error.message : 'failed' }
    }
  }))
}

/** Deterministic synthesis across provider answers (no extra model call). */
export function synthesizeProviderResponses(lanes: ProviderRunLane[]): string {
  const ok = lanes.filter(l => l.ok && l.text)
  const failed = lanes.filter(l => !l.ok)
  if (ok.length === 0) {
    return `# Provider comparison\n\nNo provider produced an answer.\n\n${failed.map(l => `- **${l.name}**: ${l.error ?? 'failed'}`).join('\n')}`
  }
  // Prefer the highest-capability successful provider as the lead recommendation.
  const priority = ['claude-code', 'codex-cli', 'gemini-cli', 'gemini-api-native', 'ollama-pro', 'hermes-nous', 'openclaw-cli']
  const lead = [...ok].sort((a, b) => priority.indexOf(a.providerId) - priority.indexOf(b.providerId))[0]
  const lines = [
    '# Multi-provider comparison',
    `> _Asked ${lanes.length} provider(s); ${ok.length} answered. Deterministic synthesis (no extra model call)._`,
    '',
    '## Answers',
    ...ok.map(l => `### ${l.name} (${l.latencyMs}ms)\n\n${l.text.slice(0, 1500)}`),
    failed.length ? `\n## Did not answer\n${failed.map(l => `- **${l.name}**: ${l.error ?? 'failed'}`).join('\n')}` : '',
    '',
    '## Recommendation',
    `Lead answer: **${lead.name}** (highest-capability provider that responded). Compare the answers above for disagreements before acting. Any code changes still go through the approval-gated Patch Forge.`,
  ]
  return lines.filter(Boolean).join('\n')
}
