import type { ProviderAskOptions, ProviderAskResult, ProviderStatusResult } from './provider-result'

export const HERMES_NOUS_PROVIDER_ID = 'hermes-nous' as const
export const DEFAULT_HERMES_NOUS_MODEL = 'hermes-agent'
const DEFAULT_HERMES_TIMEOUT_MS = 120_000

export function normalizeHermesApiBase(apiUrl: string) {
  return apiUrl.trim().replace(/\/+$/, '').replace(/\/v1$/, '')
}

function numberFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function getHermesNousConfig() {
  const rawApiUrl = process.env.HERMES_BASE_URL || process.env.HERMES_API_URL || ''
  const apiUrl = rawApiUrl ? normalizeHermesApiBase(rawApiUrl) : ''
  const apiKey = process.env.HERMES_API_KEY || process.env.HERMES_API_SERVER_KEY || ''
  const explicitEnabled = process.env.HERMES_ENABLED
  const paidEnabled = process.env.ENABLE_HERMES_PAID === 'true'
  const enabled = explicitEnabled === undefined
    ? Boolean(apiUrl && apiKey && paidEnabled)
    : explicitEnabled === 'true'
  return {
    enabled,
    apiUrl,
    v1BaseUrl: apiUrl ? `${apiUrl}/v1` : '',
    apiKey,
    apiKeyConfigured: Boolean(apiKey),
    paidEnabled,
    backendMode: process.env.HERMES_BACKEND_MODE || (paidEnabled ? 'paid-provider-optional' : 'free-local-or-custom'),
    model: process.env.HERMES_MODEL || process.env.HERMES_API_MODEL || DEFAULT_HERMES_NOUS_MODEL,
    timeoutMs: numberFromEnv(process.env.HERMES_TIMEOUT_MS, DEFAULT_HERMES_TIMEOUT_MS),
    streaming: process.env.HERMES_STREAMING !== 'false',
    allowMissingKey: process.env.HERMES_ALLOW_NO_API_KEY === 'true' && process.env.NODE_ENV !== 'production',
  }
}

function buildHeaders(apiKey: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  return headers
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map(part => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text
      return ''
    })
    .join('')
}

function extractChatCompletionText(data: unknown) {
  if (!data || typeof data !== 'object' || !('choices' in data) || !Array.isArray(data.choices)) return ''
  const [choice] = data.choices
  if (!choice || typeof choice !== 'object' || !('message' in choice)) return ''
  const message = choice.message
  if (!message || typeof message !== 'object' || !('content' in message)) return ''
  return textFromContent(message.content)
}

