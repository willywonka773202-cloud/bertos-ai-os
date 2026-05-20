import { getOllamaConfig } from '../runtime'
import { resolveOllamaModel } from './ollama'
import type { ProviderAskOptions, ProviderAskResult, ProviderStatusResult } from './provider-result'

export async function status(): Promise<ProviderStatusResult> {
  const cfg = getOllamaConfig()
  return {
    ok: cfg.requiresApiKey ? Boolean(cfg.apiKey) : true,
    providerId: 'ollama-pro',
    providerName: cfg.providerName,
    modelOrTool: cfg.defaultModel,
    online: cfg.requiresApiKey ? Boolean(cfg.apiKey) : true,
    error: cfg.requiresApiKey && !cfg.apiKey ? 'OLLAMA_API_KEY is missing.' : undefined,
    detail: { mode: cfg.mode, baseUrl: cfg.baseUrl, chatUrl: cfg.chatUrl },
  }
}

export async function ask(prompt: string, options: ProviderAskOptions | string = {}): Promise<ProviderAskResult> {
  const started = Date.now()
  const cfg = getOllamaConfig()
  const askOptions = typeof options === 'string' ? {} : options
  const modelAlias = typeof options === 'string' ? options : 'ollama-pro'
  const model = resolveOllamaModel(modelAlias)

  if (cfg.requiresApiKey && !cfg.apiKey) {
    return {
      ok: false,
      providerId: 'ollama-pro',
      providerName: cfg.providerName,
      modelOrTool: model,
      text: '',
      latencyMs: Date.now() - started,
      source: 'api',
      error: 'OLLAMA_API_KEY is missing.',
    }
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`

    const res = await fetch(cfg.chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        format: askOptions.purpose === 'patch' ? 'json' : undefined,
        options: askOptions.purpose === 'patch'
          ? {
              temperature: askOptions.temperature ?? 0,
              num_predict: askOptions.maxTokens ?? 4096,
            }
          : undefined,
      }),
    })
    const data = await res.json().catch(() => ({})) as { message?: { content?: string }; response?: string; error?: string }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

    return {
      ok: true,
      providerId: 'ollama-pro',
      providerName: cfg.providerName,
      modelOrTool: model,
      text: data.message?.content ?? data.response ?? '',
      latencyMs: Date.now() - started,
      source: 'api',
    }
  } catch (error) {
    return {
      ok: false,
      providerId: 'ollama-pro',
      providerName: cfg.providerName,
      modelOrTool: model,
      text: '',
      latencyMs: Date.now() - started,
      source: 'api',
      error: error instanceof Error ? error.message : 'Ollama request failed.',
    }
  }
}
