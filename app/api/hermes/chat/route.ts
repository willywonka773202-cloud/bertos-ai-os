import { NextRequest, NextResponse } from 'next/server'
import { checkHermesRouteRateLimit, hermesPublicConfig, readLimitedJson } from '@/lib/bertos/hermes-proxy'
import { callHermesNous } from '@/lib/bertos/providers/hermes-nous'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-forwarded-for') ?? 'local'
  const rate = checkHermesRouteRateLimit(`chat:${key}`, 20)
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Hermes chat rate limit exceeded.' }, { status: 429 })
  try {
    const body = await readLimitedJson(req)
    const messages = Array.isArray(body.messages)
      ? body.messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
      : undefined
    const message = typeof body.message === 'string' ? body.message : typeof body.prompt === 'string' ? body.prompt : ''
    if (!messages?.length && !message.trim()) {
      return NextResponse.json({ ok: false, error: 'message or messages is required.' }, { status: 400 })
    }
    const result = await callHermesNous({
      prompt: message,
      messages,
      systemInstruction: typeof body.systemPrompt === 'string'
        ? body.systemPrompt
        : 'You are Hermes inside Bert OS. Help the user operate Bert OS safely and clearly.',
      model: typeof body.model === 'string' ? body.model : undefined,
      temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
      maxTokens: typeof body.maxTokens === 'number' ? body.maxTokens : undefined,
    })
    return NextResponse.json({
      ok: result.ok,
      text: result.text ?? '',
      model: result.model,
      provider: result.provider,
      latencyMs: result.latencyMs,
      usage: result.usage,
      config: hermesPublicConfig(),
      error: result.error,
    }, { status: result.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Hermes chat failed.' }, { status: 400 })
  }
}
