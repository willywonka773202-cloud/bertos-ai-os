import { nowIso } from '../runtime-store'
import { Collection } from './store'
import { getVerifiedProviderStatuses } from '../providers/router'
import { PROVIDER_REGISTRY } from '../providers/registry'
import { redactSensitiveText } from './safety'

// Router provider ids (what askWithProviderRouter / status actually use) mapped to the
// rich PROVIDER_REGISTRY entries (which use slightly different ids).
const ROUTER_TO_REGISTRY: Record<string, keyof typeof PROVIDER_REGISTRY> = {
  'ollama-pro': 'ollama',
  'claude-code': 'claude-code',
  'codex-cli': 'codex-cli',
  'gemini-cli': 'gemini-cli',
  'gemini-api-native': 'gemini-api-native',
  'hermes-nous': 'hermes-nous',
  'openclaw-cli': 'openclaw-cli',
}

export type ProviderCostMode = 'free-local' | 'subscription' | 'paid' | 'unknown'

export interface ProviderCapability {
  canGenerate: boolean
  canEditCode: boolean
  canRunTools: boolean
  longContext: boolean
  costMode: ProviderCostMode
  safeToAuto: boolean
  bestFor: string[]
}

const CAPABILITIES: Record<string, ProviderCapability> = {
  'ollama-pro': { canGenerate: true, canEditCode: true, canRunTools: false, longContext: false, costMode: 'free-local', safeToAuto: true, bestFor: ['fast local answers', 'quick edits', 'offline/free'] },
  'claude-code': { canGenerate: true, canEditCode: true, canRunTools: true, longContext: true, costMode: 'subscription', safeToAuto: true, bestFor: ['planning', 'reasoning', 'architecture', 'writing', 'review'] },
  'codex-cli': { canGenerate: true, canEditCode: true, canRunTools: true, longContext: false, costMode: 'subscription', safeToAuto: true, bestFor: ['coding', 'editing', 'patch proposals'] },
  'gemini-cli': { canGenerate: true, canEditCode: true, canRunTools: false, longContext: true, costMode: 'subscription', safeToAuto: true, bestFor: ['long context', 'research', 'large-repo summaries'] },
  'gemini-api-native': { canGenerate: true, canEditCode: false, canRunTools: false, longContext: true, costMode: 'paid', safeToAuto: false, bestFor: ['long context', 'structured JSON', 'planning'] },
  'hermes-nous': { canGenerate: true, canEditCode: false, canRunTools: true, longContext: false, costMode: 'unknown', safeToAuto: true, bestFor: ['hosted/local orchestration', 'OpenAI-compatible endpoint'] },
  'openclaw-cli': { canGenerate: true, canEditCode: false, canRunTools: true, longContext: false, costMode: 'free-local', safeToAuto: true, bestFor: ['local agent', 'tool orchestration'] },
}

export const PAID_ROUTER_PROVIDERS = new Set(['gemini-api-native'])
export const FREE_ROUTER_PROVIDERS = new Set(['ollama-pro', 'claude-code', 'codex-cli', 'gemini-cli', 'openclaw-cli', 'hermes-nous'])

export type ProviderHubStatus = 'online' | 'offline' | 'missing_credentials' | 'setup_required'

export interface ProviderHealthRecord {
  providerId: string
  status: ProviderHubStatus
  online: boolean
  lastTestedAt: string
  latencyMs?: number
  ranLiveGeneration: boolean
  errorSummary?: string
  replyPreview?: string
  mode?: string
}

export interface ProviderHubEntry {
  providerId: string
  name: string
  status: ProviderHubStatus
  online: boolean
  modelOrTool: string
  models: string[]
  capability: ProviderCapability
  description: string
  billingWarning?: string
  setupCommand: string
  docsUrl: string
  color: string
  error?: string
  lastTest?: ProviderHealthRecord
}

const health = new Collection<ProviderHealthRecord & Record<string, unknown>>('provider-health.json', 'providerId')

