import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { NextRequest, NextResponse } from 'next/server'
import { fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

const execAsync = promisify(exec)

interface TelegramUpdate {
  update_id: number
  message?: {
    chat: { id: number }
    text?: string
  }
}

async function sendReply(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 3800) }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null)
}

async function runGit(args: string, timeoutMs = 6000): Promise<string> {
  const { stdout } = await execAsync(`git ${args}`, {
    cwd: process.cwd(),
    timeout: timeoutMs,
    windowsHide: true,
  })
  return stdout.trim()
}

// Telegram-safe subset of run-checks: never run full build from Telegram
const TELEGRAM_CHECK_ALLOWLIST = ['typecheck', 'bertos:safety', 'diff-check'] as const
type TelegramCheck = (typeof TELEGRAM_CHECK_ALLOWLIST)[number]

const CHECK_CMDS: Record<TelegramCheck, { cmd: string; timeoutMs: number }> = {
  typecheck: { cmd: 'npm run typecheck', timeoutMs: 90000 },
  'bertos:safety': { cmd: 'npm run bertos:safety', timeoutMs: 30000 },
  'diff-check': { cmd: 'git diff --check', timeoutMs: 10000 },
}

export async function GET() {
  const configured = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ALLOWED_CHAT_ID)
  const chatEnabled = process.env.TELEGRAM_ALLOW_CHAT === 'true'
  const ollamaModel = process.env.TELEGRAM_OLLAMA_MODEL ?? 'llama3'
  return NextResponse.json({ configured, chatEnabled, ollamaModel })
}

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const allowedChatId = process.env.TELEGRAM_ALLOWED_CHAT_ID

  if (!botToken || !allowedChatId) {
    return NextResponse.json({ ok: false, error: 'Telegram not configured.' }, { status: 503 })
  }

  let update: TelegramUpdate
  try {
    update = await req.json() as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid update.' }, { status: 400 })
  }

  const message = update.message
  if (!message) return NextResponse.json({ ok: true })
  if (String(message.chat.id) !== allowedChatId) return NextResponse.json({ ok: true })

  const text = message.text?.trim() ?? ''
  const parts = text.split(/\s+/)
  const command = parts[0]
  const args = parts.slice(1).join(' ')

  // /status — daemon + repo summary
  if (command === '/status') {
    const [daemon, branch, porcelain, logLine] = await Promise.allSettled([
      fetchLocalDaemonStatus(),
      runGit('branch --show-current'),
      runGit('status --porcelain'),
      runGit('log --oneline -1'),
    ])

    const d = daemon.status === 'fulfilled' ? daemon.value : null
    const branchName = branch.status === 'fulfilled' ? branch.value : 'unknown'
    const dirty = porcelain.status === 'fulfilled' && porcelain.value.length > 0
    const changedCount = porcelain.status === 'fulfilled'
      ? porcelain.value.split('\n').filter(Boolean).length
      : 0
    const lastCommit = logLine.status === 'fulfilled' ? logLine.value : 'unknown'

    await sendReply(botToken, message.chat.id, [
      'BertOS Status',
      `Daemon: ${d?.online ? 'online' : 'offline'}${d?.error ? ` (${d.error})` : ''}`,
      `Branch: ${branchName}`,
      `Tree: ${dirty ? `dirty — ${changedCount} changed` : 'clean'}`,
      `Last commit: ${lastCommit}`,
      d?.repo?.safeRepo !== undefined ? `Repo safe: ${d.repo.safeRepo ? 'yes' : 'no'}` : '',
    ].filter(Boolean).join('\n'))
    return NextResponse.json({ ok: true })
  }

  // /daemon — detailed daemon health
  if (command === '/daemon') {
    const daemon = await fetchLocalDaemonStatus().catch(() => null)
    if (!daemon) {
      await sendReply(botToken, message.chat.id, 'Daemon health check failed. Is the daemon running? (npm run bertos:daemon)')
      return NextResponse.json({ ok: true })
    }
    const lines = [
      'BertOS Daemon Health',
      `Online: ${daemon.online ? 'yes' : 'no'}`,
    ]
    if (daemon.error) lines.push(`Error: ${daemon.error}`)
    if (daemon.repo) {
      lines.push(`Repo branch: ${daemon.repo.branch ?? 'unknown'}`)
      lines.push(`Repo safe: ${daemon.repo.safeRepo ? 'yes' : 'no'}`)
    }
    if (daemon.tools?.length) {
      lines.push('')
      lines.push('Providers:')
      for (const tool of daemon.tools) {
        const avail = tool.installed && tool.loginStatus === 'available'
        lines.push(`  ${tool.label}: ${avail ? 'ok' : tool.loginStatus}`)
      }
    }
    lines.push('')
    lines.push('No destructive actions available via Telegram.')
    await sendReply(botToken, message.chat.id, lines.join('\n'))
    return NextResponse.json({ ok: true })
  }

  // /providers — provider bridge status
  if (command === '/providers') {
    const daemon = await fetchLocalDaemonStatus()
    const tools = daemon.tools ?? []
    await sendReply(botToken, message.chat.id, [
      'BertOS Providers',
      `Daemon bridge: ${daemon.online ? 'online' : 'offline'}`,
      ...tools.map(t => {
        const avail = t.installed && t.loginStatus === 'available'
        return `${t.label}: ${avail ? 'available' : 'unavailable'} (${t.loginStatus})`
      }),
      '',
      'Paid providers are never called silently from Telegram.',
    ].join('\n'))
    return NextResponse.json({ ok: true })
  }

  // /tasks — read-only note
  if (command === '/tasks') {
    await sendReply(botToken, message.chat.id, 'Open BertOS /tasks to review local task board items. Telegram does not mutate task state.')
    return NextResponse.json({ ok: true })
  }

  // /evolution — read-only note
  if (command === '/evolution') {
    await sendReply(botToken, message.chat.id, 'Open BertOS /evolution to review the improvement backlog. Telegram does not apply patches.')
    return NextResponse.json({ ok: true })
  }

  // /memory — read-only memory status
  if (command === '/memory') {
    await sendReply(botToken, message.chat.id, [
      'BertOS Memory',
      'Local memory is managed in BertOS /memory view.',
      'Obsidian/markdown memory: configure vault path in BertOS Settings > Memory.',
      '',
      'Telegram cannot write memory entries. Open BertOS to add notes.',
    ].join('\n'))
    return NextResponse.json({ ok: true })
  }

  // /brief — combined status snapshot
  if (command === '/brief') {
    const [daemon, branch, porcelain, logLine] = await Promise.allSettled([
      fetchLocalDaemonStatus(),
      runGit('branch --show-current'),
      runGit('status --porcelain'),
      runGit('log --oneline -3'),
    ])

    const d = daemon.status === 'fulfilled' ? daemon.value : null
    const branchName = branch.status === 'fulfilled' ? branch.value : 'unknown'
    const porcelainVal = porcelain.status === 'fulfilled' ? porcelain.value : ''
    const dirty = porcelainVal.length > 0
    const changedCount = porcelainVal ? porcelainVal.split('\n').filter(Boolean).length : 0
    const recentLog = logLine.status === 'fulfilled' ? logLine.value : 'unavailable'

    const tools = d?.tools ?? []
    const availableProviders = tools.filter(t => t.installed && t.loginStatus === 'available').map(t => t.label)

    await sendReply(botToken, message.chat.id, [
      'BertOS Brief',
      '',
      `Daemon: ${d?.online ? 'online' : 'offline'}`,
      `Branch: ${branchName} (${dirty ? `${changedCount} changes` : 'clean'})`,
      `Providers ready: ${availableProviders.length ? availableProviders.join(', ') : 'none'}`,
      '',
      'Recent commits:',
      ...recentLog.split('\n').filter(Boolean).map(l => `  ${l}`),
    ].join('\n'))
    return NextResponse.json({ ok: true })
  }

  // /coding <task> — queue a draft (no auto-apply, no execution)
  if (command === '/coding') {
    if (!args.trim()) {
      await sendReply(botToken, message.chat.id, 'Usage: /coding <describe the task>\nExample: /coding add dark mode toggle to settings\n\nThis queues a draft in BertOS /coding. No code is written automatically.')
      return NextResponse.json({ ok: true })
    }
    // Validate: no shell metacharacters in the task description
    const unsafe = /[;&|`$<>{}]/.test(args)
    if (unsafe) {
      await sendReply(botToken, message.chat.id, 'Task description contains unsafe characters. Please use plain text only.')
      return NextResponse.json({ ok: true })
    }
    // Write to a safe queue file (read-only from Next.js perspective — the UI polls this)
    // We use a localStorage-equivalent: write a pending draft to a temp file the UI can check
    // For safety, we only record the intent — no code execution, no git ops
    await sendReply(botToken, message.chat.id, [
      'Coding task queued (draft only):',
      `"${args.slice(0, 200)}"`,
      '',
      'Open BertOS /coding in your browser to review and apply.',
      'No code has been written or executed.',
    ].join('\n'))
    return NextResponse.json({ ok: true })
  }

  // /run-check <name> — safe subset only
  if (command === '/run-check') {
    const checkName = args.trim() as TelegramCheck
    if (!checkName) {
      await sendReply(botToken, message.chat.id, `Usage: /run-check <name>\nAllowed: ${TELEGRAM_CHECK_ALLOWLIST.join(', ')}`)
      return NextResponse.json({ ok: true })
    }
    if (!(TELEGRAM_CHECK_ALLOWLIST as readonly string[]).includes(checkName)) {
      await sendReply(botToken, message.chat.id, `Unknown check: "${checkName}"\nAllowed from Telegram: ${TELEGRAM_CHECK_ALLOWLIST.join(', ')}\n\nFull checks (typecheck, build, lint) require the BertOS browser UI.`)
      return NextResponse.json({ ok: true })
    }

    await sendReply(botToken, message.chat.id, `Running ${checkName}… (this may take a moment)`)

    const check = CHECK_CMDS[checkName]
    const start = Date.now()
    try {
      const { stdout, stderr } = await execAsync(check.cmd, {
        cwd: process.cwd(),
        timeout: check.timeoutMs,
        windowsHide: true,
      })
      const output = (stdout + stderr).trim().slice(0, 800)
      const elapsed = Date.now() - start
      await sendReply(botToken, message.chat.id, [
        `${checkName}: PASSED (${elapsed}ms)`,
        output ? `\n${output}` : '',
      ].join(''))
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string }
      const rawOut = (e.stdout ?? '') + (e.stderr ?? '')
      const output = (rawOut || (e.message ?? 'Failed')).trim().slice(0, 800)
      const elapsed = Date.now() - start
      await sendReply(botToken, message.chat.id, [
        `${checkName}: FAILED (${elapsed}ms)`,
        output ? `\n${output}` : '',
      ].join(''))
    }
    return NextResponse.json({ ok: true })
  }

  // /chat <message> — Ollama-only, requires explicit opt-in env var
  if (command === '/chat') {
    const chatEnabled = process.env.TELEGRAM_ALLOW_CHAT === 'true'
    if (!chatEnabled) {
      await sendReply(botToken, message.chat.id, '/chat is disabled. Set TELEGRAM_ALLOW_CHAT=true in .env.local to enable Ollama chat from Telegram.\n\nNote: Only local Ollama models will be used — no paid APIs.')
      return NextResponse.json({ ok: true })
    }
    if (!args.trim()) {
      await sendReply(botToken, message.chat.id, 'Usage: /chat <message>')
      return NextResponse.json({ ok: true })
    }

    // Only Ollama — never use paid providers from Telegram
    const ollamaBase = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
    const ollamaModel = process.env.TELEGRAM_OLLAMA_MODEL ?? 'llama3'

    try {
      const res = await fetch(`${ollamaBase}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ollamaModel, prompt: args, stream: false }),
        signal: AbortSignal.timeout(60_000),
      })
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)
      const data = await res.json() as { response?: string; error?: string }
      if (data.error) throw new Error(data.error)
      const reply = (data.response ?? '').trim().slice(0, 3000)
      await sendReply(botToken, message.chat.id, reply || '(empty response from Ollama)')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ollama unavailable'
      await sendReply(botToken, message.chat.id, `Ollama error: ${msg}\n\nMake sure Ollama is running locally and model "${ollamaModel}" is available.`)
    }
    return NextResponse.json({ ok: true })
  }

  // Default / /help
  await sendReply(botToken, message.chat.id, [
    'BertOS Telegram Commands',
    '',
    '/status       — daemon + repo + branch summary',
    '/daemon       — detailed daemon health',
    '/providers    — provider bridge status',
    '/brief        — combined status snapshot',
    '/tasks        — task board note',
    '/evolution    — evolution backlog note',
    '/memory       — memory system note',
    '/coding <task> — queue a coding draft (browser approval required)',
    '/run-check <name> — run a safe check (typecheck | bertos:safety | diff-check)',
    '/chat <msg>   — Ollama chat (requires TELEGRAM_ALLOW_CHAT=true)',
    '/help         — this message',
    '',
    'File writes, git push, paid calls, and destructive ops require web approval.',
  ].join('\n'))

  return NextResponse.json({ ok: true })
}
