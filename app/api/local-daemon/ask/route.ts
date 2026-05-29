import { NextRequest, NextResponse } from 'next/server'
import { askLocalDaemon, type LocalCliProvider } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

const VALID_PROVIDERS = new Set(['claude-code', 'codex-cli', 'gemini-cli', 'openclaw-cli'])

export async function POST(req: NextRequest) {
  let body: {
    providerId?: string
    prompt?: string
    cwd?: string
    timeoutMs?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ ok: false, error: 'prompt is required.' }, { status: 400 })
  }

  const providerId = body.providerId || 'codex-cli'
  if (!VALID_PROVIDERS.has(providerId)) {
    return NextResponse.json({ ok: false, error: `Unsupported local CLI provider: ${providerId}` }, { status: 400 })
  }

  try {
    const result = await askLocalDaemon(providerId as LocalCliProvider, body.prompt, {
      cwd: body.cwd,
      timeoutMs: body.timeoutMs,
    })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Local CLI bridge request failed.' },
      { status: 503 },
    )
  }
}
