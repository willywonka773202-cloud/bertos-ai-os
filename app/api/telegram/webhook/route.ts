import { NextRequest, NextResponse } from 'next/server'
import { askWithProviderRouter } from '@/lib/bertos/providers/router'
import { fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

interface TelegramUpdate {
  update_id: number
  message?: {
    chat: { id: number }
    from?: { username?: string }
    text?: string
  }
}

const COMMAND_RESPONSES: Record<string, string> = {
  '/tasks': '📋 *Tasks*\nOpen BertOS to view active agent tasks and missions.',
  '/evolution': '🧬 *Evolution Lab*\nOpen BertOS Evolution Lab to view improvement backlog.',
  '/help': [
    '*BertOS Telegram Commands:*',
    '/status — Live daemon and repo status',
    '/providers — Live provider status',
    '/tasks — Agent task list',
    '/evolution — Evolution backlog',
    '/ask <question> — Ask the AI a question',
    '/help — This message',
    '',
    '⚠️ File writes, patches, and git push require web approval.',
  ].join('\n'),
}

async function sendReply(botToken: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null)
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

  const msg = update.message
  if (!msg) return NextResponse.json({ ok: true })

  // Security: only respond to the allowed chat
  if (String(msg.chat.id) !== allowedChatId) {
    return NextResponse.json({ ok: true })
  }

  const text = msg.text?.trim() ?? ''
  const command = text.split(' ')[0]

  if (command === '/status') {
    const daemon = await fetchLocalDaemonStatus()
    const lines = [
      `🤖 *BertOS Status*`,
      `Daemon: ${daemon.online ? '✅ online' : '❌ offline'}`,
      daemon.repo ? `Branch: \`${daemon.repo.branch}\`` : '',
      daemon.repo ? `Remote: ${daemon.repo.safeRepo ? '✅ safe' : '⚠️ blocked'} — ${daemon.repo.remote}` : '',
      daemon.error ? `Error: ${daemon.error}` : '',
    ].filter(Boolean).join('\n')
    await sendReply(botToken, msg.chat.id, lines)
    return NextResponse.json({ ok: true })
  }

  if (command === '/providers') {
    const daemon = await fetchLocalDaemonStatus()
    const tools = daemon.tools ?? []
    const lines = [
      `⚡ *Provider Status*`,
      `Ollama: ${daemon.online ? '✅' : '❌'} (via daemon)`,
      ...tools.map(t => `${t.label}: ${t.installed && t.loginStatus === 'available' ? '✅' : '❌'} (${t.loginStatus})`),
    ]
    await sendReply(botToken, msg.chat.id, lines.join('\n'))
    return NextResponse.json({ ok: true })
  }

  if (COMMAND_RESPONSES[command]) {
    await sendReply(botToken, msg.chat.id, COMMAND_RESPONSES[command])
    return NextResponse.json({ ok: true })
  }

  if (command === '/ask') {
    const question = text.slice(5).trim()
    if (!question) {
      await sendReply(botToken, msg.chat.id, 'Usage: /ask <your question>')
    } else {
      await sendReply(botToken, msg.chat.id, `📨 _Asking providers..._`)
      try {
        const result = await askWithProviderRouter(question, 'auto')
        const answer = result.ok
          ? `*Answer* (${result.providerName}):\n\n${result.text.slice(0, 3800)}`
          : `❌ Provider error: ${result.error}`
        await sendReply(botToken, msg.chat.id, answer)
      } catch (err) {
        await sendReply(botToken, msg.chat.id, `❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    return NextResponse.json({ ok: true })
  }

  await sendReply(botToken, msg.chat.id, `Unknown command: ${command || '(empty)'}\nType /help for available commands.`)
  return NextResponse.json({ ok: true })
}
