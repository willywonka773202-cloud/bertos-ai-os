import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { getLocalDaemonBaseUrl, fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'
import { offlineDaemonHealth } from '@/lib/bertos/daemon-health'

export const runtime = 'nodejs'

async function readPackageInfo() {
  try {
    const parsed = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      version?: string
      scripts?: Record<string, string>
    }
    return {
      version: parsed.version,
      scripts: parsed.scripts ?? {},
      packageJsonDetected: true,
    }
  } catch {
    return {
      version: undefined,
      scripts: {},
      packageJsonDetected: false,
    }
  }
}

export async function GET() {
  const packageInfo = await readPackageInfo()
  const status = await fetchLocalDaemonStatus(5000)

  if (!status.online) {
    return NextResponse.json({
      ...offlineDaemonHealth('Local daemon is not running.'),
      daemonUrl: getLocalDaemonBaseUrl(),
      version: packageInfo.version,
      packageJsonDetected: packageInfo.packageJsonDetected,
      scripts: {
        typecheck: Boolean(packageInfo.scripts.typecheck),
        build: Boolean(packageInfo.scripts.build),
        lint: Boolean(packageInfo.scripts.lint),
        test: Boolean(packageInfo.scripts.test),
        bertosDaemon: Boolean(packageInfo.scripts['bertos:daemon']),
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const repo = status.repo
  const repoDetected = Boolean(repo?.root)
  const gitDetected = Boolean(repo?.branch)
  const repoSafe = Boolean(repo?.safeRepo)

  return NextResponse.json({
    ok: repoDetected && repoSafe,
    daemonOnline: true,
    daemonUrl: getLocalDaemonBaseUrl(),
    version: packageInfo.version,
    uptimeMs: status.uptimeMs,
    workspaceRoot: repo?.root,
    repoDetected,
    gitDetected,
    packageJsonDetected: packageInfo.packageJsonDetected,
    scripts: {
      typecheck: Boolean(packageInfo.scripts.typecheck),
      build: Boolean(packageInfo.scripts.build),
      lint: Boolean(packageInfo.scripts.lint),
      test: Boolean(packageInfo.scripts.test),
      bertosDaemon: Boolean(packageInfo.scripts['bertos:daemon']),
    },
    capabilities: {
      readFiles: repoDetected && repoSafe,
      runSafeCommands: repoDetected && repoSafe,
      gitStatus: gitDetected && repoSafe,
      gitDiff: gitDetected && repoSafe,
      askProvider: true,
    },
    error: repo?.blockedReason,
    fixCommand: status.startCommand || 'npm run bertos:daemon',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
