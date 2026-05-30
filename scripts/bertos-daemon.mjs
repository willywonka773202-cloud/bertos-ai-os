#!/usr/bin/env node
import http from 'node:http'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import {
  mkdir,
  appendFile,
  readdir,
  readFile,
  writeFile,
  rm,
  stat,
} from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const execFileAsync = promisify(execFile)

const HOST = process.env.BERTOS_DAEMON_HOST || '127.0.0.1'
const PORT = Number(process.env.BERTOS_DAEMON_PORT || 8787)
const STARTED_AT = Date.now()
const REPO_ROOT = process.cwd()
const LOG_DIR = path.join(REPO_ROOT, 'logs')
const LOG_FILE = path.join(LOG_DIR, 'bertos-daemon.log')
const TOOL_VERIFICATION_FILE = path.join(LOG_DIR, 'tool-verification.json')
const MAX_OUTPUT = 1024 * 1024 * 20
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://bertos-ai-os.vercel.app',
]
const EXTRA_ALLOWED_ORIGINS = String(
  process.env.BERTOS_DAEMON_ALLOWED_ORIGINS || '',
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const ALLOWED_ORIGINS = new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...EXTRA_ALLOWED_ORIGINS,
])
const DAEMON_TOKEN =
  process.env.BERTOS_DAEMON_TOKEN || process.env.BERTOS_AGENT_SECRET || ''
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'main'
const OPENCLAW_SESSION_KEY = process.env.OPENCLAW_SESSION_KEY || 'bertos'
const OPENCLAW_THINKING_LEVEL = process.env.OPENCLAW_THINKING_LEVEL || 'off'
const EXTRA_PATHS = [
  // NOTE: the Codex.app bundle is intentionally NOT on this list. Its
  // Contents/Resources/codex is an app runtime, not a usable codex CLI, and
  // injecting it made BertOS falsely report Codex installed. Set CODEX_CLI_PATH
  // to opt in explicitly.
  '/opt/homebrew/opt/node@22/bin',
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/opt/node@22/bin',
  '/usr/local/bin',
  path.join(process.env.HOME || '', '.local/bin'),
  path.join(process.env.HOME || '', '.opencode/bin'),
].filter(Boolean)

const CLI_TOOLS = {
  'claude-code': {
    id: 'claude-code',
    label: 'Claude Code',
    executable: 'claude',
  },
  'codex-cli': { id: 'codex-cli', label: 'Codex CLI', executable: 'codex' },
  'gemini-cli': { id: 'gemini-cli', label: 'Gemini CLI', executable: 'gemini' },
  'openclaw-cli': {
    id: 'openclaw-cli',
    label: 'OpenClaw',
    executable: 'openclaw',
  },
}

const ALLOWED_EXECUTABLES = new Set([
  'claude',
  'codex',
  'gemini',
  'openclaw',
  'git',
  'npm',
  'node',
  'pnpm',
])
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
const IGNORE_DIRS = new Set([
  '.git',
  '.next',
  'node_modules',
  'dist',
  'coverage',
  '.turbo',
])
const SEARCH_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.mdx',
  '.css',
  '.scss',
  '.html',
])
const PROTECTED_FILE_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
])
const PROTECTED_PATH_PATTERNS = [
  /(^|[\\/])\.env(\.|$)/i,
  /(^|[\\/])config[\\/].*(secret|token|key|credential)/i,
  /(secret|token|credential|private-key|api-key)/i,
]

const logs = []
let toolsCache = null
let toolsCacheAt = 0
const toolVerificationCache = new Map()
let toolVerificationCacheLoaded = false
const ASK_VERIFIED_CLI_TOOLS = new Set(['claude-code', 'gemini-cli'])
const VERSION_VERIFIED_CLI_TOOLS = new Set(['codex-cli'])

function nowIso() {
  return new Date().toISOString()
}

function consoleLog(message) {
  console.log(`[${nowIso()}] ${message}`)
}