function deriveStatus(online: boolean, error?: string): ProviderHubStatus {
  if (online) return 'online'
  const e = (error ?? '').toLowerCase()
  if (e.includes('missing') || e.includes('api_key') || e.includes('api key') || e.includes('not configured')) return 'missing_credentials'
  if (e.includes('offline') || e.includes('daemon')) return 'offline'
  return 'setup_required'
}

export async function recordProviderHealth(record: Omit<ProviderHealthRecord, 'lastTestedAt'> & { lastTestedAt?: string }): Promise<ProviderHealthRecord> {
  const full: ProviderHealthRecord = { ...record, lastTestedAt: record.lastTestedAt ?? nowIso() }
  return health.upsert(full as ProviderHealthRecord & Record<string, unknown>)
}

export async function listProviderHub(): Promise<ProviderHubEntry[]> {
  const statuses = await getVerifiedProviderStatuses().catch(() => [])
  const healthRecords = await health.all().catch(() => [])
  const healthById = new Map(healthRecords.map(r => [r.providerId, r]))

  return statuses.map(status => {
    const registryId = ROUTER_TO_REGISTRY[status.providerId]
    const def = registryId ? PROVIDER_REGISTRY[registryId] : undefined
    const capability = CAPABILITIES[status.providerId] ?? { canGenerate: true, canEditCode: false, canRunTools: false, longContext: false, costMode: 'unknown', safeToAuto: false, bestFor: [] }
    return {
      providerId: status.providerId,
      name: status.providerName,
      status: deriveStatus(status.online, status.error),
      online: status.online,
      modelOrTool: status.modelOrTool,
      models: def?.models ?? [status.modelOrTool],
      capability,
      description: def?.description ?? '',
      billingWarning: def?.billingWarning,
      setupCommand: def?.setupCommand ?? '',
      docsUrl: def?.docsUrl ?? '',
      color: def?.color ?? '#7ABCD6',
      error: status.error ? redactSensitiveText(status.error).text : undefined,
      lastTest: healthById.get(status.providerId),
    }
  })
}

export async function getProviderHubEntry(providerId: string): Promise<ProviderHubEntry | null> {
  const all = await listProviderHub()
  return all.find(p => p.providerId === providerId) ?? null
}

// ── Setup guides ─────────────────────────────────────────────────────────────

export interface ProviderSetupGuide {
  providerId: string
  name: string
  whatItIs: string
  costMode: ProviderCostMode
  installCommand?: string
  startCommand?: string
  envVars: string[]
  howBertosDetects: string
  testHint: string
  commonErrors: string[]
  doNotCommit: string[]
  docsUrl: string
}

