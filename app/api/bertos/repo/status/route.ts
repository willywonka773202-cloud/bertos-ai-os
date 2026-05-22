import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const execAsync = promisify(exec)

async function runGit(args: string, cwd: string, timeoutMs = 8000): Promise<string> {
  const { stdout } = await execAsync(`git ${args}`, { cwd, timeout: timeoutMs, windowsHide: true })
  return stdout.trim()
}

export async function GET() {
  const cwd = process.cwd()

  try {
    const [branch, statusOutput, logLine, diffStat] = await Promise.allSettled([
      runGit('branch --show-current', cwd),
      runGit('status --porcelain', cwd),
      runGit('log --oneline -1', cwd),
      runGit('diff --stat HEAD', cwd),
    ])

    const branchName = branch.status === 'fulfilled' ? branch.value : 'unknown'
    const porcelain = statusOutput.status === 'fulfilled' ? statusOutput.value : ''
    const dirty = porcelain.length > 0
    const lastCommit = logLine.status === 'fulfilled' ? logLine.value : 'unknown'
    const diffStatOutput = diffStat.status === 'fulfilled' ? diffStat.value : ''

    // Parse dirty file count from porcelain output
    const changedFiles = porcelain ? porcelain.split('\n').filter(Boolean).length : 0

    return NextResponse.json({
      ok: true,
      repoRoot: cwd,
      branch: branchName,
      dirty,
      changedFiles,
      lastCommit,
      diffStat: diffStatOutput || (dirty ? `${changedFiles} file(s) changed` : 'clean'),
      safetyStatus: 'safe',
      selfBuildMode: true,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : 'Could not read repo status.',
      repoRoot: cwd,
      branch: 'unknown',
      dirty: false,
      changedFiles: 0,
      lastCommit: 'unknown',
      diffStat: 'unavailable',
      safetyStatus: 'unknown',
      selfBuildMode: false,
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
