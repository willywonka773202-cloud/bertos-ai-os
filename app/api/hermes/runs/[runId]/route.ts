import { NextRequest, NextResponse } from 'next/server'
import { checkHermesRouteRateLimit, proxyHermesJson } from '@/lib/bertos/hermes-proxy'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ runId: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { runId } = await context.params
  const key = req.headers.get('x-forwarded-for') ?? 'local'
  const rate = checkHermesRouteRateLimit(`run:${key}`, 60)
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Hermes run status rate limit exceeded.' }, { status: 429 })
  const result = await proxyHermesJson(`/runs/${encodeURIComponent(runId)}`, { method: 'GET' })
  return NextResponse.json({ ok: result.ok, run: result.data }, { status: result.ok ? 200 : 502, headers: { 'Cache-Control': 'no-store' } })
}
