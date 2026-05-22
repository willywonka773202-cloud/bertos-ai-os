import { NextRequest, NextResponse } from 'next/server'
import { runLocalDaemonCommand } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

const SAFE_COMMANDS: Record<string, { executable: string; args: string[]; timeoutMs?: number }> = {
  'git status': { executable: 'git', args: ['status'], timeoutMs: 30000 },
  'git diff': { executable: 'git', args: ['diff'], timeoutMs: 30000 },
  'git diff --stat': { executable: 'git', args: ['diff', '--stat'], timeoutMs: 30000 },
  'git log --oneline -5': { executable: 'git', args: ['log', '--oneline', '-5'], timeoutMs: 30000 },
  'git log --oneline -20': { executable: 'git', args: ['log', '--oneline', '-20'], timeoutMs: 30000 },
  'git remote -v': { executable: 'git', args: ['remote', '-v'], timeoutMs: 30000 },
  'git fetch --dry-run': { executable: 'git', args: ['fetch', '--dry-run'], timeoutMs: 60000 },
  'git stash list': { executable: 'git', args: ['stash', 'list'], timeoutMs: 30000 },
  'npm run typecheck': { executable: 'npm', args: ['run', 'typecheck'], timeoutMs: 180000 },
  'npm run build': { executable: 'npm', args: ['run', 'build'], timeoutMs: 240000 },
  'npm run bertos:safety': { executable: 'npm', args: ['run', 'bertos:safety'], timeoutMs: 120000 },
  'npm run smoke': { executable: 'npm', args: ['run', 'smoke'], timeoutMs: 180000 },
  'npm run smoke:payload': { executable: 'npm', args: ['run', 'smoke:payload'], timeoutMs: 120000 },
  'npm run validate': { executable: 'npm', args: ['run', 'validate'], timeoutMs: 300000 },
}

export async function POST(req: NextRequest) {
  let body: { executable?: string; args?: string[]; command?: string; cwd?: string; timeoutMs?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.executable && body.command) {
    const normalized = body.command.trim().replace(/\s+/g, ' ')
    const safe = SAFE_COMMANDS[normalized]
    if (!safe) {
      return NextResponse.json({ ok: false, error: `Command is not allowlisted: ${normalized}` }, { status: 400 })
    }
    body.executable = safe.executable
    body.args = safe.args
    body.timeoutMs = body.timeoutMs ?? safe.timeoutMs
  }

  if (!body.executable) {
    return NextResponse.json({ ok: false, error: 'executable or allowlisted command is required.' }, { status: 400 })
  }

  try {
    const result = await runLocalDaemonCommand(body.executable, Array.isArray(body.args) ? body.args : [], {
      cwd: body.cwd,
      timeoutMs: body.timeoutMs,
    })
    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Local daemon command failed.',
    }, { status: 400 })
  }
}