function truncateText(value, maxLength = 1200) {
  const text = String(value || '')
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trimEnd()}\n...[truncated ${text.length - maxLength} chars by BertOS daemon status]`
}

async function logCommand(entry) {
  const record = { timestamp: nowIso(), ...entry }
  logs.push(record)
  if (logs.length > 300) logs.shift()
  await mkdir(LOG_DIR, { recursive: true })
  await appendFile(LOG_FILE, `${JSON.stringify(record)}\n`, 'utf8')
}

function json(res, status, payload) {
  const origin = res.bertosOrigin || res.req?.headers?.origin
  const allowedOrigin = allowedCorsOrigin(origin)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...(allowedOrigin
      ? { 'Access-Control-Allow-Origin': allowedOrigin, Vary: 'Origin' }
      : {}),
    'Access-Control-Allow-Headers': 'content-type,x-bertos-agent-secret',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  })
  res.end(JSON.stringify(payload, null, 2))
}

function allowedCorsOrigin(origin) {
  if (!origin) return 'http://localhost:3000'
  if (ALLOWED_ORIGINS.has(origin)) return origin
  if (/^https:\/\/bertos-ai-[a-z0-9-]+\.vercel\.app$/i.test(origin))
    return origin
  return ''
}

function authorizeDaemonRequest(req) {
  if (!DAEMON_TOKEN) return null
  const supplied = String(req.headers['x-bertos-agent-secret'] || '').trim()
  if (supplied === DAEMON_TOKEN) return null
  return 'Daemon token is required. Set BERTOS_DAEMON_TOKEN when starting the daemon and save the same token in BertOS Settings.'
}

function statusForDaemonError(error) {
  const message = error instanceof Error ? error.message : String(error)
  if (
    /invalid path|outside the BertOS repo|ignored directory|protected|blocked by the daemon|only files can be deleted|requires confirm/i.test(
      message,
    )
  ) {
    return 400
  }
  return 500
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
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
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\.(cmd|exe)$/i, '')
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
  if (parts.some((part) => IGNORE_DIRS.has(part))) {
    throw new Error('Path is inside an ignored directory.')
  }
  return raw
}

function safeWritableFilePath(value) {
  const rel = safeRelativePath(value)
  const base = path.basename(rel).toLowerCase()
  if (PROTECTED_FILE_NAMES.has(base)) {
    throw new Error(
      `${rel} is protected and cannot be written or deleted by the daemon.`,
    )
  }
  for (const pattern of PROTECTED_PATH_PATTERNS) {
    if (pattern.test(rel)) {
      throw new Error(
        `${rel} is blocked by the daemon secret/config safety policy.`,
      )
    }
  }
  return rel
}

function isSafeCommand(executable, args = []) {
  const exe = normalizeExecutable(executable)
  if (!ALLOWED_EXECUTABLES.has(exe)) {
    return {
      safe: false,
      reason: `${exe || 'empty command'} is not allowlisted.`,
    }
  }

  const joined = [exe, ...args.map(String)].join(' ')
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(joined)) {
      return {
        safe: false,
        reason: `Command blocked by safety rule: ${pattern}`,
      }
    }
  }

  if (
    (exe === 'npm' || exe === 'pnpm') &&
    args[0] &&
    !['run', 'test', 'exec', 'install', '--version', '-v'].includes(
      String(args[0]),
    )
  ) {
    return {
      safe: false,
      reason: `${exe} is limited to run/test/exec/install/version commands.`,
    }
  }

  if (
    exe === 'git' &&
    args[0] &&
    ['clean', 'reset', 'checkout', 'switch', 'branch', 'push'].includes(
      String(args[0]),
    )
  ) {
    return {
      safe: false,
      reason: `git ${args[0]} is blocked by the local daemon. Run it manually if you intend to mutate git state.`,
    }
  }

  return { safe: true }
}

async function execRaw(file, args, options = {}) {
  return execFileAsync(file, args.map(String), {
    cwd: options.cwd || REPO_ROOT,
    env: commandEnv(),
    timeout: Math.min(Number(options.timeoutMs) || 30000, 300000),
    maxBuffer: MAX_OUTPUT,
    windowsHide: true,
    shell: false,
  })
}

function commandEnv() {
  const currentPath = process.env.PATH || ''
  const pathValue = [
    ...EXTRA_PATHS,
    ...currentPath.split(path.delimiter),
  ].filter(Boolean)
  return {
    ...process.env,
    PATH: [...new Set(pathValue)].join(path.delimiter),
  }
}

async function whereExecutable(executable) {
  const exe = normalizeExecutable(executable)
  if (process.platform !== 'win32') {
    try {
      const { stdout } = await execRaw(
        '/usr/bin/env',
        ['bash', '-lc', `command -v ${exe}`],
        { timeoutMs: 5000 },
      )
      const resolvedPath = stdout.trim().split(/\r?\n/).find(Boolean)
      if (!resolvedPath)
        throw new Error(`No executable path returned for ${exe}.`)
      return {
        command: resolvedPath,
        resolvedPath,
        viaCmd: false,
        candidates: [resolvedPath],
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

  try {
    const { stdout } = await execRaw('where.exe', [exe], { timeoutMs: 5000 })
    const candidates = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    const preferred =
      candidates.find((item) => /\.cmd$/i.test(item)) ||
      candidates.find((item) => /\.exe$/i.test(item)) ||
      candidates[0]
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

async function runResolvedCommand({
  executable,
  args = [],
  input = '',
  cwd = REPO_ROOT,
  timeoutMs = 120000,
}) {
  const exe = normalizeExecutable(executable)
  const safe = isSafeCommand(exe, args)
  const started = Date.now()
  const resolved = await whereExecutable(exe)
  const safeCwd = isInsideRepo(path.relative(REPO_ROOT, path.resolve(cwd)))
    ? path.resolve(cwd)
    : REPO_ROOT

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
      troubleshooting:
        'On Windows, confirm where.exe can find the command and restart the daemon from a normal PowerShell session.',
    }
  }

  const command = resolved.viaCmd ? 'cmd.exe' : resolved.resolvedPath || exe
  const finalArgs = resolved.viaCmd
    ? ['/d', '/c', 'call', resolved.resolvedPath, ...args.map(String)]
    : args.map(String)

  try {
    const child = execFileAsync(command, finalArgs, {
      cwd: safeCwd,
      env: commandEnv(),
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
  if (/ENOENT/i.test(message)) {
    return process.platform === 'win32'
      ? `${exe} was not found from the daemon process. Run where.exe ${exe} and restart the daemon.`
      : `${exe} was not found from the daemon process. Run command -v ${exe} and restart the daemon from a shell where it is on PATH.`
  }
  if (/EPERM/i.test(message)) {
    return process.platform === 'win32'
      ? `${exe} was found but Windows blocked execution. Prefer the .cmd shim, restart PowerShell normally, or check antivirus/App Execution Alias settings.`
      : `${exe} was found but macOS blocked execution. Check permissions and restart the daemon from a normal shell.`
  }
  if (/timed out/i.test(message))
    return `${exe} timed out. Confirm the CLI is logged in and can answer non-interactively.`
  if (/auth|login|sign in/i.test(message))
    return `${exe} appears to need login. Run the CLI login command manually in PowerShell.`
  return undefined
}

function providerSetupHint(providerId) {
  if (providerId === 'claude-code') {
    return 'Claude Code is installed, but BertOS has not verified a non-interactive Claude reply yet. Run claude in Terminal, finish auth/trust, then send a Claude test prompt from BertOS.'
  }
  if (providerId === 'gemini-cli') {
    return 'Gemini CLI is installed, but BertOS has not verified a non-interactive Gemini reply yet. Run gemini in Terminal, choose an auth method, then send a Gemini test prompt from BertOS.'
  }
  if (providerId === 'openclaw-cli') {
    return 'OpenClaw is installed, but BertOS has not verified a non-interactive OpenClaw reply yet. Run ollama launch openclaw --config or openclaw onboard --install-daemon, then send an OpenClaw test prompt from BertOS.'
  }
  return 'CLI is installed, but BertOS has not verified a non-interactive reply yet.'
}

async function loadToolVerificationCache() {
  if (toolVerificationCacheLoaded) return
  toolVerificationCacheLoaded = true
  try {
    const raw = await readFile(TOOL_VERIFICATION_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return
    for (const [providerId, value] of Object.entries(parsed)) {
      if (!CLI_TOOLS[providerId] || !value || typeof value !== 'object')
        continue
      const status =
        value.loginStatus === 'available' || value.loginStatus === 'error'
          ? value.loginStatus
          : 'unknown'
      toolVerificationCache.set(providerId, {
        loginStatus: status,
        checkedAt:
          typeof value.checkedAt === 'string' ? value.checkedAt : undefined,
        error: typeof value.error === 'string' ? value.error : undefined,
        troubleshooting:
          typeof value.troubleshooting === 'string'
            ? value.troubleshooting
            : undefined,
      })
    }
  } catch {
    // Missing or invalid cache is fine; providers will verify on first successful ask.
  }
}

async function persistToolVerificationCache() {
  await mkdir(LOG_DIR, { recursive: true })
  const payload = Object.fromEntries(toolVerificationCache.entries())
  await writeFile(
    TOOL_VERIFICATION_FILE,
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  )
}

async function rememberToolVerification(providerId, result) {
  if (!CLI_TOOLS[providerId]) return
  const message = result.ok
    ? undefined
    : result.stdout ||
      result.stderr ||
      result.error ||
      `${CLI_TOOLS[providerId].label} could not answer from BertOS.`
  toolVerificationCache.set(providerId, {
    loginStatus: result.ok ? 'available' : 'error',
    checkedAt: new Date().toISOString(),
    error: truncateText(message, 1600),
    troubleshooting: truncateText(result.troubleshooting, 800),
  })
  toolsCache = null
  toolsCacheAt = 0
  await persistToolVerificationCache().catch(() => null)
}

function normalizeAskResult(providerId, result) {
  if (providerId !== 'openclaw-cli') return result
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  const failure = output.match(
    /(Context overflow:[^\n]*|GatewayClientRequestError:[^\n]*|Error: No target session selected[^\n]*|Thinking level "[^"]+" is not supported[^\n]*)/i,
  )
  if (!failure) return result
  return {
    ...result,
    ok: false,
    error: truncateText(failure[0], 1600),
  }
}

function buildPatchModePrompt(providerId, prompt) {
  const common = [
    'PATCH MODE IS ACTIVE.',
    'You are a patch compiler. Return only valid JSON for the requested patch schema.',
    'No markdown fences. No explanations. No conversational text. No prose before or after JSON.',
    'Use deterministic output. Prioritize machine-readable correctness over creativity.',
  ].join('\n')

  if (providerId === 'claude-code') {
    return [
      common,
      'Your response must be wrapped exactly as:',
      'BEGIN_PATCH_JSON',
      '{"summary":"...","files":[],"validation":{"commands":["npm run typecheck","npm run build"]}}',
      'END_PATCH_JSON',
      prompt,
    ].join('\n\n')
  }

  if (providerId === 'codex-cli') {
    return [
      common,
      'If your runtime supports response_format=json, use it. Otherwise still output raw JSON only.',
      prompt,
    ].join('\n\n')
  }

  if (providerId === 'gemini-cli') {
    return [
      common,
      'If your runtime supports application/json MIME output, use it. Otherwise still output raw JSON only.',
      prompt,
    ].join('\n\n')
  }

  return `${common}\n\n${prompt}`
}

function buildAskCommand(providerId, prompt, mode = 'chat') {
  const normalized = String(providerId || 'codex-cli')
  if (!CLI_TOOLS[normalized])
    throw new Error(`Unsupported CLI provider: ${providerId}`)
  const finalPrompt =
    mode === 'patch' ? buildPatchModePrompt(normalized, prompt) : prompt

  if (normalized === 'claude-code')
    return {
      providerId: normalized,
      executable: 'claude',
      args: ['-p', finalPrompt],
    }
  if (normalized === 'gemini-cli')
    return {
      providerId: normalized,
      executable: 'gemini',
      args: ['-p', finalPrompt],
    }
  if (normalized === 'openclaw-cli')
    return {
      providerId: normalized,
      executable: 'openclaw',
      args: [
        'agent',
        '--agent',
        OPENCLAW_AGENT_ID,
        '--session-key',
        OPENCLAW_SESSION_KEY,
        '--message',
        finalPrompt,
        '--thinking',
        OPENCLAW_THINKING_LEVEL,
      ],
    }
  return {
    providerId: normalized,
    executable: 'codex',
    args: ['exec', finalPrompt],
  }
}

// Active non-interactive bridge probe per CLI. The prompt is passed as ONE safe argument
// (via buildAskCommand -> ['-p', prompt]); runResolvedCommand uses execFile with shell:false.
const BRIDGE_PROBES = {
  'claude-code': { prompt: 'Reply with exactly: BertOS Claude bridge OK', expect: 'BertOS Claude bridge OK' },
  'gemini-cli': { prompt: 'Reply with exactly: BertOS Gemini bridge OK', expect: 'BertOS Gemini bridge OK' },
}

/**
 * Run the CLI's bridge prompt as a single safe argument, capture and truncate output, and
 * decide login readiness from whether stdout/stderr contains the expected bridge string.
 * Never uses a shell string; relies on runResolvedCommand (execFile, shell:false, timeout).
 */
async function verifyToolBridge(toolId) {
  const spec = BRIDGE_PROBES[toolId]
  if (!spec) return null
  const command = buildAskCommand(toolId, spec.prompt, 'chat')
  const result = await runResolvedCommand({
    executable: command.executable,
    args: command.args,
    timeoutMs: 60000,
  })
  const output = `${result.stdout || ''}\n${result.stderr || ''}`
  const ready = result.ok && output.includes(spec.expect)
  return {
    loginStatus: ready ? 'available' : 'error',
    checkedAt: new Date().toISOString(),
    error: ready
      ? undefined
      : truncateText(
          result.stderr?.trim() ||
            result.error ||
            `${toolId} did not return the expected bridge reply. Run "${command.executable} -p \\"${spec.prompt}\\"" manually to check login.`,
          1200,
        ),
    troubleshooting: ready ? undefined : truncateText(result.troubleshooting, 800),
  }
}

const CODEX_CLI_PATH = process.env.CODEX_CLI_PATH || ''

// Internal Codex app/plugin runtimes (e.g. ~/.codex/plugins/cache/.../app-server-runtime/codex)
// are NOT a usable codex CLI and must never be launched as a provider verifier.
function isCodexNonCliPath(p) {
  const s = String(p || '').replace(/\\/g, '/').toLowerCase()
  if (!s) return false
  // Reject internal Codex app/plugin runtimes and the Codex.app bundle resource binary;
  // do NOT reject a real CLI like ~/.codex/bin/codex or a homebrew/npm install.
  return (
    s.includes('/.codex/plugins/cache/') ||
    s.includes('/.codex/.tmp/') ||
    s.includes('/app-server-runtime/') ||
    s.includes('/bundled-marketplaces/') ||
    s.includes('/codex.app/')
  )
}

// Resolve a usable codex CLI: CODEX_CLI_PATH (valid file, not a cache binary) or codex on PATH.
async function resolveCodexCli() {
  // Explicitly-configured path is trusted (even the app bundle) — verified later via --version.
  if (CODEX_CLI_PATH) {
    try {
      const info = await stat(CODEX_CLI_PATH)
      if (info.isFile()) return { resolvedPath: CODEX_CLI_PATH, candidates: [CODEX_CLI_PATH], explicit: true }
    } catch {}
    return { resolvedPath: undefined, candidates: [], error: `CODEX_CLI_PATH does not point to a valid file: ${CODEX_CLI_PATH}` }
  }
  // Auto-discovery: only a real codex on PATH counts — never the app bundle or cache runtimes.
  const found = await whereExecutable('codex')
  if (found.resolvedPath && !isCodexNonCliPath(found.resolvedPath)) return found
  if (found.resolvedPath && isCodexNonCliPath(found.resolvedPath)) {
    return { resolvedPath: undefined, candidates: found.candidates || [found.resolvedPath], cacheOnly: true }
  }
  return { resolvedPath: undefined, candidates: found.candidates || [], error: found.error }
}

// Verify a real codex CLI non-interactively via `--version` (execFile on the exact path,
// wrapping Windows .cmd/.bat shims through cmd.exe so we never use a shell string).
async function verifyCodexCli(resolved) {
  const resolvedPath = resolved.resolvedPath
  const viaCmd = Boolean(resolved.viaCmd) || /\.(cmd|bat)$/i.test(String(resolvedPath || ''))
  const command = viaCmd ? 'cmd.exe' : resolvedPath
  const args = viaCmd ? ['/d', '/c', 'call', resolvedPath, '--version'] : ['--version']
  try {
    const { stdout, stderr } = await execRaw(command, args, { timeoutMs: 8000 })
    const out = `${stdout || ''}${stderr || ''}`.trim()
    const ok = /\d+\.\d+/.test(out) || /codex/i.test(out)
    return ok
      ? { statusCode: 'ready', version: truncateText(out, 200) }
      : { statusCode: 'command_failed', error: truncateText(out || 'codex --version produced no usable output.', 600) }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const combined = `${msg}${error?.stderr || ''}`
    const timedOut = /timed out|ETIMEDOUT/i.test(combined)
    const authy = /auth|login|sign in|unauthor/i.test(combined)
    return { statusCode: timedOut ? 'timed_out' : authy ? 'auth_required' : 'command_failed', error: truncateText(error?.stderr || msg, 800) }
  }
}

// Map a granular statusCode to the legacy loginStatus the app's provider layer reads.
function loginStatusFor(statusCode) {
  if (statusCode === 'ready') return 'available'
  if (statusCode === 'not_installed') return 'missing'
  if (statusCode === 'auth_required' || statusCode === 'command_failed' || statusCode === 'timed_out') return 'error'
  return 'unknown'
}

async function detectTool(tool, options = {}) {
  const shouldVerifyVersion = Boolean(options.verifyVersion)
  let verification = toolVerificationCache.get(tool.id)

  // ── Codex: only a real CLI on PATH or via CODEX_CLI_PATH counts — never a cache binary. ──
  if (tool.id === 'codex-cli') {
    const resolved = await resolveCodexCli()
    const installed = Boolean(resolved.resolvedPath)
    if (!installed) {
      const statusCode = 'not_installed'
      const error = resolved.cacheOnly
        ? 'Codex app cache detected, but no usable codex CLI command is installed or on PATH.'
        : resolved.error || 'codex was not found on PATH. Install the Codex CLI or set CODEX_CLI_PATH.'
      return { ...tool, installed: false, resolvedPath: undefined, candidates: resolved.candidates, statusCode, loginStatus: loginStatusFor(statusCode), error: truncateText(error), troubleshooting: 'Install a real codex CLI on PATH, or set CODEX_CLI_PATH to a valid executable. Do not point it at ~/.codex cache files.' }
    }
    const alreadyVerified = verification?.loginStatus === 'available' && verification?.error === undefined
    let cache = verification
    let probe
    if (alreadyVerified) {
      probe = { statusCode: 'ready', version: undefined }
    } else {
      probe = await verifyCodexCli(resolved)
      cache = { loginStatus: loginStatusFor(probe.statusCode), checkedAt: new Date().toISOString(), error: probe.error }
      toolVerificationCache.set(tool.id, cache)
      toolsCache = null; toolsCacheAt = 0
      await persistToolVerificationCache().catch(() => null)
    }
    return { ...tool, installed: true, resolvedPath: resolved.resolvedPath, candidates: resolved.candidates, version: probe.version, statusCode: probe.statusCode, loginStatus: cache?.loginStatus ?? 'available', lastVerifiedAt: cache?.checkedAt, error: truncateText(probe.error) }
  }

  // ── claude / gemini / openclaw ──
  const resolved = await whereExecutable(tool.executable)
  const installed = Boolean(resolved.resolvedPath)
  const result = shouldVerifyVersion
    ? await runResolvedCommand({ executable: tool.executable, args: ['--version'], timeoutMs: 3000 })
    : null

  // Deep verification actively probes ASK-verified CLIs (claude-code, gemini-cli) with a
  // single-argument bridge prompt, then caches the result so /status reflects readiness.
  if (shouldVerifyVersion && installed && ASK_VERIFIED_CLI_TOOLS.has(tool.id) && BRIDGE_PROBES[tool.id] && verification?.loginStatus !== 'available') {
    const probe = await verifyToolBridge(tool.id)
    if (probe) {
      verification = probe
      toolVerificationCache.set(tool.id, probe)
      toolsCache = null; toolsCacheAt = 0
      await persistToolVerificationCache().catch(() => null)
    }
  }

  const versionStatus = installed
    ? VERSION_VERIFIED_CLI_TOOLS.has(tool.id) && result?.ok ? 'available' : 'unknown'
    : 'missing'
  const needsAskVerification = installed && ASK_VERIFIED_CLI_TOOLS.has(tool.id) && !verification
  const loginStatus = verification?.loginStatus ?? versionStatus
  const statusCode = loginStatus === 'available' ? 'ready'
    : !installed ? 'not_installed'
    : loginStatus === 'error' ? (/(auth|login|sign in)/i.test(String(verification?.error || '')) ? 'auth_required' : 'command_failed')
    : 'unknown'

  return {
    ...tool,
    installed,
    resolvedPath: resolved.resolvedPath,
    candidates: resolved.candidates,
    version: result?.ok ? result.stdout.trim() || result.stderr.trim() : undefined,
    statusCode,
    loginStatus,
    lastVerifiedAt: verification?.checkedAt,
    error: truncateText(
      verification?.error ??
        (needsAskVerification ? providerSetupHint(tool.id) : undefined) ??
        (result && !result.ok ? result.error || result.stderr : undefined) ??
        (!installed ? resolved.error || 'Not found on PATH.' : undefined),
    ),
    troubleshooting: truncateText(verification?.troubleshooting ?? result?.troubleshooting, 800),
  }
}

async function detectTools(options = {}) {
  if (toolsCache && Date.now() - toolsCacheAt < 10_000) return toolsCache
  await loadToolVerificationCache()
  toolsCache = await Promise.all(
    Object.values(CLI_TOOLS).map((tool) => detectTool(tool, options)),
  )
  toolsCacheAt = Date.now()
  return toolsCache
}

async function gitOutput(args) {
  try {
    const { stdout } = await execRaw('git', args, {
      cwd: REPO_ROOT,
      timeoutMs: 10000,
    })
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
  let packageName = ''
  try {
    const pkg = JSON.parse(
      await readFile(path.join(root || REPO_ROOT, 'package.json'), 'utf8'),
    )
    packageName = String(pkg.name || '')
  } catch {}
  const safeRepo =
    packageName === 'bertos-ai-os' &&
    remote === 'https://github.com/willywonka773202-cloud/bertos-ai-os.git' &&
    !/sylistly/i.test(remote)
  return {
    root: root || REPO_ROOT,
    daemonCwd: REPO_ROOT,
    branch,
    remote,
    status,
    safeRepo,
    blockedReason: safeRepo
      ? undefined
      : 'Repo safety check failed. Expected bertos-ai-os package and remote with no sylistly remote.',
  }
}

async function probeOpenClawGateway() {
  const host = process.env.OPENCLAW_GATEWAY_HOST || '127.0.0.1'
  const port = Number(process.env.OPENCLAW_GATEWAY_PORT || 18789)
  const url = `http://${host}:${port}`
  const checkedAt = new Date().toISOString()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2500)

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    const xFrameOptions = response.headers.get('x-frame-options') || ''
    const contentSecurityPolicy =
      response.headers.get('content-security-policy') || ''
    const frameBlockers = [
      /deny|sameorigin/i.test(xFrameOptions)
        ? `X-Frame-Options: ${xFrameOptions}`
        : '',
      /frame-ancestors\s+('none'|'self')/i.test(contentSecurityPolicy)
        ? `Content-Security-Policy: ${contentSecurityPolicy.match(/frame-ancestors[^;]*/i)?.[0] || 'frame-ancestors'}`
        : '',
    ].filter(Boolean)
    return {
      online: response.ok,
      host,
      port,
      url,
      chatUrl: `${url}/chat?session=agent%3Amain%3Amain`,
      wsUrl: `ws://${host}:${port}`,
      checkedAt,
      frameEmbedding: frameBlockers.length ? 'blocked' : 'allowed',
      frameBlockers,
      statusCode: response.status,
      error: response.ok
        ? undefined
        : `OpenClaw Gateway returned HTTP ${response.status}.`,
    }
  } catch (error) {
    return {
      online: false,
      host,
      port,
      url,
      chatUrl: `${url}/chat?session=agent%3Amain%3Amain`,
      wsUrl: `ws://${host}:${port}`,
      checkedAt,
      frameEmbedding: 'unknown',
      error:
        error instanceof Error
          ? error.message
          : 'OpenClaw Gateway is not reachable.',
    }
  } finally {
    clearTimeout(timeout)
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
        children:
          depth < maxDepth
            ? await listFiles(childRel, depth + 1, maxDepth)
            : [],
      })
    } else {
      nodes.push({ name: entry.name, path: childRel, type: 'file' })
    }
  }
  return nodes.sort(
    (a, b) =>
      Number(a.type === 'file') - Number(b.type === 'file') ||
      a.name.localeCompare(b.name),
  )
}

