import { NextRequest, NextResponse } from 'next/server'
import {
  callGeminiNative,
  GEMINI_NATIVE_CAPABILITIES,
  GEMINI_NATIVE_MODELS,
  getGeminiNativeApiKey,
  type GeminiNativeMode,
} from '@/lib/bertos/providers/gemini-native'
import { schemaForGeminiMode } from '@/lib/bertos/providers/gemini-schemas'

export const runtime = 'nodejs'

const SUPPORTED_MODES: GeminiNativeMode[] = [
  'chat',
  'structured-plan',
  'workspace-patch-plan',
  'council-judge',
  'system-analysis',
  'autopilot-report',
]

function isMode(value: unknown): value is GeminiNativeMode {
  return typeof value === 'string' && SUPPORTED_MODES.includes(value as GeminiNativeMode)
}

export async function GET() {
  const hasApiKey = Boolean(getGeminiNativeApiKey())
  const serverGateEnabled = process.env.ENABLE_API_PROVIDERS === 'true'
  const available = hasApiKey && serverGateEnabled
  return NextResponse.json({
    available,
    provider: 'gemini-api-native',
    hasApiKey,
    serverGateEnabled,
    supportedModes: SUPPORTED_MODES,
    models: GEMINI_NATIVE_MODELS,
    capabilities: GEMINI_NATIVE_CAPABILITIES,
    error: available
      ? undefined
      : hasApiKey
        ? 'Gemini Native API key is configured, but ENABLE_API_PROVIDERS=true is required server-side before routing can use it.'
        : 'Missing GEMINI_API_KEY. GOOGLE_API_KEY is also supported as a fallback.',
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(req: NextRequest) {
  let body: {
    prompt?: unknown
    mode?: unknown
    model?: unknown
    systemInstruction?: unknown
    context?: unknown
    temperature?: unknown
    maxOutputTokens?: unknown
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    return NextResponse.json({ ok: false, error: 'prompt is required.' }, { status: 400 })
  }
  if (prompt.length > 200000) {
    return NextResponse.json({ ok: false, error: 'prompt is too large for this route.' }, { status: 413 })
  }
  if (process.env.ENABLE_API_PROVIDERS !== 'true') {
    return NextResponse.json({
      ok: false,
      error: 'Gemini Native API is disabled until ENABLE_API_PROVIDERS=true is set server-side.',
    }, { status: 403 })
  }

  const mode = isMode(body.mode) ? body.mode : 'chat'
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : undefined
  const context = Array.isArray(body.context)
    ? body.context
        .filter((item): item is { label: string; content: string } =>
          item && typeof item === 'object' && typeof item.label === 'string' && typeof item.content === 'string'
        )
        .slice(0, 20)
    : undefined
  const systemInstruction = typeof body.systemInstruction === 'string' ? body.systemInstruction : undefined
  const schema = schemaForGeminiMode(mode)

  const result = await callGeminiNative({
    prompt,
    mode,
    model,
    systemInstruction,
    context,
    responseSchema: schema,
    responseMimeType: schema ? 'application/json' : 'text/plain',
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    maxOutputTokens: typeof body.maxOutputTokens === 'number' ? body.maxOutputTokens : undefined,
  })

  return NextResponse.json({
    ok: result.ok,
    provider: result.provider,
    model: result.model,
    mode,
    text: result.text,
    json: result.json,
    latencyMs: result.latencyMs,
    usage: result.usage,
    error: result.error,
  }, {
    status: result.ok ? 200 : 400,
    headers: { 'Cache-Control': 'no-store' },
  })
}
