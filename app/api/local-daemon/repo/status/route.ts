import { NextResponse } from 'next/server'
import { fetchLocalRepoStatus, unavailableLocalDaemonStatus } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

export async function GET() {
  const repo = await fetchLocalRepoStatus()
  if (!repo) {
    return NextResponse.json({
      ok: false,
      error: unavailableLocalDaemonStatus().error,
    }, { status: 503 })
  }
  return NextResponse.json({ ok: true, repo }, { headers: { 'Cache-Control': 'no-store' } })
}
