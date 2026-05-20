#!/usr/bin/env node
import http from 'node:http'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, appendFile, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const execFileAsync = promisify(execFile)

const HOST = process.env.BERTOS_DAEMON_HOST || '127.0.0.1'
const PORT = Number(process.env.BERTOS_DAEMON_PORT || 8787)
const STARTED_AT = Date.now()
const REPO_ROOT = process.cwd()
const LOG_DIR = path.join(REPO_ROOT, 'logs')
const LOG_FILE = path.join(LOG_DIR, 'bertos-daemon.log')
const MAX_OUTPUT = 1024 * 1024 * 20

const CLI_TOOLS = {
  'claude-code': { id: 'claude-code', label: 'Claude Code', executable: 'claude' },
  'codex-cli': { id: 'codex-cli', label: 'Codex CLI', executable: 'codex' },
  'gemini-cli': { id: 'gemini-cli', label: 'Gemini CLI', executable: 'gemini' },
}

const ALLOWED_EXECUTABLES = new Set(['claude', 'codex', 'gemini', 'git', 'npm', 'node', 'pnpm'])
const DANGEROUS_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bremove-item\b/i,
  /\bdel\s+\/[fqs]\b/i,
  /\brmdir\s+\/s\b/i,
  /\bformat\b/i,
  /\bshutdown\b/i,
  /\brestart-computer\b/i,
  /\bstop-computer\b/i,
  /\bdiskpart\b/i,
  /\bmkfs\b/i,
  /\btaskkill\b/i,
  /\breg\s+(save|export|delete)\b/i,
  /\bnet\s+user\b/i,
  /\bget-credential\b/i,
  /\bcredential\b/i,
  /\bpassword\b/i,
  /\bsecret\b/i,
  /\.env(\.|$)/i,
]
const IGNORE_DIRS = new Set(['.git', '.next', 'node_modules', 'dist', 'coverage', '.turbo'])

const logs = []
let toolsCache = null
let toolsCacheAt = 0

function nowIso() {
  return new Date().toISOString()
}

function consoleLog(message) {
  console.log(`[${nowIso()}] ${message}`)
}

async function logCommand(entry) {
  const record = { timestamp: nowIso(), ...entry }
  logs.push(record)
  if (logs.length > 300) logs.shift()
  await mkdir(LOG_DIR, { recursive: true })
  await appendFile(LOG_FILE, `${JSON.stringify(record)}\n`, 'utf8')
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Headers': 'content-type,x-bertos-agent-secret',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  res.end(JSON.stringify(payload, null, 2))
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body is too large.'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!body.trim()) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON body.'))
      }
    })
    req.on('error', reject)
  })
}

function normalizeExecutable(value) {
  return String(value || '').trim().toLowerCase().replace(/\.(cmd|exe)$/i, '')
}

function isInsideRepo(target) {
  const resolved = path.resolve(REPO_ROOT, target || '.')
  return resolved === REPO_ROOT || resolved.startsWith(REPO_ROOT + path.sep)
}

function safeRelativePath(value) {
  const raw = String(value || '').replace(/^[/\\]+/, '')
  if (!raw || raw.includes('\0')) throw new Error('Invalid path.')
  if (!isInsideRepo(raw)) throw new Error('Path is outside the BertOS repo.')
  const parts = raw.split(/[\\/]+/)
  if (parts.some(part => IGNORE_DIRS.has(part))) {
    throw new Error('Path is inside an ignored directory.')
  }
  return raw
}

function isSafeCommand(executable, args = []) {
  const exe = normalizeExecutable(executable)
  if (!ALLOWED_EXECUTABLES.has(exe)) {
    return { safe: false, reason: `${exe || 'empty command'} is not allowlisted.` }
  }

  const joined = [exe, ...args.map(String)].join(' ')
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(joined)) {
      return { safe: false, reason: `Command blocked by safety rule: ${pattern}` }
    }
  }

  if ((exe === 'npm' || exe === 'pnpm') && args[0] && !['run', 'test', 'exec', 'install', '--version', '-v'].includes(String(args[0]))) {
    return { safe: false, reason: `${exe} is limited to run/test/exec/install/version commands.` }
  }

  if (exe === 'git' && args[0] && ['clean', 'reset', 'checkout', 'switch', 'branch', 'push'].includes(String(args[0]))) {
    return { safe: false, reason: `git ${args[0]} is blocked by the local daemon. Run it manually if you intend to mutate git state.` }
  }

  return { safe: true }
}

