import { NextRequest, NextResponse } from 'next/server'
import { getPlugin, verifyPluginSetup } from '@/lib/bertos/plugins/registry'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const plugin = await getPlugin(id)
  if (!plugin) return NextResponse.json({ ok: false, error: 'Plugin not found.' }, { status: 404 })
  return NextResponse.json({ ok: true, plugin, setup: await verifyPluginSetup(id) }, { headers: { 'Cache-Control': 'no-store' } })
}