export async function callHermesNous(options: {
  prompt?: string
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  systemInstruction?: string
  model?: string
  temperature?: number
  maxTokens?: number
}): Promise<{
  ok: boolean
  text?: string
  model: string
  provider: 'hermes-nous'
  latencyMs: number
  usage?: unknown
  error?: string
  raw?: unknown
}> {
  const started = Date.now()
  const cfg = getHermesNousConfig()
  const model = options.model || cfg.model

  if (!cfg.enabled) {
    return {
      ok: false,
      model,
      provider: HERMES_NOUS_PROVIDER_ID,
      latencyMs: Date.now() - started,
      error: 'Hermes is disabled. Set HERMES_ENABLED=true and configure HERMES_BASE_URL server-side.',
    }
  }

  if (!cfg.apiUrl) {
    return {
      ok: false,
      model,
      provider: HERMES_NOUS_PROVIDER_ID,
      latencyMs: Date.now() - started,
      error: 'HERMES_BASE_URL is required for Hermes routing. Use http://127.0.0.1:8642/v1 on the same VPS or an HTTPS /v1 endpoint for a separate server.',
    }
  }

  if (!cfg.apiKey && !cfg.allowMissingKey) {
    return {
      ok: false,
      model,
      provider: HERMES_NOUS_PROVIDER_ID,
      latencyMs: Date.now() - started,
      error: 'HERMES_API_KEY is missing. Keep it server-side only. For local no-auth development, set HERMES_ALLOW_NO_API_KEY=true outside production.',
    }
  }

  const messages = [
    ...(options.systemInstruction ? [{ role: 'system' as const, content: options.systemInstruction }] : []),
    ...(options.messages ?? [{ role: 'user' as const, content: options.prompt ?? '' }]),
  ].filter(message => message.content.trim())

  if (messages.length === 0) {
    return {
      ok: false,
      model,
      provider: HERMES_NOUS_PROVIDER_ID,
      latencyMs: Date.now() - started,
      error: 'Hermes request requires a prompt or messages.',
    }
  }

  try {
    const res = await fetch(`${cfg.v1BaseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(cfg.apiKey),
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 4096,
      }),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const detail = data && typeof data === 'object' && 'error' in data
        ? typeof data.error === 'string'
          ? data.error
          : JSON.stringify(data.error)
        : `HTTP ${res.status}`
      return {
        ok: false,
        model,
        provider: HERMES_NOUS_PROVIDER_ID,
        latencyMs: Date.now() - started,
        error: `Hermes request failed: ${detail}`,
        raw: data,
      }
    }

    return {
      ok: true,
      text: extractChatCompletionText(data),
      model,
      provider: HERMES_NOUS_PROVIDER_ID,
      latencyMs: Date.now() - started,
      usage: data && typeof data === 'object' && 'usage' in data ? data.usage : undefined,
      raw: data,
    }
  } catch (error) {
    return {
      ok: false,
      model,
      provider: HERMES_NOUS_PROVIDER_ID,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Hermes request failed.',
    }
  }
}

export async function status(): Promise<ProviderStatusResult> {
  const cfg = getHermesNousConfig()
  const configured = Boolean(cfg.apiUrl && (cfg.apiKey || cfg.allowMissingKey))

  if (!configured) {
    return {
      ok: false,
      providerId: HERMES_NOUS_PROVIDER_ID,
      providerName: 'Hermes Agent',
      modelOrTool: 'HERMES_BASE_URL + HERMES_API_KEY',
      online: false,
      error: !cfg.apiUrl
        ? 'HERMES_BASE_URL is missing.'
        : 'HERMES_API_KEY is missing. Store it server-side only.',
      detail: {
        configured: false,
        enabled: cfg.enabled,
        apiBaseConfigured: Boolean(cfg.apiUrl),
        apiKeyConfigured: cfg.apiKeyConfigured,
        paidEnabled: cfg.paidEnabled,
        backendMode: cfg.backendMode,
      },
    }
  }

  if (!cfg.enabled) {
    return {
      ok: false,
      providerId: HERMES_NOUS_PROVIDER_ID,
      providerName: 'Hermes Agent',
      modelOrTool: cfg.model,
      online: false,
      error: 'Hermes is configured but disabled. Set HERMES_ENABLED=true.',
      detail: { configured: true, enabled: false, paidEnabled: cfg.paidEnabled, backendMode: cfg.backendMode },
    }
  }

  try {
    const res = await fetch(`${cfg.apiUrl}/health`, {
      headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(Math.min(cfg.timeoutMs, 10_000)),
    })
    return {
      ok: res.ok,
      providerId: HERMES_NOUS_PROVIDER_ID,
      providerName: 'Hermes Agent',
      modelOrTool: cfg.model,
      online: res.ok,
      error: res.ok ? undefined : `Hermes health returned HTTP ${res.status}.`,
      detail: {
        configured: true,
        enabled: cfg.enabled,
        paidEnabled: cfg.paidEnabled,
        apiBase: cfg.apiUrl,
        model: cfg.model,
        backendMode: cfg.backendMode,
        apiKeyConfigured: cfg.apiKeyConfigured,
      },
    }
  } catch (error) {
    return {
      ok: false,
      providerId: HERMES_NOUS_PROVIDER_ID,
      providerName: 'Hermes Agent',
      modelOrTool: cfg.model,
      online: false,
      error: error instanceof Error ? error.message : 'Hermes health check failed.',
      detail: { configured: true, enabled: cfg.enabled, paidEnabled: cfg.paidEnabled, apiBase: cfg.apiUrl, backendMode: cfg.backendMode },
    }
  }
}

export async function listHermesModels() {
  const cfg = getHermesNousConfig()
  if (!cfg.enabled) return { ok: false, error: 'Hermes is disabled. Set HERMES_ENABLED=true.', models: [] as string[] }
  if (!cfg.apiUrl) return { ok: false, error: 'HERMES_BASE_URL is missing.', models: [] as string[] }
  if (!cfg.apiKey && !cfg.allowMissingKey) return { ok: false, error: 'HERMES_API_KEY is missing.', models: [] as string[] }
  try {
    const res = await fetch(`${cfg.v1BaseUrl}/models`, {
      headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(Math.min(cfg.timeoutMs, 10_000)),
    })
    const data = await res.json().catch(() => ({}))
    const models = data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)
      ? data.data.map((item: unknown) => item && typeof item === 'object' && 'id' in item ? String(item.id) : '').filter(Boolean)
      : []
    return {
      ok: res.ok,
      models,
      configuredModelAvailable: models.includes(cfg.model) || models.length === 0,
      configuredModel: cfg.model,
      raw: data,
      error: res.ok ? undefined : `Hermes models returned HTTP ${res.status}.`,
    }
  } catch (error) {
    return {
      ok: false,
      models: [],
      configuredModelAvailable: false,
      configuredModel: cfg.model,
      error: error instanceof Error ? error.message : 'Hermes model check failed.',
    }
  }
}

export async function ask(prompt: string, options: ProviderAskOptions = {}): Promise<ProviderAskResult> {
  const started = Date.now()
  const result = await callHermesNous({
    prompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })

  return {
    ok: result.ok,
    providerId: HERMES_NOUS_PROVIDER_ID,
    providerName: 'Hermes Agent',
    modelOrTool: result.model,
    text: result.text ?? '',
    latencyMs: Date.now() - started,
    source: 'api',
    error: result.error,
  }
}
