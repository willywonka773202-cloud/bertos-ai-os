import { NextRequest, NextResponse } from 'next/server'
import { updateStudioAsset } from '@/lib/bertos/studio/registry'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const body = await req.json().catch(() => ({}))
  try {
    return NextResponse.json({ ok: true, asset: await updateStudioAsset(id, body) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Studio asset update failed.' }, { status: 404 })
  }
}
