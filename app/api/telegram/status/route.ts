import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const allowedChatId = process.env.TELEGRAM_ALLOWED_CHAT_ID

  if (!botToken || !allowedChatId) {
    return NextResponse.json({
      ok: false,
      configured: false,
      scaffolded: true,
      error: 'TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_CHAT_ID are not set.',
      setupInstructions: [
        'Create a Telegram bot via BotFather and store TELEGRAM_BOT_TOKEN server-side.',
        'Store TELEGRAM_ALLOWED_CHAT_ID server-side.',
        'Restart the app after environment changes.',
        'Telegram can monitor and notify, but file writes, patches, and git push require web approval.',
      ],
      supportedCommands: ['/status', '/providers', '/tasks', '/evolution', '/ask', '/help'],
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    allowedChatId: `${allowedChatId.slice(0, 4)}***`,
    webhookEndpoint: '/api/telegram/webhook',
    supportedCommands: ['/status', '/providers', '/tasks', '/evolution', '/ask', '/help'],
    safety: 'Telegram cannot write files, apply patches, push git, or run paid calls without web approval.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
