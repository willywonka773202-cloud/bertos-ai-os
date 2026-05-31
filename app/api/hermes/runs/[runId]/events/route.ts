import { NextRequest, NextResponse } from 'next/server'
import { checkHermesRouteRateLimit, proxyHermesJson } from '@/lib/bertos/hermes-proxy'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ runId: string }>
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { runId } = await context.params
  const key = req.headers.get('x-forwarded-for') ?? 'local'
  const rate = checkHermesRouteRateLimit(`run-events:${key}`, 60)
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Hermes run events rate limit exceeded.' }, { status: 429 })
  const result = await proxyHermesJson(`/runs/${encodeURIComponent(runId)}/events`, { method: 'GET' })
  return NextResponse.json({ ok: result.ok, events: result.data }, { status: result.ok ? 200 : 502, headers: { 'Cache-Control': 'no-store' } })
}
