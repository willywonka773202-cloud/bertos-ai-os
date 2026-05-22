import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const apiUrl = process.env.HERMES_API_URL
  const apiKey = process.env.HERMES_API_KEY

  if (!apiUrl || !apiKey) {
    return NextResponse.json({
      ok: false,
      error: 'Hermes is not configured. Set HERMES_API_URL and HERMES_API_KEY in .env.local.',
    }, { status: 503 })
  }

  let body: { title?: string; description?: string; schedule?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ ok: false, error: 'title is required.' }, { status: 400 })
  }

  try {
    const res = await fetch(`${apiUrl}/task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: (data as { error?: string }).error || `Hermes returned HTTP ${res.status}` }, { status: 502 })
    }
    return NextResponse.json({ ok: true, ...data })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Hermes task failed.',
    }, { status: 502 })
  }
}