const SETUP_GUIDES: Record<string, Omit<ProviderSetupGuide, 'providerId' | 'name' | 'costMode' | 'docsUrl'>> = {
  'ollama-pro': {
    whatItIs: 'Local/free Ollama models (and Ollama Pro cloud). Default always-on provider with no per-call API billing.',
    installCommand: 'Download from https://ollama.com (do not auto-install).',
    startCommand: 'ollama serve   (then: ollama pull qwen2.5-coder)',
    envVars: ['OLLAMA_BASE_URL (optional, default http://127.0.0.1:11434)', 'OLLAMA_API_KEY (only for Pro cloud)'],
    howBertosDetects: 'BertOS checks the local Ollama endpoint reachability.',
    testHint: 'Press Test in the AI Command Center, or run a tiny prompt here.',
    commonErrors: ['"Daemon is offline" → run `ollama serve`', 'No models → `ollama pull qwen2.5-coder`'],
    doNotCommit: ['OLLAMA_API_KEY'],
  },
  'claude-code': {
    whatItIs: 'Claude via the Claude Code CLI, using your Anthropic subscription (no separate API bill).',
    installCommand: 'Install the Claude Code CLI from claude.ai/code (do not auto-install).',
    startCommand: 'claude login   (and ensure the BertOS local daemon is running)',
    envVars: [],
    howBertosDetects: 'Via the BertOS local daemon, which checks the `claude` CLI/session.',
    testHint: 'Start the local daemon + `claude login`, then press Test.',
    commonErrors: ['"Daemon is offline" → start the BertOS local daemon', 'Auth required → run `claude login`'],
    doNotCommit: ['Any Anthropic credentials'],
  },
  'codex-cli': {
    whatItIs: 'OpenAI Codex via the local Codex CLI, using your ChatGPT subscription (no separate API bill).',
    installCommand: 'Install the Codex CLI from github.com/openai/codex (do not auto-install).',
    startCommand: 'codex login   (and ensure the BertOS local daemon is running)',
    envVars: [],
    howBertosDetects: 'Via the BertOS local daemon, which checks the `codex` CLI/session.',
    testHint: 'Start the local daemon + `codex login`, then press Test.',
    commonErrors: ['"Daemon is offline" → start the BertOS local daemon', 'Auth required → run `codex login`'],
    doNotCommit: ['Any OpenAI credentials'],
  },
  'gemini-cli': {
    whatItIs: 'Gemini via the local Gemini CLI, using your Google One AI Premium subscription (no API bill).',
    installCommand: 'Install the Gemini CLI from ai.google.dev (do not auto-install).',
    startCommand: 'gemini auth login   (and ensure the BertOS local daemon is running)',
    envVars: [],
    howBertosDetects: 'Via the BertOS local daemon, which checks the `gemini` CLI/session.',
    testHint: 'Start the local daemon + `gemini auth login`, then press Test.',
    commonErrors: ['"Daemon is offline" → start the BertOS local daemon', 'Auth required → run `gemini auth login`'],
    doNotCommit: ['Any Google credentials'],
  },
  'gemini-api-native': {
    whatItIs: 'Direct Google Gemini API (native SDK). PAID — Google One does NOT include API credits.',
    envVars: ['GEMINI_API_KEY (or GOOGLE_API_KEY)'],
    howBertosDetects: 'BertOS checks only for the presence of GEMINI_API_KEY (never the value).',
    testHint: 'Set GEMINI_API_KEY in env, then test with allowPaid enabled (a metered call).',
    commonErrors: ['"GEMINI_API_KEY is missing" → set it in your environment (not committed)'],
    doNotCommit: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  },
  'hermes-nous': {
    whatItIs: 'OpenAI-compatible Hermes Agent connector (Hostinger VPS, local Ollama-backed Hermes, or a custom endpoint). Cost depends on the backend you configure.',
    envVars: ['HERMES_ENABLED=true', 'HERMES_BASE_URL', 'HERMES_API_KEY', 'HERMES_MODEL (optional)'],
    howBertosDetects: 'BertOS checks the Hermes config flags/reachability (never exposes host or token).',
    testHint: 'Configure HERMES_* env vars server-side, then press Test.',
    commonErrors: ['Not configured → set HERMES_ENABLED + HERMES_BASE_URL + HERMES_API_KEY', 'Unreachable endpoint → verify the base URL'],
    doNotCommit: ['HERMES_API_KEY', 'HERMES_BASE_URL'],
  },
  'openclaw-cli': {
    whatItIs: 'Local OpenClaw assistant bridge (Ollama-backed), called through the BertOS desktop daemon.',
    installCommand: 'npm install -g openclaw@latest  (do not auto-install)',
    startCommand: 'openclaw onboard --install-daemon',
    envVars: [],
    howBertosDetects: 'Via the BertOS local/desktop daemon.',
    testHint: 'Install + onboard OpenClaw, start the daemon, then press Test.',
    commonErrors: ['Daemon offline → start the BertOS desktop daemon'],
    doNotCommit: [],
  },
}

export function getProviderSetupGuide(providerId: string): ProviderSetupGuide | null {
  const partial = SETUP_GUIDES[providerId]
  const registryId = ROUTER_TO_REGISTRY[providerId]
  const def = registryId ? PROVIDER_REGISTRY[registryId] : undefined
  if (!partial || !def) return null
  return {
    providerId,
    name: def.name,
    costMode: CAPABILITIES[providerId]?.costMode ?? 'unknown',
    docsUrl: def.docsUrl,
    ...partial,
  }
}

export function isPaidProvider(providerId: string): boolean {
  return PAID_ROUTER_PROVIDERS.has(providerId)
}
