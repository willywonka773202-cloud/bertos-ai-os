import { NextRequest, NextResponse } from 'next/server'
import { askWithProviderRouter } from '@/lib/bertos/providers/router'
import type { AIModel } from '@/lib/bertos/types'

export const runtime = 'nodejs'

function requireCliSecret(req: NextRequest): string | null {
  const configured = process.env.BERTOS_AGENT_SECRET?.trim()
  if (!configured) return 'BERTOS_AGENT_SECRET is not configured on this deployment.'
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
    || req.headers.get('x-bertos-agent-secret')?.trim()
  if (supplied !== configured) return 'Invalid or missing BertOS agent secret.'
  return null
}

export async function POST(req: NextRequest) {
  const authError = requireCliSecret(req)
  if (authError) return NextResponse.json({ ok: false, error: authError }, { status: 401 })

  let body: { prompt?: string; providerId?: string; model?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ ok: false, error: 'prompt is required.' }, { status: 400 })
  }

  const preferred = (body.model || body.providerId || 'auto') as AIModel
  const result = await askWithProviderRouter(body.prompt, preferred)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
