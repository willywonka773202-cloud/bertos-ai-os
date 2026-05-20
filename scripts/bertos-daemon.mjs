#!/usr/bin/env node
import http from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, appendFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const execFileAsync = promisify(execFile)

const HOST = process.env.BERTOS_DAEMON_HOST || '127.0.0.1'
const PORT = Number(process.env.BERTOS_DAEMON_PORT || 8787)
const STARTED_AT = Date.now()
const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'bertos-daemon.log')

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

const logs = []

async function logCommand(entry) {
  const record = {
    timestamp: new Date().toISOString(),
    ...entry,
  }
  logs.push(record)
  if (logs.length > 200) logs.shift()
  await mkdir(LOG_DIR, { recursive: true })
  await appendFile(LOG_FILE, `${JSON.stringify(record)}\n`, 'utf8')
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
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
  return String(value || '').trim().toLowerCase()
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

  if ((exe === 'npm' || exe === 'pnpm') && args[0] && !['run', 'test', 'exec', '--version', '-v'].includes(String(args[0]))) {
    return { safe: false, reason: `${exe} is limited to run/test/exec/version commands.` }
  }

  if (exe === 'git' && args[0] && ['clean', 'reset', 'checkout', 'switch', 'branch', 'push'].includes(String(args[0]))) {
    return { safe: false, reason: `git ${args[0]} is blocked by the local daemon. Run it manually if you intend to mutate git state.` }
  }

  return { safe: true }
}

async function runCommand({ executable, args = [], input = '', cwd = process.cwd(), timeoutMs = 120000 }) {
  const exe = normalizeExecutable(executable)
  const safe = isSafeCommand(exe, args)
  const started = Date.now()

  await logCommand({
    type: 'run-cli',
    executable: exe,
    args,
    cwd,
    safe: safe.safe,
    blockedReason: safe.reason,
  })

  if (!safe.safe) {
    return {
      ok: false,
      executable: exe,
      args,
      stdout: '',
      stderr: '',
      exitCode: null,
      durationMs: Date.now() - started,
      error: safe.reason,
    }
  }

  try {
    const child = execFileAsync(exe, args.map(String), {
      cwd,
      timeout: Math.min(Number(timeoutMs) || 120000, 300000),
      maxBuffer: 1024 * 1024 * 20,
      windowsHide: true,
      shell: false,
    })

    if (input) {
      child.child.stdin?.write(String(input))
      child.child.stdin?.end()
    }

    const { stdout, stderr } = await child
    return {
      ok: true,
      executable: exe,
      args,
      stdout: String(stdout || ''),
      stderr: String(stderr || ''),
      exitCode: 0,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    return {
      ok: false,
      executable: exe,
      args,
      stdout: String(error?.stdout || ''),
      stderr: String(error?.stderr || ''),
      exitCode: typeof error?.code === 'number' ? error.code : null,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function buildAskCommand(providerId, prompt) {
  const normalized = String(providerId || 'codex-cli')
  if (!CLI_TOOLS[normalized]) {
    throw new Error(`Unsupported CLI provider: ${providerId}`)
  }

  if (normalized === 'claude-code') {
    return { providerId: normalized, executable: 'claude', args: ['-p', prompt] }
  }
  if (normalized === 'gemini-cli') {
    return { providerId: normalized, executable: 'gemini', args: ['-p', prompt] }
  }
  return { providerId: normalized, executable: 'codex', args: ['exec', prompt] }
}

async function detectTool(tool) {
  const result = await runCommand({
    executable: tool.executable,
    args: ['--version'],
    timeoutMs: 10000,
  })
  return {
    ...tool,
    installed: result.ok,
    version: result.ok ? result.stdout.trim() || result.stderr.trim() : undefined,
    loginStatus: result.ok ? 'available' : 'missing',
    error: result.ok ? undefined : result.error || result.stderr || 'Not found on PATH.',
  }
}

async function detectTools() {
  return Promise.all(Object.values(CLI_TOOLS).map(detectTool))
}

async function statusPayload() {
  return {
    online: true,
    available: true,
    host: HOST,
    port: PORT,
    uptimeMs: Date.now() - STARTED_AT,
    tools: await detectTools(),
    logsCount: logs.length,
    startCommand: 'npm run bertos:daemon',
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`)

    if (req.method === 'GET' && url.pathname === '/status') {
      return json(res, 200, await statusPayload())
    }

    if (req.method === 'GET' && url.pathname === '/tools') {
      return json(res, 200, { tools: await detectTools() })
    }

    if (req.method === 'POST' && url.pathname === '/run-cli') {
      const body = await readJson(req)
      const result = await runCommand({
        executable: body.executable,
        args: Array.isArray(body.args) ? body.args : [],
        input: body.input,
        cwd: body.cwd || process.cwd(),
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
      const result = await runCommand({
        ...command,
        cwd: body.cwd || process.cwd(),
        timeoutMs: body.timeoutMs || 180000,
      })
      return json(res, result.ok ? 200 : 400, { providerId: command.providerId, ...result })
    }

    return json(res, 404, { error: 'Not found.' })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`BertOS local CLI daemon listening on http://${HOST}:${PORT}`)
  console.log('Allowed executables: claude, codex, gemini, git, npm, node, pnpm')
})
