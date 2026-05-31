import { NextRequest, NextResponse } from 'next/server'
import { checkHermesRouteRateLimit, proxyHermesJson, readLimitedJson } from '@/lib/bertos/hermes-proxy'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-forwarded-for') ?? 'local'
  const rate = checkHermesRouteRateLimit(`runs:${key}`, 20)
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Hermes runs rate limit exceeded.' }, { status: 429 })
  try {
    const body = await readLimitedJson(req)
    const result = await proxyHermesJson('/runs', { method: 'POST', body })
    return NextResponse.json({ ok: result.ok, run: result.data }, { status: result.ok ? 200 : 502, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Hermes run creation failed.' }, { status: 400 })
  }
}
