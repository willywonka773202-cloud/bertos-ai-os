import { NextRequest, NextResponse } from 'next/server'
import { updatePublishingQueueItem } from '@/lib/bertos/studio/registry'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const body = await req.json().catch(() => ({}))
  try {
    return NextResponse.json({ ok: true, item: await updatePublishingQueueItem(id, body) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Publishing queue update failed.' }, { status: 404 })
  }
}
