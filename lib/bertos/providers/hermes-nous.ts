import type { ProviderAskOptions, ProviderAskResult, ProviderStatusResult } from './provider-result'

export const HERMES_NOUS_PROVIDER_ID = 'hermes-nous' as const
export const DEFAULT_HERMES_NOUS_MODEL = 'hermes-agent'

export function normalizeHermesApiBase(apiUrl: string) {
  return apiUrl.trim().replace(/\/+$/, '').replace(/\/v1$/, '')
}

export function getHermesNousConfig() {
  const rawApiUrl = process.env.HERMES_API_URL || ''
  return {
    apiUrl: rawApiUrl ? normalizeHermesApiBase(rawApiUrl) : '',
    apiKey: process.env.HERMES_API_KEY || process.env.HERMES_API_SERVER_KEY || '',
    paidEnabled: process.env.ENABLE_HERMES_PAID === 'true',
    model: process.env.HERMES_MODEL || process.env.HERMES_API_MODEL || DEFAULT_HERMES_NOUS_MODEL,
  }
}

function buildHeaders(apiKey: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }
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

  if (!cfg.paidEnabled) {
    return {
      ok: false,
      model,
      provider: HERMES_NOUS_PROVIDER_ID,
      latencyMs: Date.now() - started,
      error: 'Hermes / Nous is paid-gated. Set ENABLE_HERMES_PAID=true only after explicit credit approval.',
    }
  }

  if (!cfg.apiUrl || !cfg.apiKey) {
    return {
      ok: false,
      model,
      provider: HERMES_NOUS_PROVIDER_ID,
      latencyMs: Date.now() - started,
      error: 'HERMES_API_URL and HERMES_API_KEY are required for Hermes / Nous routing.',
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
      error: 'Hermes / Nous request requires a prompt or messages.',
    }
  }

  try {
    const res = await fetch(`${cfg.apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(cfg.apiKey),
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 4096,
      }),
      signal: AbortSignal.timeout(60_000),
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
        error: `Hermes / Nous request failed: ${detail}`,
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
      error: error instanceof Error ? error.message : 'Hermes / Nous request failed.',
    }
  }
}

export async function status(): Promise<ProviderStatusResult> {
  const cfg = getHermesNousConfig()
  const configured = Boolean(cfg.apiUrl && cfg.apiKey)

  if (!configured) {
    return {
      ok: false,
      providerId: HERMES_NOUS_PROVIDER_ID,
      providerName: 'Hermes / Nous Remote',
      modelOrTool: 'HERMES_API_URL + HERMES_API_KEY',
      online: false,
      error: 'HERMES_API_URL and HERMES_API_KEY are missing.',
      detail: { configured: false, paidEnabled: cfg.paidEnabled },
    }
  }

  if (!cfg.paidEnabled) {
    return {
      ok: false,
      providerId: HERMES_NOUS_PROVIDER_ID,
      providerName: 'Hermes / Nous Remote',
      modelOrTool: cfg.model,
      online: false,
      error: 'Configured but paid routing is disabled by ENABLE_HERMES_PAID.',
      detail: { configured: true, paidEnabled: false },
    }
  }

  try {
    const res = await fetch(`${cfg.apiUrl}/health`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    return {
      ok: res.ok,
      providerId: HERMES_NOUS_PROVIDER_ID,
      providerName: 'Hermes / Nous Remote',
      modelOrTool: cfg.model,
      online: res.ok,
      error: res.ok ? undefined : `Hermes health returned HTTP ${res.status}.`,
      detail: { configured: true, paidEnabled: true, apiBase: cfg.apiUrl },
    }
  } catch (error) {
    return {
      ok: false,
      providerId: HERMES_NOUS_PROVIDER_ID,
      providerName: 'Hermes / Nous Remote',
      modelOrTool: cfg.model,
      online: false,
      error: error instanceof Error ? error.message : 'Hermes health check failed.',
      detail: { configured: true, paidEnabled: true, apiBase: cfg.apiUrl },
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
    providerName: 'Hermes / Nous Remote',
    modelOrTool: result.model,
    text: result.text ?? '',
    latencyMs: Date.now() - started,
    source: 'api',
    error: result.error,
  }
}
