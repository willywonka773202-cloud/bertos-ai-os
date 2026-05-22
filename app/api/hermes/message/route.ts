import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const apiUrl = process.env.HERMES_API_URL
  const apiKey = process.env.HERMES_API_KEY
  const paidEnabled = process.env.ENABLE_HERMES_PAID === 'true'

  if (!paidEnabled) {
    return NextResponse.json({
      ok: false,
      error: 'Hermes / Nous message calls are paid-gated. Set ENABLE_HERMES_PAID=true only when you explicitly accept credit usage.',
    }, { status: 403 })
  }

  if (!apiUrl || !apiKey) {
    return NextResponse.json({
      ok: false,
      error: 'Hermes is not configured. Set HERMES_API_URL and HERMES_API_KEY server-side.',
    }, { status: 503 })
  }

  let body: { message?: string; sessionId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ ok: false, error: 'message is required.' }, { status: 400 })
  }

  try {
    const res = await fetch(`${apiUrl}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ message: body.message, sessionId: body.sessionId }),
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: (data as { error?: string }).error || `Hermes returned HTTP ${res.status}` }, { status: 502 })
    }
    return NextResponse.json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Hermes message failed.',
    }, { status: 502 })
  }
}