async function collectSearchFiles(dir = '.', output = [], maxFiles = 1200) {
  if (output.length >= maxFiles) return output
  const rel = safeRelativePath(dir)
  const abs = path.join(REPO_ROOT, rel)
  const entries = await readdir(abs, { withFileTypes: true })
  for (const entry of entries) {
    if (output.length >= maxFiles) break
    if (IGNORE_DIRS.has(entry.name)) continue
    const childRel = path.join(rel, entry.name)
    if (entry.isDirectory()) {
      await collectSearchFiles(childRel, output, maxFiles)
    } else if (SEARCH_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      output.push(childRel)
    }
  }
  return output
}

function lineSnippet(lines, index, radius = 2) {
  const start = Math.max(0, index - radius)
  const end = Math.min(lines.length, index + radius + 1)
  return lines.slice(start, end).map((line, offset) => ({
    lineNumber: start + offset + 1,
    text: line,
  }))
}

async function searchRepo({ terms = [], globs = [], maxResults = 40 } = {}) {
  const normalizedTerms = [
    ...new Set(
      (Array.isArray(terms) ? terms : [])
        .map((term) => String(term || '').trim())
        .filter((term) => term.length >= 2),
    ),
  ]
  const normalizedGlobs = (Array.isArray(globs) ? globs : [])
    .map((glob) => String(glob || '').toLowerCase())
    .filter(Boolean)
  const files = await collectSearchFiles('.')
  const results = []

  for (const rel of files) {
    const normalizedRel = rel.replace(/\\/g, '/')
    if (
      normalizedGlobs.length &&
      !normalizedGlobs.some((glob) =>
        normalizedRel.toLowerCase().includes(glob.replace(/\*/g, '')),
      )
    ) {
      continue
    }

    let content = ''
    try {
      content = await readFile(path.join(REPO_ROOT, rel), 'utf8')
    } catch {
      continue
    }
    const lines = content.split(/\r?\n/)
    const lowerContent = content.toLowerCase()
    const lowerPath = normalizedRel.toLowerCase()
    const matchedTerms = normalizedTerms.filter(
      (term) =>
        lowerContent.includes(term.toLowerCase()) ||
        lowerPath.includes(term.toLowerCase()),
    )
    if (!matchedTerms.length) continue
    const snippets = []
    for (const term of matchedTerms.slice(0, 6)) {
      const lowerTerm = term.toLowerCase()
      const lineIndex = lines.findIndex((line) =>
        line.toLowerCase().includes(lowerTerm),
      )
      snippets.push({
        term,
        lines: lineIndex >= 0 ? lineSnippet(lines, lineIndex) : [],
      })
    }
    results.push({
      path: normalizedRel,
      matchedTerms,
      snippets,
    })
  }

  const rankedResults = results
    .sort(
      (a, b) =>
        b.matchedTerms.length - a.matchedTerms.length ||
        b.snippets.reduce((count, snippet) => count + snippet.lines.length, 0) -
          a.snippets.reduce(
            (count, snippet) => count + snippet.lines.length,
            0,
          ) ||
        a.path.localeCompare(b.path),
    )
    .slice(0, maxResults)

  return {
    terms: normalizedTerms,
    globs: normalizedGlobs,
    results: rankedResults,
  }
}