async function execRaw(file, args, options = {}) {
  return execFileAsync(file, args.map(String), {
    cwd: options.cwd || REPO_ROOT,
    timeout: Math.min(Number(options.timeoutMs) || 30000, 300000),
    maxBuffer: MAX_OUTPUT,
    windowsHide: true,
    shell: false,
  })
}

async function whereExecutable(executable) {
  const exe = normalizeExecutable(executable)
  if (process.platform !== 'win32') {
    return { command: exe, resolvedPath: exe, viaCmd: false, candidates: [exe] }
  }

  try {
    const { stdout } = await execRaw('where.exe', [exe], { timeoutMs: 5000 })
    const candidates = stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
    const preferred = candidates.find(item => /\.cmd$/i.test(item))
      || candidates.find(item => /\.exe$/i.test(item))
      || candidates[0]
    if (!preferred) throw new Error('No executable path returned by where.exe.')
    return {
      command: preferred,
      resolvedPath: preferred,
      viaCmd: /\.cmd$/i.test(preferred),
      candidates,
    }
  } catch (error) {
    return {
      command: exe,
      resolvedPath: undefined,
      viaCmd: false,
      candidates: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function runResolvedCommand({ executable, args = [], input = '', cwd = REPO_ROOT, timeoutMs = 120000 }) {
  const exe = normalizeExecutable(executable)
  const safe = isSafeCommand(exe, args)
  const started = Date.now()
  const resolved = await whereExecutable(exe)
  const safeCwd = isInsideRepo(path.relative(REPO_ROOT, path.resolve(cwd))) ? path.resolve(cwd) : REPO_ROOT

  await logCommand({
    type: 'run-cli',
    executable: exe,
    resolvedPath: resolved.resolvedPath,
    viaCmd: resolved.viaCmd,
    args,
    cwd: safeCwd,
    safe: safe.safe,
    blockedReason: safe.reason,
  })

  if (!safe.safe) {
    return {
      ok: false,
      executable: exe,
      resolvedPath: resolved.resolvedPath,
      args,
      stdout: '',
      stderr: '',
      exitCode: null,
      durationMs: Date.now() - started,
      error: safe.reason,
    }
  }

  if (resolved.error && !resolved.resolvedPath) {
    return {
      ok: false,
      executable: exe,
      resolvedPath: undefined,
      args,
      stdout: '',
      stderr: '',
      exitCode: null,
      durationMs: Date.now() - started,
      error: `Could not resolve ${exe} on PATH. ${resolved.error}`,
      troubleshooting: 'On Windows, confirm where.exe can find the command and restart the daemon from a normal PowerShell session.',
    }
  }

  const command = resolved.viaCmd ? 'cmd.exe' : (resolved.resolvedPath || exe)
  const finalArgs = resolved.viaCmd
    ? ['/d', '/c', 'call', resolved.resolvedPath, ...args.map(String)]
    : args.map(String)

  try {
    const child = execFileAsync(command, finalArgs, {
      cwd: safeCwd,
      timeout: Math.min(Number(timeoutMs) || 120000, 300000),
      maxBuffer: MAX_OUTPUT,
      windowsHide: true,
      shell: false,
    })

    if (input) child.child.stdin?.write(String(input))
    child.child.stdin?.end()

    const { stdout, stderr } = await child
    return {
      ok: true,
      executable: exe,
      resolvedPath: resolved.resolvedPath,
      args,
      stdout: String(stdout || ''),
      stderr: String(stderr || ''),
      exitCode: 0,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    const code = error?.code
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      executable: exe,
      resolvedPath: resolved.resolvedPath,
      args,
      stdout: String(error?.stdout || ''),
      stderr: String(error?.stderr || ''),
      exitCode: typeof code === 'number' ? code : null,
      durationMs: Date.now() - started,
      error: message,
      troubleshooting: explainSpawnFailure(message, exe),
    }
  }
}

function explainSpawnFailure(message, exe) {
  if (/ENOENT/i.test(message)) return `${exe} was not found from the daemon process. Run where.exe ${exe} and restart the daemon.`
  if (/EPERM/i.test(message)) return `${exe} was found but Windows blocked execution. Prefer the .cmd shim, restart PowerShell normally, or check antivirus/App Execution Alias settings.`
  if (/timed out/i.test(message)) return `${exe} timed out. Confirm the CLI is logged in and can answer non-interactively.`
  if (/auth|login|sign in/i.test(message)) return `${exe} appears to need login. Run the CLI login command manually in PowerShell.`
  return undefined
}

function buildAskCommand(providerId, prompt) {
  const normalized = String(providerId || 'codex-cli')
  if (!CLI_TOOLS[normalized]) throw new Error(`Unsupported CLI provider: ${providerId}`)

  if (normalized === 'claude-code') return { providerId: normalized, executable: 'claude', args: ['-p', prompt] }
  if (normalized === 'gemini-cli') return { providerId: normalized, executable: 'gemini', args: ['-p', prompt] }
  return { providerId: normalized, executable: 'codex', args: ['exec', prompt] }
}

async function detectTool(tool) {
  const resolved = await whereExecutable(tool.executable)
  const result = await runResolvedCommand({
    executable: tool.executable,
    args: ['--version'],
    timeoutMs: 10000,
  })
  const installed = Boolean(resolved.resolvedPath)
  return {
    ...tool,
    installed,
    resolvedPath: resolved.resolvedPath,
    candidates: resolved.candidates,
    version: result.ok ? result.stdout.trim() || result.stderr.trim() : undefined,
    loginStatus: result.ok ? 'available' : installed ? 'error' : 'missing',
    error: result.ok ? undefined : result.error || result.stderr || resolved.error || 'Not found on PATH.',
    troubleshooting: result.troubleshooting,
  }
}

async function detectTools() {
  if (toolsCache && Date.now() - toolsCacheAt < 10_000) return toolsCache
  toolsCache = await Promise.all(Object.values(CLI_TOOLS).map(detectTool))
  toolsCacheAt = Date.now()
  return toolsCache
}

async function gitOutput(args) {
  try {
    const { stdout } = await execRaw('git', args, { cwd: REPO_ROOT, timeoutMs: 10000 })
    return stdout.trim()
  } catch {
    return ''
  }
}

async function repoStatus() {
  const remote = await gitOutput(['remote', 'get-url', 'origin'])
  const branch = await gitOutput(['branch', '--show-current'])
  const status = await gitOutput(['status', '--short'])
  const root = await gitOutput(['rev-parse', '--show-toplevel'])
  const safeRepo = /bertos-ai-os/i.test(root) && /bertos-ai-os\.git$/i.test(remote) && !/sylistly/i.test(remote)
  return {
    root: root || REPO_ROOT,
    daemonCwd: REPO_ROOT,
    branch,
    remote,
    status,
    safeRepo,
    blockedReason: safeRepo ? undefined : 'Repo safety check failed. Expected bertos-ai-os remote and path with no sylistly remote.',
  }
}

async function listFiles(dir = '.', depth = 0, maxDepth = 4) {
  const rel = safeRelativePath(dir)
  const abs = path.join(REPO_ROOT, rel)
  const entries = await readdir(abs, { withFileTypes: true })
  const nodes = []
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue
    if (entry.name === 'bertos-ai-os') continue
    const childRel = path.join(rel, entry.name)
    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: childRel,
        type: 'dir',
        children: depth < maxDepth ? await listFiles(childRel, depth + 1, maxDepth) : [],
      })
    } else {
      nodes.push({ name: entry.name, path: childRel, type: 'file' })
    }
  }
  return nodes.sort((a, b) => Number(a.type === 'file') - Number(b.type === 'file') || a.name.localeCompare(b.name))
}

