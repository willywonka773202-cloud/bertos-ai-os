import { NextResponse } from 'next/server'
import { listPlugins } from '@/lib/bertos/plugins/registry'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ ok: true, plugins: await listPlugins() }, { headers: { 'Cache-Control': 'no-store' } })
}
