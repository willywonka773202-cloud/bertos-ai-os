import { GoogleGenAI } from '@google/genai'
import { schemaForGeminiMode } from './gemini-schemas'
import type { ProviderAskOptions, ProviderAskResult, ProviderStatusResult } from './provider-result'

export type GeminiNativeMode =
  | 'chat'
  | 'structured-plan'
  | 'workspace-patch-plan'
  | 'council-judge'
  | 'system-analysis'
  | 'autopilot-report'

export const GEMINI_NATIVE_PROVIDER_ID = 'gemini-api-native' as const
export const GEMINI_NATIVE_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash']
export const GEMINI_NATIVE_CAPABILITIES = [
  'chat',
  'structured-json',
  'long-context',
  'planning',
  'code-analysis',
  'council-judge',
  'workspace-planning',
  'multimodal-foundation',
]

export function getGeminiNativeApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
}

function extractJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1))
    throw new Error('Gemini Native returned text that was not valid JSON.')
  }
}

function buildPrompt(options: {
  prompt: string
  context?: Array<{ label: string; content: string }>
}) {
  const contextBlock = options.context?.length
    ? [
        'Context:',
        ...options.context.map(item => [
          `--- ${item.label} ---`,
          item.content,
        ].join('\n')),
        '',
      ].join('\n')
    : ''
  return [contextBlock, options.prompt].filter(Boolean).join('\n')
}

export async function callGeminiNative(options: {
  model?: string
  mode?: GeminiNativeMode
  prompt: string
  systemInstruction?: string
  responseSchema?: unknown
  responseMimeType?: 'application/json' | 'text/plain'
  temperature?: number
  maxOutputTokens?: number
  context?: Array<{ label: string; content: string }>
  attachments?: Array<{ mimeType: string; dataBase64: string; label?: string }>
}): Promise<{
  ok: boolean
  text?: string
  json?: unknown
  model: string
  provider: 'gemini-api-native'
  latencyMs: number
  usage?: unknown
  error?: string
  raw?: unknown
}> {
  const started = Date.now()
  const model = options.model || (options.mode === 'chat' ? 'gemini-2.5-flash' : 'gemini-2.5-pro')
  const apiKey = getGeminiNativeApiKey()

  if (!apiKey) {
    return {
      ok: false,
      model,
      provider: GEMINI_NATIVE_PROVIDER_ID,
      latencyMs: Date.now() - started,
      error: 'GEMINI_API_KEY is missing. Add it to .env.local or Vercel environment variables. GOOGLE_API_KEY is also supported as a fallback.',
    }
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const schema = options.responseSchema ?? schemaForGeminiMode(options.mode ?? 'chat')
    const responseMimeType = options.responseMimeType ?? (schema ? 'application/json' : 'text/plain')
    const prompt = buildPrompt({ prompt: options.prompt, context: options.context })
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }]

    for (const attachment of options.attachments ?? []) {
      parts.push({
        inlineData: {
          mimeType: attachment.mimeType,
          data: attachment.dataBase64,
        },
      })
    }

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction: options.systemInstruction,
        temperature: options.temperature ?? (schema ? 0 : 0.4),
        maxOutputTokens: options.maxOutputTokens ?? (schema ? 4096 : 8192),
        responseMimeType,
        responseSchema: schema as never,
      },
    })

    const text = response.text ?? ''
    const json = responseMimeType === 'application/json' ? extractJson(text) : undefined

    return {
      ok: true,
      text,
      json,
      model,
      provider: GEMINI_NATIVE_PROVIDER_ID,
      latencyMs: Date.now() - started,
      usage: response.usageMetadata,
      raw: {
        responseId: response.responseId,
        modelVersion: response.modelVersion,
      },
    }
  } catch (error) {
    return {
      ok: false,
      model,
      provider: GEMINI_NATIVE_PROVIDER_ID,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : 'Gemini Native API request failed.',
    }
  }
}

export async function status(): Promise<ProviderStatusResult> {
  const hasKey = Boolean(getGeminiNativeApiKey())
  return {
    ok: hasKey,
    providerId: GEMINI_NATIVE_PROVIDER_ID,
    providerName: 'Gemini Native API',
    modelOrTool: hasKey ? 'gemini-2.5-pro' : 'GEMINI_API_KEY',
    online: hasKey,
    error: hasKey ? undefined : 'GEMINI_API_KEY is missing.',
    detail: {
      models: GEMINI_NATIVE_MODELS,
      capabilities: GEMINI_NATIVE_CAPABILITIES,
      hasApiKey: hasKey,
    },
  }
}

export async function ask(prompt: string, options: ProviderAskOptions = {}): Promise<ProviderAskResult> {
  const started = Date.now()
  const structured = options.taskType === 'code_patch' || options.purpose === 'patch'
  const result = await callGeminiNative({
    prompt,
    mode: structured ? 'workspace-patch-plan' : 'chat',
    responseMimeType: structured ? 'application/json' : 'text/plain',
    temperature: options.temperature,
    maxOutputTokens: options.maxTokens,
    systemInstruction: structured
      ? 'Return structured JSON only. Do not include markdown fences or commentary.'
      : undefined,
  })

  return {
    ok: result.ok,
    providerId: GEMINI_NATIVE_PROVIDER_ID,
    providerName: 'Gemini Native API',
    modelOrTool: result.model,
    text: result.text ?? '',
    latencyMs: Date.now() - started,
    source: 'api',
    error: result.error,
  }
}
