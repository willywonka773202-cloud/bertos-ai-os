import { NextRequest, NextResponse } from 'next/server'
import { callHermesNous } from '@/lib/bertos/providers/hermes-nous'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { message?: string; sessionId?: string; systemPrompt?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ ok: false, error: 'message is required.' }, { status: 400 })
  }

  const result = await callHermesNous({
    prompt: body.message,
    systemInstruction: body.systemPrompt,
  })

  if (!result.ok) {
    const status = result.error?.includes('paid-gated') ? 403 : result.error?.includes('required') ? 503 : 502
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({
    ok: true,
    text: result.text ?? '',
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
    usage: result.usage,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
