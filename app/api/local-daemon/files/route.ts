import { NextRequest, NextResponse } from 'next/server'
import { getLocalDaemonBaseUrl, isLocalDaemonAvailableFromServer } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!isLocalDaemonAvailableFromServer()) {
    return NextResponse.json({ ok: false, error: 'Local daemon unavailable in Vercel/cloud mode.' }, { status: 503 })
  }
  const dir = req.nextUrl.searchParams.get('dir') || '.'
  try {
    const res = await fetch(`${getLocalDaemonBaseUrl()}/repo/files?dir=${encodeURIComponent(dir)}`, { cache: 'no-store' })
    const text = await res.text()
    const data = text ? JSON.parse(text) : { ok: false, files: [], error: 'Local daemon returned an empty file listing.' }
    return NextResponse.json(data, { status: res.status, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      files: [],
      error: error instanceof Error ? error.message : 'Could not read local daemon file listing.',
    }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
  }
}
