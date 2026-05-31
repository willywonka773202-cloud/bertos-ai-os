#!/usr/bin/env node
/**
 * BertOS dev launcher — updates safely, starts the daemon and Next.js together,
 * then opens BertOS in the browser.
 * Usage: node scripts/start-bertos.mjs [--port <n>] [--no-daemon] [--no-open] [--no-update]
 */

import { spawn, spawnSync } from 'child_process'
import { existsSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')
const IS_WINDOWS = process.platform === 'win32'

const CYAN   = '\x1b[36m'
const AMBER  = '\x1b[33m'
const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const DIM    = '\x1b[2m'
const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'

function log(color, prefix, msg) {
  process.stdout.write(`${color}${BOLD}[${prefix}]${RESET} ${msg}\n`)
}

const args = process.argv.slice(2)
const noDaemon = args.includes('--no-daemon')
const noOpen = args.includes('--no-open')
const noUpdate = args.includes('--no-update')
const portIdx = args.indexOf('--port')
const port = portIdx !== -1 ? args[portIdx + 1] : process.env.PORT || '3000'
const appUrl = `http://localhost:${port}`
const daemonUrl = process.env.BERTOS_DAEMON_URL || 'http://127.0.0.1:8787/status'

console.log(`
${CYAN}${BOLD}╔═══════════════════════════════════════╗
║  BertOS  ·  Roman Hermes  ·  v0.1.0   ║
╚═══════════════════════════════════════╝${RESET}
${AMBER}Local-first AI OS — no cloud required.${RESET}
${DIM}Root: ${ROOT}${RESET}

`)

// Verify we're in the right repo
const pkgPath = join(ROOT, 'package.json')
if (!existsSync(pkgPath)) {
  log(RED, 'ERROR', `package.json not found at ${pkgPath}. Run from the repo root.`)
  process.exit(1)
}

const processes = []

function runStep(label, color, cmd, cmdArgs, options = {}) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    env: { ...process.env, ...options.env },
    shell: IS_WINDOWS,
    encoding: 'utf8',
  })

  if (!options.silent) {
    for (const line of (result.stdout || '').trimEnd().split('\n')) {
      if (line.trim()) log(color, label, line)
    }
    for (const line of (result.stderr || '').trimEnd().split('\n')) {
      if (line.trim()) log(DIM, label, line)
    }
  }

  return result
}

function hasDirtyWorktree() {
  const result = runStep('GIT', DIM, 'git', ['status', '--porcelain'], { silent: true })
  return result.status !== 0 || Boolean(result.stdout.trim())
}

function syncFromGithub() {
  if (noUpdate) {
    log(DIM, 'UPDATE', 'Skipped by --no-update.')
    return
  }

  const branch = runStep('GIT', DIM, 'git', ['branch', '--show-current'], { silent: true }).stdout.trim()
  if (!branch) {
    log(DIM, 'UPDATE', 'Skipped because this checkout is not on a branch.')
    return
  }

  if (hasDirtyWorktree()) {
    log(AMBER, 'UPDATE', 'Skipped GitHub update because local changes are present. Commit or stash them, then relaunch.')
    return
  }

  log(CYAN, 'UPDATE', `Checking origin/${branch} for updates...`)
  const fetchResult = runStep('GIT', DIM, 'git', ['fetch', 'origin', branch])
  if (fetchResult.status !== 0) {
    log(AMBER, 'UPDATE', 'Fetch failed; continuing with the local checkout.')
    return
  }

  const pullResult = runStep('GIT', DIM, 'git', ['pull', '--ff-only', 'origin', branch])
  if (pullResult.status === 0) {
    log(GREEN, 'UPDATE', 'Repository is up to date.')
  } else {
    log(AMBER, 'UPDATE', 'Fast-forward update was not possible; continuing with the local checkout.')
  }
}

function maybeInstallDependencies() {
  const nodeModulesPackageLock = join(ROOT, 'node_modules', '.package-lock.json')
  const packageLock = join(ROOT, 'package-lock.json')
  const nodeModulesMissing = !existsSync(nodeModulesPackageLock)
  const packageLockChanged = existsSync(packageLock)
    && existsSync(nodeModulesPackageLock)
    && statSync(packageLock).mtimeMs > statSync(nodeModulesPackageLock).mtimeMs

  if (!nodeModulesMissing && !packageLockChanged) {
    log(DIM, 'DEPS', 'Dependencies look current.')
    return
  }

  log(CYAN, 'DEPS', nodeModulesMissing ? 'Installing dependencies...' : 'package-lock.json changed; refreshing dependencies...')
  const result = runStep('DEPS', CYAN, 'npm', ['install'])
  if (result.status !== 0) {
    log(RED, 'DEPS', 'npm install failed. Fix the dependency error, then relaunch BertOS.')
    process.exit(result.status || 1)
  }
}

async function urlReachable(url, timeoutMs = 1200) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function spawnProc(label, color, cmd, cmdArgs, env = {}) {
  const child = spawn(cmd, cmdArgs, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    shell: IS_WINDOWS,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.on('data', d => {
    for (const line of d.toString().trimEnd().split('\n')) {
      if (line.trim()) log(color, label, line)
    }
  })
  child.stderr.on('data', d => {
    for (const line of d.toString().trimEnd().split('\n')) {
      if (line.trim()) log(DIM, label, line)
    }
  })
  child.on('exit', code => {
    log(code === 0 ? GREEN : RED, label, `exited (code ${code})`)
  })

  processes.push(child)
  return child
}

async function main() {
  syncFromGithub()
  maybeInstallDependencies()

  if (!noDaemon) {
    const daemonScript = join(ROOT, 'scripts', 'bertos-daemon.mjs')
    if (await urlReachable(daemonUrl)) {
      log(GREEN, 'DAEMON', 'Local CLI bridge already online.')
    } else if (existsSync(daemonScript)) {
      log(AMBER, 'DAEMON', 'Starting local CLI bridge on port 8787...')
      spawnProc('DAEMON', AMBER, 'node', [daemonScript])
    } else {
      log(DIM, 'DAEMON', 'scripts/bertos-daemon.mjs not found — skipping daemon.')
    }
  }

  if (await urlReachable(appUrl)) {
    log(GREEN, 'NEXT', `Dev server already online at ${appUrl}.`)
  } else {
    log(CYAN, 'NEXT', `Starting dev server on port ${port}...`)
    spawnProc('NEXT', CYAN, 'npm', ['run', 'dev'], { PORT: port })
  }

  log(GREEN, 'START', `BertOS launching → ${appUrl}`)
  log(DIM, 'TIP', 'Press Ctrl+C to stop processes started by this launcher.')

  if (!noOpen && process.platform === 'darwin') {
    setTimeout(() => {
      spawn('open', [appUrl], {
        stdio: 'ignore',
        detached: true,
      }).unref()
    }, 2500)
  }
}

// Graceful shutdown
function shutdown() {
  log(AMBER, 'STOP', 'Shutting down...')
  for (const p of processes) {
    try { p.kill('SIGTERM') } catch {}
  }
  setTimeout(() => process.exit(0), 1000)
}

process.on('SIGINT',  shutdown)
process.on('SIGTERM', shutdown)
process.on('exit',    () => { for (const p of processes) { try { p.kill() } catch {} } })

main().catch(error => {
  log(RED, 'ERROR', error instanceof Error ? error.message : String(error))
  process.exit(1)
})
