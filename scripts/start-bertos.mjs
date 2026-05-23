#!/usr/bin/env node
/**
 * BertOS dev launcher — starts the Next.js dev server and daemon together.
 * Usage: node scripts/start-bertos.mjs [--port <n>] [--no-daemon]
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'
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
const portIdx = args.indexOf('--port')
const port = portIdx !== -1 ? args[portIdx + 1] : process.env.PORT || '3004'

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

// Start Next.js dev server
log(CYAN, 'NEXT', `Starting dev server on port ${port}...`)
spawnProc('NEXT', CYAN, 'npm', ['run', 'dev'], { PORT: port })

// Start daemon (unless suppressed)
if (!noDaemon) {
  const daemonScript = join(ROOT, 'scripts', 'bertos-daemon.mjs')
  if (existsSync(daemonScript)) {
    log(AMBER, 'DAEMON', 'Starting local CLI bridge on port 8787...')
    spawnProc('DAEMON', AMBER, 'node', [daemonScript])
  } else {
    log(DIM, 'DAEMON', 'scripts/bertos-daemon.mjs not found — skipping daemon.')
  }
}

log(GREEN, 'START', `BertOS launching → http://localhost:${port}`)
log(DIM, 'TIP', 'Press Ctrl+C to stop all processes.')

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
