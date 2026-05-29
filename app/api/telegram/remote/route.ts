import { NextResponse } from 'next/server'
import { getOllamaConfig } from '@/lib/bertos/runtime'
import { getTelegramRemoteState } from '@/lib/bertos/telegram-remote'

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

interface TelegramWebhookStatus {
  reachable: boolean
  connected: boolean
  webhookHost?: string
  pendingUpdateCount?: number
  lastErrorMessage?: string
  error?: string
}

let webhookCache: { at: number; value: TelegramWebhookStatus } | null = null

async function getWebhookInfo(botToken: string | undefined): Promise<TelegramWebhookStatus> {
  if (!botToken) return { reachable: false, connected: false, error: 'TELEGRAM_BOT_TOKEN is missing.' }
  if (webhookCache && Date.now() - webhookCache.at < 30_000) return webhookCache.value

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
        pending_update_count?: number
        last_error_message?: string
      }
    }
    const url = data.result?.url || ''
    const value = !res.ok || !data.ok
      ? { reachable: false, connected: false, error: data.description || `Telegram HTTP ${res.status}` }
      : {
          reachable: true,
          connected: Boolean(url),
          webhookHost: url ? new URL(url).host : '',
          pendingUpdateCount: data.result?.pending_update_count ?? 0,
          lastErrorMessage: data.result?.last_error_message,
        }
    webhookCache = { at: Date.now(), value }
    return value
  } catch (error) {
    const value = {
      reachable: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Could not reach Telegram API.',
    }
    webhookCache = { at: Date.now(), value }
    return value
  }
}

export async function GET() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const configured = Boolean(botToken && process.env.TELEGRAM_ALLOWED_CHAT_ID)
  const webhook = await getWebhookInfo(botToken)
  const ollama = getOllamaConfig()
  return NextResponse.json({
    ok: true,
    configured,
    communicable: configured && webhook.reachable && webhook.connected,
    chatEnabled: process.env.TELEGRAM_ALLOW_CHAT === 'true',
    plainLocalChatEnabled: ollama.mode === 'local' && !ollama.requiresApiKey,
    webhookSecretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    webhookEndpoint: '/api/telegram/webhook',
    webhook,
    supportedCommands: SUPPORTED_COMMANDS,
    remote: getTelegramRemoteState(),
    safety: 'Telegram is a remote control only. File writes, patch apply, git push, deploys, and paid providers require BertOS web approval.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
