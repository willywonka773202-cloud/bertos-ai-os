import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const allowedChatId = process.env.TELEGRAM_ALLOWED_CHAT_ID

  if (!botToken || !allowedChatId) {
    return NextResponse.json({
      ok: false,
      error: 'Telegram is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_CHAT_ID server-side.',
    }, { status: 503 })
  }

  let body: { text?: string; chatId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const targetChatId = body.chatId || allowedChatId
  if (targetChatId !== allowedChatId) {
    return NextResponse.json({ ok: false, error: 'Chat ID not allowed.' }, { status: 403 })
  }

  if (!body.text?.trim()) {
    return NextResponse.json({ ok: false, error: 'text is required.' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: allowedChatId, text: body.text.slice(0, 3800) }),
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; description?: string }
    if (!data.ok) {
      return NextResponse.json({ ok: false, error: data.description || 'Telegram API error.' }, { status: 502 })
    }
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Telegram send failed.',
    }, { status: 502 })
  }
}
