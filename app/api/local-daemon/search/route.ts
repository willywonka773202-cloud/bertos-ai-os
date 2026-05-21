import { NextRequest, NextResponse } from 'next/server'
import { getLocalDaemonBaseUrl, isLocalDaemonAvailableFromServer } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!isLocalDaemonAvailableFromServer()) {
    return NextResponse.json({ ok: false, error: 'Local daemon unavailable in Vercel/cloud mode.' }, { status: 503 })
  }
  const body = await req.json().catch(() => ({}))
  const res = await fetch(`${getLocalDaemonBaseUrl()}/repo/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status, headers: { 'Cache-Control': 'no-store' } })
}
