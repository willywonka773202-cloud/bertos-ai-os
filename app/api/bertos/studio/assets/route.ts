import { NextRequest, NextResponse } from 'next/server'
import { createStudioAsset, listStudioAssets } from '@/lib/bertos/studio/registry'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ ok: true, assets: await listStudioAssets() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body.type) return NextResponse.json({ ok: false, error: 'type is required.' }, { status: 400 })
  return NextResponse.json({ ok: true, asset: await createStudioAsset(body) }, { headers: { 'Cache-Control': 'no-store' } })
}