async function statusPayload() {
  return {
    online: true,
    available: true,
    host: HOST,
    port: PORT,
    uptimeMs: Date.now() - STARTED_AT,
    tools: await detectTools(),
    repo: await repoStatus(),
    logsCount: logs.length,
    startCommand: 'npm run bertos:daemon',
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return json(res, 204, {})
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`)

    if (req.method === 'GET' && url.pathname === '/status') return json(res, 200, await statusPayload())
    if (req.method === 'GET' && url.pathname === '/tools') return json(res, 200, { tools: await detectTools() })
    if (req.method === 'GET' && url.pathname === '/repo/status') return json(res, 200, await repoStatus())
    if (req.method === 'GET' && url.pathname === '/repo/files') {
      return json(res, 200, { files: await listFiles(url.searchParams.get('dir') || '.') })
    }
    if (req.method === 'GET' && url.pathname === '/repo/file') {
      const rel = safeRelativePath(url.searchParams.get('path'))
      const content = await readFile(path.join(REPO_ROOT, rel), 'utf8')
      return json(res, 200, { path: rel, content })
    }

    if (req.method === 'POST' && (url.pathname === '/repo/file' || url.pathname === '/repo/file/write')) {
      const body = await readJson(req)
      const rel = safeRelativePath(body.path)
      await writeFile(path.join(REPO_ROOT, rel), String(body.content ?? ''), 'utf8')
      await logCommand({ type: 'write-file', path: rel, safe: true })
      return json(res, 200, { ok: true, path: rel })
    }

    if (req.method === 'POST' && (url.pathname === '/run-cli' || url.pathname === '/repo/run')) {
      const body = await readJson(req)
      const result = await runResolvedCommand({
        executable: body.executable,
        args: Array.isArray(body.args) ? body.args : [],
        input: body.input,
        cwd: body.cwd || REPO_ROOT,
        timeoutMs: body.timeoutMs,
      })
      return json(res, result.ok ? 200 : 400, result)
    }

    if (req.method === 'POST' && url.pathname === '/ask-cli') {
      const body = await readJson(req)
      if (!body.prompt || typeof body.prompt !== 'string') {
        return json(res, 400, { ok: false, error: 'prompt is required.' })
      }
      const command = buildAskCommand(body.providerId, body.prompt)
      const result = await runResolvedCommand({
        ...command,
        cwd: body.cwd || REPO_ROOT,
        timeoutMs: body.timeoutMs || 180000,
      })
      return json(res, result.ok ? 200 : 400, { providerId: command.providerId, ...result })
    }

    return json(res, 404, { error: 'Not found.' })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
})

let heartbeat = null

function shutdown(signal) {
  consoleLog(`${signal} received. Shutting down BertOS daemon...`)
  if (heartbeat) clearInterval(heartbeat)
  server.close(() => {
    consoleLog('BertOS daemon closed.')
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 5000).unref()
}

server.on('listening', () => {
  consoleLog(`BertOS local CLI daemon listening on http://${HOST}:${PORT}`)
  consoleLog(`Repo root: ${REPO_ROOT}`)
  consoleLog('Allowed executables: claude, codex, gemini, git, npm, node, pnpm')
})

server.on('error', error => {
  console.error(`[${nowIso()}] BertOS daemon server error:`, error)
  process.exitCode = 1
})

server.on('close', () => {
  consoleLog('BertOS daemon server close event fired.')
})

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', error => {
  console.error(`[${nowIso()}] Uncaught exception:`, error)
})
process.on('unhandledRejection', reason => {
  console.error(`[${nowIso()}] Unhandled rejection:`, reason)
})

server.listen(PORT, HOST)
heartbeat = setInterval(() => {
  // Keep an active event-loop reference and make daemon liveness obvious in logs.
}, 60_000)

// This child is never started; keeping a top-level server reference plus heartbeat
// prevents accidental process exit from transient request failures.
void spawn
