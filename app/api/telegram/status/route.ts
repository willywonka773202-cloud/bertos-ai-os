import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SUPPORTED_COMMANDS = [
  '/status',
  '/daemon',
  '/providers',
  '/hermes',
  '/brief',
  '/tasks',
  '/evolution',
  '/memory',
  '/coding',
  '/run-check',
  '/chat',
  '/help',
]

async function getWebhookInfo(botToken: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
    const data = await res.json().catch(() => ({})) as {
      ok?: boolean
      description?: string
      result?: {
        url?: string
        has_custom_certificate?: boolean
        pending_update_count?: number
        last_error_date?: number
        last_error_message?: string
        max_connections?: number
        allowed_updates?: string[]
      }
    }
    if (!res.ok || !data.ok || !data.result) {
      return {
        reachable: false,
        connected: false,
        error: data.description || `Telegram HTTP ${res.status}`,
      }
    }
    const url = data.result.url || ''
    return {
      reachable: true,
      connected: Boolean(url),
      webhookHost: url ? new URL(url).host : '',
      pendingUpdateCount: data.result.pending_update_count ?? 0,
      lastErrorDate: data.result.last_error_date,
      lastErrorMessage: data.result.last_error_message,
      maxConnections: data.result.max_connections,
      allowedUpdates: data.result.allowed_updates,
    }
  } catch (error) {
    return {
      reachable: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Could not reach Telegram API.',
    }
  }
}

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const allowedChatId = process.env.TELEGRAM_ALLOWED_CHAT_ID
  const webhookSecretConfigured = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET)
  const chatEnabled = process.env.TELEGRAM_ALLOW_CHAT === 'true'
  const ollamaModel = process.env.TELEGRAM_OLLAMA_MODEL ?? 'llama3'

  if (!botToken || !allowedChatId) {
    return NextResponse.json({
      ok: false,
      configured: false,
      chatEnabled,
      ollamaModel,
      webhookSecretConfigured,
      scaffolded: true,
      error: 'TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_CHAT_ID are not set.',
      setupInstructions: [
        'Create a Telegram bot via BotFather and store TELEGRAM_BOT_TOKEN server-side.',
        'Store TELEGRAM_ALLOWED_CHAT_ID server-side.',
        'Restart the app after environment changes.',
        'Telegram can monitor and notify, but file writes, patches, and git push require web approval.',
      ],
      supportedCommands: SUPPORTED_COMMANDS,
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const webhook = await getWebhookInfo(botToken)

  return NextResponse.json({
    ok: true,
    configured: true,
    chatEnabled,
    ollamaModel,
    webhookSecretConfigured,
    webhook,
    allowedChatId: `${allowedChatId.slice(0, 4)}***`,
    webhookEndpoint: '/api/telegram/webhook',
    supportedCommands: SUPPORTED_COMMANDS,
    safety: 'Telegram cannot write files, apply patches, push git, or run paid calls without web approval.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
