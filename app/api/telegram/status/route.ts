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
        'Create a Telegram bot via @BotFather and copy the token',
        'Add TELEGRAM_BOT_TOKEN=your-token to .env.local',
        'Get your chat ID from @userinfobot',
        'Add TELEGRAM_ALLOWED_CHAT_ID=your-chat-id to .env.local',
        'Restart the dev server',
        'Set webhook: POST /api/telegram/webhook',
        'Commands: /status /providers /tasks /evolution /ask /help',
        'IMPORTANT: Telegram cannot write files or push git without web approval',
      ],
    })
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    allowedChatId: allowedChatId.slice(0, 4) + '***',
    webhookEndpoint: '/api/telegram/webhook',
    supportedCommands: ['/status', '/providers', '/tasks', '/evolution', '/ask', '/help'],
  })
}
