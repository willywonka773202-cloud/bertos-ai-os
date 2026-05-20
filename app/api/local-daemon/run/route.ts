import { NextRequest, NextResponse } from 'next/server'
import { runLocalDaemonCommand } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { executable?: string; args?: string[]; cwd?: string; timeoutMs?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.executable) {
    return NextResponse.json({ ok: false, error: 'executable is required.' }, { status: 400 })
  }

  try {
    const result = await runLocalDaemonCommand(body.executable, Array.isArray(body.args) ? body.args : [], {
      cwd: body.cwd,
      timeoutMs: body.timeoutMs,
    })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Local daemon command failed.',
    }, { status: 400 })
  }
}
