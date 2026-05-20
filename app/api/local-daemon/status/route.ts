import { NextResponse } from 'next/server'
import { fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

export async function GET() {
  const status = await fetchLocalDaemonStatus()
  return NextResponse.json(status, {
    status: status.online ? 200 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
