import { NextResponse } from 'next/server'
import { listRuntimeRuns } from '@/lib/bertos/runs/registry'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ ok: true, ...(await listRuntimeRuns()) }, { headers: { 'Cache-Control': 'no-store' } })
}
