import { NextRequest, NextResponse } from 'next/server'
import { checkHermesRouteRateLimit, hermesPublicConfig } from '@/lib/bertos/hermes-proxy'
import { listHermesModels } from '@/lib/bertos/providers/hermes-nous'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const key = req.headers.get('x-forwarded-for') ?? 'local'
  const rate = checkHermesRouteRateLimit(`models:${key}`, 60)
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Hermes models rate limit exceeded.' }, { status: 429 })
  const result = await listHermesModels()
  return NextResponse.json({
    config: hermesPublicConfig(),
    ...result,
  }, { status: result.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
