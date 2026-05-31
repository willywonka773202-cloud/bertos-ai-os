import { NextRequest, NextResponse } from 'next/server'
import { checkHermesRouteRateLimit, hermesPublicConfig } from '@/lib/bertos/hermes-proxy'
import { status as getHermesStatus } from '@/lib/bertos/providers/hermes-nous'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const key = req.headers.get('x-forwarded-for') ?? 'local'
  const rate = checkHermesRouteRateLimit(`health:${key}`, 60)
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Hermes health rate limit exceeded.' }, { status: 429 })
  const provider = await getHermesStatus()
  return NextResponse.json({
    ok: provider.online,
    status: provider.online ? 'connected' : 'disconnected',
    config: hermesPublicConfig(),
    provider,
    message: provider.online
      ? 'Hermes is connected and responding.'
      : provider.error ?? 'Hermes is not connected yet. Check HERMES_BASE_URL and HERMES_API_KEY.',
  }, { status: provider.online ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
