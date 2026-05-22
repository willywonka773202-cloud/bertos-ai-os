import { NextRequest, NextResponse } from 'next/server'
import { fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

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
  const command = text.split(' ')[0]

  if (command === '/status') {
    const daemon = await fetchLocalDaemonStatus()
    await sendReply(botToken, message.chat.id, [
      'BertOS Status',
      `Daemon: ${daemon.online ? 'online' : 'offline'}`,
      daemon.repo ? `Branch: ${daemon.repo.branch}` : '',
      daemon.repo ? `Repo safe: ${daemon.repo.safeRepo ? 'yes' : 'no'}` : '',
      daemon.error ? `Error: ${daemon.error}` : '',
    ].filter(Boolean).join('\n'))
    return NextResponse.json({ ok: true })
  }

  if (command === '/providers') {
    const daemon = await fetchLocalDaemonStatus()
    const tools = daemon.tools ?? []
    await sendReply(botToken, message.chat.id, [
      'BertOS Providers',
      `Daemon bridge: ${daemon.online ? 'online' : 'offline'}`,
      ...tools.map(tool => `${tool.label}: ${tool.installed && tool.loginStatus === 'available' ? 'available' : 'unavailable'} (${tool.loginStatus})`),
      'Paid providers are never used silently from Telegram.',
    ].join('\n'))
    return NextResponse.json({ ok: true })
  }

  if (command === '/tasks') {
    await sendReply(botToken, message.chat.id, 'Open BertOS /tasks to review local task board items. Telegram does not mutate task state yet.')
    return NextResponse.json({ ok: true })
  }

  if (command === '/evolution') {
    await sendReply(botToken, message.chat.id, 'Open BertOS /evolution to review the improvement backlog. Telegram does not apply patches.')
    return NextResponse.json({ ok: true })
  }

  if (command === '/ask') {
    await sendReply(botToken, message.chat.id, 'Telegram /ask is scaffolded but intentionally disabled for now to avoid surprise provider or paid-model calls. Use BertOS Chat or Builder in the browser.')
    return NextResponse.json({ ok: true })
  }

  await sendReply(botToken, message.chat.id, [
    'BertOS Telegram Commands:',
    '/status - daemon and repo status',
    '/providers - provider bridge status',
    '/tasks - task board note',
    '/evolution - Evolution Lab note',
    '/ask - currently disabled for safety',
    '/help - this message',
    '',
    'File writes, patches, git push, and paid calls require web approval.',
  ].join('\n'))

  return NextResponse.json({ ok: true })
}
