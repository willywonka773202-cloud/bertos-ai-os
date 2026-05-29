import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { NextRequest, NextResponse } from 'next/server'
import { fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'
import { getHermesNousConfig, status as getHermesNousProviderStatus } from '@/lib/bertos/providers/hermes-nous'
import { getOllamaConfig } from '@/lib/bertos/runtime'
import { resolveOllamaModel } from '@/lib/bertos/providers/ollama'
import { recordTelegramRemoteEvent } from '@/lib/bertos/telegram-remote'

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

function inferTelegramCommand(text: string): { command: string; args: string; inferred: boolean } {
  const trimmed = text.trim()
  if (trimmed.startsWith('/')) {
    const parts = trimmed.split(/\s+/)
    return { command: parts[0], args: parts.slice(1).join(' '), inferred: false }
  }

  const lower = trimmed.toLowerCase()
  const stripTaskPrefix = trimmed
    .replace(/^(please\s+)?(make|create|add|write|build|fix|change|update|code|coding task|task)\s+(me\s+)?/i, '')
    .trim()

  if (/\b(type ?check|typescript|tsc)\b/.test(lower)) {
    return { command: '/run-check', args: 'typecheck', inferred: true }
  }
  if (/\b(safety|safe repo|repo safety|bertos safety)\b/.test(lower)) {
    return { command: '/run-check', args: 'bertos:safety', inferred: true }
  }
  if (/\b(diff check|check diff|whitespace|formatting issues)\b/.test(lower)) {
    return { command: '/run-check', args: 'diff-check', inferred: true }
  }
  if (/\b(provider|providers|models|codex|claude|gemini|ollama)\b/.test(lower)) {
    return { command: '/providers', args: '', inferred: true }
  }
  if (/\b(daemon|local bridge|bridge|terminal)\b/.test(lower)) {
    return { command: '/daemon', args: '', inferred: true }
  }
  if (/\b(hermes)\b/.test(lower)) {
    return { command: '/hermes', args: '', inferred: true }
  }
  if (/\b(brief|summary|what'?s going on|overview|daily)\b/.test(lower)) {
    return { command: '/brief', args: '', inferred: true }
  }
  if (/\b(status|health|are we online|is bertos running)\b/.test(lower)) {
    return { command: '/status', args: '', inferred: true }
  }
  if (/\b(task|code|coding|build|fix|implement|change|update|add)\b/.test(lower)) {
    return { command: '/coding', args: stripTaskPrefix || trimmed, inferred: true }
  }

  return { command: '/chat', args: trimmed, inferred: true }
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
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

  if (!botToken || !allowedChatId) {
    return NextResponse.json({ ok: false, error: 'Telegram not configured.' }, { status: 503 })
  }

  if (webhookSecret) {
    const incomingSecret = req.headers.get('x-telegram-bot-api-secret-token')
    if (incomingSecret !== webhookSecret) {
      return NextResponse.json({ ok: false, error: 'Invalid Telegram webhook secret.' }, { status: 401 })
    }
  }

  let update: TelegramUpdate
  try {
    update = await req.json() as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid update.' }, { status: 400 })
  }

  const message = update.message
  if (!message) return NextResponse.json({ ok: true })
  const chatId = message.chat.id
  const telegramBotToken = botToken
  if (String(message.chat.id) !== allowedChatId) {
    recordTelegramRemoteEvent({
      type: 'ignored',
      chatId,
      command: 'unauthorized',
      detail: 'Ignored Telegram update from a non-allowlisted chat.',
    })
    return NextResponse.json({ ok: true })
  }

  const text = message.text?.trim() ?? ''
  const inferredCommand = inferTelegramCommand(text)
  const command = inferredCommand.command
  const args = inferredCommand.args

  recordTelegramRemoteEvent({
    type: 'incoming',
    chatId,
    command: command || '(empty)',
    text,
    detail: inferredCommand.inferred ? `Interpreted as ${command}${args ? ` ${args}` : ''}` : undefined,
  })

  async function reply(text: string, detail?: string) {
    recordTelegramRemoteEvent({
      type: 'reply',
      chatId,
      command: command || '(empty)',
      text,
      detail,
    })
    await sendReply(telegramBotToken, chatId, text)
  }

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

    await reply([
      'BertOS Status',
      `Daemon: ${d?.online ? 'online' : 'offline'}${d?.error ? ` (${d.error})` : ''}`,
      `Branch: ${branchName}`,
      `Tree: ${dirty ? `dirty — ${changedCount} changed` : 'clean'}`,
      `Last commit: ${lastCommit}`,
      d?.repo?.safeRepo !== undefined ? `Repo safe: ${d.repo.safeRepo ? 'yes' : 'no'}` : '',
    ].filter(Boolean).join('\n'), `Branch ${branchName}; ${dirty ? `${changedCount} changed files` : 'clean tree'}.`)
    return NextResponse.json({ ok: true })
  }

  // /daemon — detailed daemon health
  if (command === '/daemon') {
    const daemon = await fetchLocalDaemonStatus().catch(() => null)
    if (!daemon) {
      await reply('Daemon health check failed. Is the daemon running? (npm run bertos:daemon)', 'Daemon health check failed.')
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
    await reply(lines.join('\n'), `Daemon ${daemon.online ? 'online' : 'offline'}.`)
    return NextResponse.json({ ok: true })
  }

  // /providers — provider bridge status
  if (command === '/providers') {
    const daemon = await fetchLocalDaemonStatus()
    const tools = daemon.tools ?? []
    await reply([
      'BertOS Providers',
      `Daemon bridge: ${daemon.online ? 'online' : 'offline'}`,
      ...tools.map(t => {
        const avail = t.installed && t.loginStatus === 'available'
        return `${t.label}: ${avail ? 'available' : 'unavailable'} (${t.loginStatus})`
      }),
      '',
      'Paid providers are never called silently from Telegram.',
    ].join('\n'), `${tools.filter(t => t.installed && t.loginStatus === 'available').length} local CLI providers available.`)
    return NextResponse.json({ ok: true })
  }

  // /hermes — safe Hermes Hostinger status, no chat completion
  if (command === '/hermes') {
    const cfg = getHermesNousConfig()
    const hermesStatus = await getHermesNousProviderStatus()
    await reply([
      'BertOS Hermes',
      `Configured: ${cfg.apiUrl && (cfg.apiKey || cfg.allowMissingKey) ? 'yes' : 'no'}`,
      `Enabled: ${cfg.enabled ? 'yes' : 'no'}`,
      `Mode: ${cfg.backendMode}`,
      `Paid provider optional: ${cfg.paidEnabled ? 'enabled behind Hermes' : 'not required'}`,
      `Reachable: ${hermesStatus.online ? 'yes' : 'no'}`,
      `Model: ${hermesStatus.modelOrTool}`,
      hermesStatus.error ? `Status: ${hermesStatus.error}` : '',
      '',
      'No Hermes chat completion was run.',
      'Hermes is manual-selection only and is never part of Telegram fallback routing.',
    ].filter(Boolean).join('\n'), `Hermes ${cfg.enabled ? 'enabled' : 'disabled'}; reachable ${hermesStatus.online ? 'yes' : 'no'}.`)
    return NextResponse.json({ ok: true })
  }

  // /tasks — read-only note
  if (command === '/tasks') {
    await reply('Open BertOS /tasks to review local task board items. Telegram does not mutate task state.', 'Tasks are browser-review only.')
    return NextResponse.json({ ok: true })
  }

  // /evolution — read-only note
  if (command === '/evolution') {
    await reply('Open BertOS /evolution to review the improvement backlog. Telegram does not apply patches.', 'Evolution backlog is browser-review only.')
    return NextResponse.json({ ok: true })
  }

  // /memory — read-only memory status
  if (command === '/memory') {
    await reply([
      'BertOS Memory',
      'Local memory is managed in BertOS /memory view.',
      'Obsidian/markdown memory: configure vault path in BertOS Settings > Memory.',
      '',
      'Telegram cannot write memory entries. Open BertOS to add notes.',
    ].join('\n'), 'Memory command displayed guidance only.')
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

    await reply([
      'BertOS Brief',
      '',
      `Daemon: ${d?.online ? 'online' : 'offline'}`,
      `Branch: ${branchName} (${dirty ? `${changedCount} changes` : 'clean'})`,
      `Providers ready: ${availableProviders.length ? availableProviders.join(', ') : 'none'}`,
      '',
      'Recent commits:',
      ...recentLog.split('\n').filter(Boolean).map(l => `  ${l}`),
    ].join('\n'), `Brief generated for ${branchName}; daemon ${d?.online ? 'online' : 'offline'}.`)
    return NextResponse.json({ ok: true })
  }

  // /coding <task> — capture an intent summary (no auto-apply, no execution)
  if (command === '/coding') {
    if (!args.trim()) {
      await reply('Usage: /coding <describe the task>\nExample: /coding add dark mode toggle to settings\n\nThis returns a review-ready task summary. No code is written automatically.', 'Coding task was missing.')
      return NextResponse.json({ ok: true })
    }
    // Validate: no shell metacharacters in the task description
    const unsafe = /[;&|`$<>{}]/.test(args)
    if (unsafe) {
      await reply('Task description contains unsafe characters. Please use plain text only.', 'Rejected unsafe task text.')
      return NextResponse.json({ ok: true })
    }
    await reply([
      'Coding task captured (review only):',
      `"${args.slice(0, 200)}"`,
      '',
      'Open BertOS /coding in your browser and paste this task to compile a mission.',
      'No code has been written or executed.',
    ].join('\n'), `Captured coding task: ${args.slice(0, 120)}`)
    return NextResponse.json({ ok: true })
  }

  // /run-check <name> — safe subset only
  if (command === '/run-check') {
    const checkName = args.trim() as TelegramCheck
    if (!checkName) {
      await reply(`Usage: /run-check <name>\nAllowed: ${TELEGRAM_CHECK_ALLOWLIST.join(', ')}`, 'Run-check was missing a check name.')
      return NextResponse.json({ ok: true })
    }
    if (!(TELEGRAM_CHECK_ALLOWLIST as readonly string[]).includes(checkName)) {
      await reply(`Unknown check: "${checkName}"\nAllowed from Telegram: ${TELEGRAM_CHECK_ALLOWLIST.join(', ')}\n\nFull checks (typecheck, build, lint) require the BertOS browser UI.`, `Rejected unknown check: ${checkName}`)
      return NextResponse.json({ ok: true })
    }

    recordTelegramRemoteEvent({
      type: 'running',
      chatId,
      command,
      text: `/run-check ${checkName}`,
      detail: `Running ${checkName} from Telegram.`,
    })
    await reply(`Running ${checkName}... (this may take a moment)`, `Started ${checkName}.`)

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
      recordTelegramRemoteEvent({
        type: 'completed',
        chatId,
        command,
        text: `${checkName}: PASSED`,
        detail: output || `${checkName} passed.`,
      })
      await reply([
        `${checkName}: PASSED (${elapsed}ms)`,
        output ? `\n${output}` : '',
      ].join(''))
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; message?: string }
      const rawOut = (e.stdout ?? '') + (e.stderr ?? '')
      const output = (rawOut || (e.message ?? 'Failed')).trim().slice(0, 800)
      const elapsed = Date.now() - start
      recordTelegramRemoteEvent({
        type: 'failed',
        chatId,
        command,
        text: `${checkName}: FAILED`,
        detail: output || `${checkName} failed.`,
      })
      await reply([
        `${checkName}: FAILED (${elapsed}ms)`,
        output ? `\n${output}` : '',
      ].join(''))
    }
    return NextResponse.json({ ok: true })
  }

  // /chat <message> — Ollama-only. Plain inferred chat is allowed for local Ollama;
  // explicit /chat in cloud/API-key mode still requires TELEGRAM_ALLOW_CHAT=true.
  if (command === '/chat') {
    const chatEnabled = process.env.TELEGRAM_ALLOW_CHAT === 'true'
    if (!args.trim()) {
      await reply('Send me a normal message, or ask for a safe action like “run typecheck” or “what providers are online?”', 'Chat message was missing.')
      return NextResponse.json({ ok: true })
    }

    // Only Ollama — never route Telegram chat to Hermes or external API providers.
    const ollama = getOllamaConfig()
    const ollamaModel = resolveOllamaModel(process.env.TELEGRAM_OLLAMA_MODEL ?? 'ollama-pro')
    const plainLocalChat = inferredCommand.inferred && ollama.mode === 'local' && !ollama.requiresApiKey

    if (!chatEnabled && !plainLocalChat) {
      await reply('Telegram chat is disabled for cloud/API-key providers. I can still answer remote-control requests like “status”, “providers”, “run typecheck”, or “give me a brief”.', 'Telegram chat is disabled except local inferred Ollama chat.')
      return NextResponse.json({ ok: true })
    }

    if (ollama.requiresApiKey && !ollama.apiKey) {
      await reply('Ollama Cloud is selected, but OLLAMA_API_KEY is missing in the BertOS server environment. I did not call any paid provider.', 'Ollama Cloud key missing.')
      return NextResponse.json({ ok: true })
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (ollama.apiKey) headers.Authorization = `Bearer ${ollama.apiKey}`

      const res = await fetch(ollama.chatUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: ollamaModel,
          messages: [{ role: 'user', content: args }],
          stream: false,
        }),
        signal: AbortSignal.timeout(60_000),
      })
      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)
      const data = await res.json() as { response?: string; message?: { content?: string }; error?: string }
      if (data.error) throw new Error(data.error)
      const ollamaReply = (data.message?.content ?? data.response ?? '').trim().slice(0, 3000)
      await reply(ollamaReply || '(empty response from Ollama)', 'Ollama-only Telegram chat completed.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ollama unavailable'
      await reply(`Ollama error: ${msg}\n\nCheck the BertOS server Ollama configuration and model "${ollamaModel}".`, `Ollama error: ${msg}`)
    }
    return NextResponse.json({ ok: true })
  }

  // Default / /help
  await reply([
    'BertOS Telegram Commands',
    '',
    '/status       — daemon + repo + branch summary',
    '/daemon       — detailed daemon health',
    '/providers    — provider bridge status',
    '/hermes       — Hermes Hostinger status',
    '/brief        — combined status snapshot',
    '/tasks        — task board note',
    '/evolution    — evolution backlog note',
    '/memory       — memory system note',
    '/coding <task> — capture a review-ready coding task',
    '/run-check <name> — run a safe check (typecheck | bertos:safety | diff-check)',
    '/chat <msg>   — Ollama chat (requires TELEGRAM_ALLOW_CHAT=true)',
    '/help         — this message',
    '',
    'File writes, git push, paid calls, and destructive ops require web approval.',
  ].join('\n'), 'Displayed Telegram command help.')

  return NextResponse.json({ ok: true })
}
