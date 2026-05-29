import { getHermesNousConfig } from './providers/hermes-nous'

export const HERMES_PROXY_MAX_BODY_CHARS = 200_000

const WINDOWS = new Map<string, { count: number; resetAt: number }>()

export function checkHermesRouteRateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now()
  const current = WINDOWS.get(key)
  if (!current || current.resetAt <= now) {
    WINDOWS.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs }
  }
  if (current.count >= limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt }
  }
  current.count += 1
  return { ok: true, remaining: limit - current.count, resetAt: current.resetAt }
}

export function hermesPublicConfig() {
  const cfg = getHermesNousConfig()
  return {
    enabled: cfg.enabled,
    configured: Boolean(cfg.apiUrl && (cfg.apiKey || cfg.allowMissingKey)),
    baseUrlConfigured: Boolean(cfg.apiUrl),
    apiKeyConfigured: cfg.apiKeyConfigured,
    apiKeyMasked: cfg.apiKeyConfigured ? '******** configured' : 'missing',
    model: cfg.model,
    endpoint: cfg.apiUrl ? `${cfg.apiUrl}/v1` : '',
    timeoutMs: cfg.timeoutMs,
    streaming: cfg.streaming,
    mode: cfg.backendMode,
    paidProviderOptional: cfg.paidEnabled,
    freeModelBackends: ['Ollama/local model', 'custom OpenAI-compatible endpoint', 'free-tier provider key'],
  }
}

export function validateHermesProxyReady() {
  const cfg = getHermesNousConfig()
  if (!cfg.enabled) return { ok: false, status: 503, error: 'Hermes is not connected yet. Set HERMES_ENABLED=true.' as const, cfg }
  if (!cfg.apiUrl) return { ok: false, status: 503, error: 'Hermes endpoint is missing. Set HERMES_BASE_URL server-side.' as const, cfg }
  if (!cfg.apiKey && !cfg.allowMissingKey) {
    return { ok: false, status: 503, error: 'Hermes key is missing. Set HERMES_API_KEY server-side; never expose it in frontend code.' as const, cfg }
  }
  return { ok: true, status: 200, error: undefined, cfg }
}

export async function proxyHermesJson(path: `/${string}`, input: {
  method?: 'GET' | 'POST'
  body?: unknown
  timeoutMs?: number
}) {
  const ready = validateHermesProxyReady()
  if (!ready.ok) return { ok: false, status: ready.status, data: { ok: false, error: ready.error } }
  const { cfg } = ready
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`
  const res = await fetch(`${cfg.v1BaseUrl}${path}`, {
    method: input.method ?? 'GET',
    headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    cache: 'no-store',
    signal: AbortSignal.timeout(input.timeoutMs ?? cfg.timeoutMs),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

export async function readLimitedJson(req: Request) {
  const raw = await req.text()
  if (raw.length > HERMES_PROXY_MAX_BODY_CHARS) {
    throw new Error(`Request body must be ${HERMES_PROXY_MAX_BODY_CHARS} characters or fewer.`)
  }
  if (!raw.trim()) return {}
  return JSON.parse(raw) as Record<string, unknown>
}
