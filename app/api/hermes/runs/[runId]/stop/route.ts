import { NextRequest, NextResponse } from 'next/server'
import { checkHermesRouteRateLimit, proxyHermesJson } from '@/lib/bertos/hermes-proxy'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ runId: string }>
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { runId } = await context.params
  const key = req.headers.get('x-forwarded-for') ?? 'local'
  const rate = checkHermesRouteRateLimit(`run-stop:${key}`, 20)
  if (!rate.ok) return NextResponse.json({ ok: false, error: 'Hermes stop rate limit exceeded.' }, { status: 429 })
  const result = await proxyHermesJson(`/runs/${encodeURIComponent(runId)}/stop`, { method: 'POST', body: {} })
  return NextResponse.json({ ok: result.ok, result: result.data }, { status: result.ok ? 200 : 502, headers: { 'Cache-Control': 'no-store' } })
}