async function statusPayload() {
  return {
    online: true,
    available: true,
    host: HOST,
    port: PORT,
    uptimeMs: Date.now() - STARTED_AT,
    tools: await detectTools({ verifyVersion: false }),
    openClawGateway: await probeOpenClawGateway(),
    repo: await repoStatus(),
    logsCount: logs.length,
    startCommand: 'npm run bertos:daemon',
  }
}

const server = http.createServer(async (req, res) => {
  res.bertosOrigin = req.headers.origin
  try {
    if (req.method === 'OPTIONS') return json(res, 204, {})
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`)
    const authError = authorizeDaemonRequest(req)
    if (authError)
      return json(res, 401, { ok: false, online: false, error: authError })

    if (req.method === 'GET' && url.pathname === '/status')
      return json(res, 200, await statusPayload())
    if (req.method === 'GET' && url.pathname === '/tools') {
      const verifyVersion = url.searchParams.get('verify') === '1'
      return json(res, 200, { tools: await detectTools({ verifyVersion }) })
    }
    if (req.method === 'GET' && url.pathname === '/repo/status')
      return json(res, 200, await repoStatus())
    if (req.method === 'GET' && url.pathname === '/repo/files') {
      return json(res, 200, {
        files: await listFiles(url.searchParams.get('dir') || '.'),
      })
    }
    if (url.pathname === '/repo/search') {
      const body = req.method === 'POST' ? await readJson(req) : {}
      const terms =
        req.method === 'POST' ? body.terms : url.searchParams.getAll('term')
      const globs =
        req.method === 'POST' ? body.globs : url.searchParams.getAll('glob')
      const maxResults =
        req.method === 'POST'
          ? Number(body.maxResults || 40)
          : Number(url.searchParams.get('maxResults') || 40)
      return json(
        res,
        200,
        await searchRepo({
          terms,
          globs,
          maxResults: Math.min(Math.max(maxResults, 1), 100),
        }),
      )
    }
    if (req.method === 'GET' && url.pathname === '/repo/file') {
      const rel = safeRelativePath(url.searchParams.get('path'))
      const content = await readFile(path.join(REPO_ROOT, rel), 'utf8')
      return json(res, 200, { path: rel, content })
    }

    if (
      req.method === 'POST' &&
      (url.pathname === '/repo/file' || url.pathname === '/repo/file/write')
    ) {
      const body = await readJson(req)
      const rel = safeWritableFilePath(body.path)
      await writeFile(
        path.join(REPO_ROOT, rel),
        String(body.content ?? ''),
        'utf8',
      )
      await logCommand({ type: 'write-file', path: rel, safe: true })
      return json(res, 200, { ok: true, path: rel })
    }

    if (req.method === 'POST' && url.pathname === '/repo/file/create') {
      const body = await readJson(req)
      const rel = safeWritableFilePath(body.path)
      const target = path.join(REPO_ROOT, rel)
      try {
        await stat(target)
        return json(res, 409, {
          ok: false,
          error: `${rel} already exists. Use modify instead of create.`,
        })
      } catch {
        // Missing is expected.
      }
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, String(body.content ?? ''), 'utf8')
      await logCommand({ type: 'create-file', path: rel, safe: true })
      return json(res, 200, { ok: true, path: rel, operation: 'create' })
    }

    if (req.method === 'POST' && url.pathname === '/repo/file/delete') {
      const body = await readJson(req)
      const rel = safeWritableFilePath(body.path)
      if (
        body.confirm !== true ||
        body.patchHistoryId !== body.confirmPatchHistoryId
      ) {
        return json(res, 400, {
          ok: false,
          error:
            'File delete requires confirm=true and matching patch history confirmation ids.',
        })
      }
      const target = path.join(REPO_ROOT, rel)
      const info = await stat(target)
      if (!info.isFile()) {
        return json(res, 400, {
          ok: false,
          error: 'Only files can be deleted by the daemon.',
        })
      }
      await rm(target, { force: false, recursive: false })
      await logCommand({
        type: 'delete-file',
        path: rel,
        patchHistoryId: body.patchHistoryId,
        safe: true,
      })
      return json(res, 200, { ok: true, path: rel, operation: 'delete' })
    }

    if (
      req.method === 'POST' &&
      (url.pathname === '/run-cli' || url.pathname === '/repo/run')
    ) {
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
      const command = buildAskCommand(body.providerId, body.prompt, body.mode)
      const result = await runResolvedCommand({
        ...command,
        cwd: body.cwd || REPO_ROOT,
        timeoutMs: body.timeoutMs || 180000,
      })
      const normalizedResult = normalizeAskResult(command.providerId, result)
      await rememberToolVerification(command.providerId, normalizedResult)
      return json(res, normalizedResult.ok ? 200 : 400, {
        providerId: command.providerId,
        ...normalizedResult,
      })
    }

    return json(res, 404, { error: 'Not found.' })
  } catch (error) {
    return json(res, statusForDaemonError(error), {
      error: error instanceof Error ? error.message : String(error),
    })
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
  consoleLog(
    'Allowed executables: claude, codex, gemini, openclaw, git, npm, node, pnpm',
  )
  // Background, non-blocking provider verification so CLIs self-verify (claude/gemini bridge
  // probe + codex --version) without a manual Test and without blocking /status.
  setTimeout(() => {
    detectTools({ verifyVersion: true })
      .then((tools) => consoleLog(`Provider verification: ${tools.map((t) => `${t.id}=${t.statusCode || t.loginStatus}`).join(', ')}`))
      .catch(() => {})
  }, 1500)
})

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(
      [
        `[${nowIso()}] BertOS daemon is already running on http://${HOST}:${PORT}.`,
        'This is usually OK. Keep the existing daemon running, or restart it after code/provider changes.',
        `Check status: curl http://${HOST}:${PORT}/status`,
        `Find process: lsof -nP -iTCP:${PORT} -sTCP:LISTEN`,
        'Restart safely: kill the listed node PID, then run npm run bertos:daemon from the BertOS repo.',
      ].join('\n'),
    )
    if (heartbeat) clearInterval(heartbeat)
    process.exit(0)
  }
  console.error(`[${nowIso()}] BertOS daemon server error:`, error)
  if (heartbeat) clearInterval(heartbeat)
  process.exit(1)
})

server.on('close', () => {
  consoleLog('BertOS daemon server close event fired.')
})

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', (error) => {
  console.error(`[${nowIso()}] Uncaught exception:`, error)
})
process.on('unhandledRejection', (reason) => {
  console.error(`[${nowIso()}] Unhandled rejection:`, reason)
})

server.listen(PORT, HOST)
heartbeat = setInterval(() => {
  // Keep an active event-loop reference and make daemon liveness obvious in logs.
}, 60_000)

// This child is never started; keeping a top-level server reference plus heartbeat
// prevents accidental process exit from transient request failures.
void spawn
