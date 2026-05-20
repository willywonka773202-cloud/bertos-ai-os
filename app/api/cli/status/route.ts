import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { CLI_COMMANDS } from '@/lib/bertos/providers'

export const runtime = 'nodejs'

const execFileAsync = promisify(execFile)

async function checkCLI(command: string): Promise<{ available: boolean; version?: string }> {
  try {
    const { stdout } = await execFileAsync(command, ['--version'], { timeout: 3000 })
    return { available: true, version: stdout.trim().split('\n')[0] }
  } catch {
    return { available: false }
  }
}

function requireCliSecret(req: NextRequest): string | null {
  const configured = process.env.BERTOS_AGENT_SECRET?.trim()
  if (!configured) return 'BERTOS_AGENT_SECRET is not configured on this deployment.'
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
    || req.headers.get('x-bertos-agent-secret')?.trim()
  if (supplied !== configured) return 'Invalid or missing BertOS agent secret.'
  return null
}

export async function GET(req: NextRequest) {
  const authError = requireCliSecret(req)
  if (authError) return NextResponse.json({ ok: false, error: authError }, { status: 401 })

  const results = await Promise.allSettled([
    checkCLI(CLI_COMMANDS['claude-code'] ?? 'claude'),
    checkCLI(CLI_COMMANDS['gemini-cli']  ?? 'gemini'),
    checkCLI(CLI_COMMANDS['codex-cli']   ?? 'codex'),
  ])

  const [claude, gemini, codex] = results.map(r =>
    r.status === 'fulfilled' ? r.value : { available: false }
  )

  return NextResponse.json({
    ok: true,
    'claude-code': claude,
    'gemini-cli':  gemini,
    'codex-cli':   codex,
  })
}
