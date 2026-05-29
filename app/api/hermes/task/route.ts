import { NextRequest, NextResponse } from 'next/server'
import { getHermesNousConfig } from '@/lib/bertos/providers/hermes-nous'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const cfg = getHermesNousConfig()

  if (!cfg.enabled) {
    return NextResponse.json({
      ok: false,
      error: 'Hermes task creation is disabled. Set HERMES_ENABLED=true and configure HERMES_BASE_URL server-side.',
    }, { status: 503 })
  }

  if (!cfg.apiUrl || (!cfg.apiKey && !cfg.allowMissingKey)) {
    return NextResponse.json({
      ok: false,
      error: 'Hermes is not configured. Set HERMES_BASE_URL and HERMES_API_KEY server-side.',
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

  const prompt = [body.title.trim(), body.description?.trim()].filter(Boolean).join('\n\n')
  const scheduled = Boolean(body.schedule?.trim())
  const endpoint = scheduled ? `${cfg.apiUrl}/api/jobs` : `${cfg.v1BaseUrl}/runs`
  const payload = scheduled
    ? {
        name: body.title.trim(),
        prompt,
        schedule: body.schedule?.trim(),
      }
    : {
        input: prompt,
        model: cfg.model,
      }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: (data as { error?: string }).error || `Hermes returned HTTP ${res.status}` }, { status: 502 })
    }
    return NextResponse.json({
      ok: true,
      mode: scheduled ? 'job' : 'run',
      ...data,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Hermes task failed.',
    }, { status: 502 })
  }
}
