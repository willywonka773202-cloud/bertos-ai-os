import { NextRequest, NextResponse } from 'next/server'
import { getLocalDaemonBaseUrl, isLocalDaemonAvailableFromServer } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!isLocalDaemonAvailableFromServer()) {
    return NextResponse.json({ ok: false, error: 'Local daemon unavailable in Vercel/cloud mode.' }, { status: 503 })
  }
  const dir = req.nextUrl.searchParams.get('dir') || '.'
  const res = await fetch(`${getLocalDaemonBaseUrl()}/repo/files?dir=${encodeURIComponent(dir)}`, { cache: 'no-store' })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status, headers: { 'Cache-Control': 'no-store' } })
}
