import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const execAsync = promisify(exec)

type AllowedCheck = 'typecheck' | 'build' | 'lint' | 'bertos:safety' | 'diff-check'

const ALLOWLIST: Record<AllowedCheck, { cmd: string; timeoutMs: number }> = {
  typecheck: { cmd: 'npm run typecheck', timeoutMs: 120000 },
  build: { cmd: 'npm run build', timeoutMs: 240000 },
  lint: { cmd: 'npx eslint . --max-warnings 0', timeoutMs: 60000 },
  'bertos:safety': { cmd: 'npm run bertos:safety', timeoutMs: 30000 },
  'diff-check': { cmd: 'git diff --check', timeoutMs: 15000 },
}

const MAX_OUTPUT = 4000

function truncate(s: string): string {
  if (s.length <= MAX_OUTPUT) return s
  return s.slice(0, MAX_OUTPUT) + `\n... (truncated, ${s.length - MAX_OUTPUT} chars omitted)`
}

export async function POST(req: NextRequest) {
  let body: { checks?: string[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const requested = (body.checks ?? []) as string[]
  if (!requested.length) {
    return NextResponse.json({ ok: false, error: 'No checks requested.' }, { status: 400 })
  }

  const unknown = requested.filter(c => !(c in ALLOWLIST))
  if (unknown.length) {
    return NextResponse.json({ ok: false, error: `Unknown checks: ${unknown.join(', ')}. Allowed: ${Object.keys(ALLOWLIST).join(', ')}` }, { status: 400 })
  }

  const cwd = process.cwd()
  const results: Record<string, { ok: boolean; output: string; exitCode: number; durationMs: number }> = {}

  for (const checkName of requested) {
    const check = ALLOWLIST[checkName as AllowedCheck]
    const start = Date.now()
    try {
      const { stdout, stderr } = await execAsync(check.cmd, {
        cwd,
        timeout: check.timeoutMs,
        windowsHide: true,
      })
      results[checkName] = {
        ok: true,
        output: truncate(stdout + stderr),
        exitCode: 0,
        durationMs: Date.now() - start,
      }
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; code?: number; message?: string }
      const raw = (e.stdout ?? '') + (e.stderr ?? '')
      const output = truncate(raw || (e.message ?? 'Failed'))
      results[checkName] = {
        ok: false,
        output,
        exitCode: e.code ?? 1,
        durationMs: Date.now() - start,
      }
    }
  }

  const allPassed = Object.values(results).every(r => r.ok)

  return NextResponse.json({
    ok: allPassed,
    results,
    summary: allPassed
      ? `All ${requested.length} check(s) passed.`
      : `${Object.values(results).filter(r => !r.ok).length} of ${requested.length} check(s) failed.`,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
