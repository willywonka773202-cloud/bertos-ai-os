import { NextRequest, NextResponse } from 'next/server'
import { createPublishingQueueItem, listPublishingQueue } from '@/lib/bertos/studio/registry'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ ok: true, queue: await listPublishingQueue() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body.idea) return NextResponse.json({ ok: false, error: 'idea is required.' }, { status: 400 })
  return NextResponse.json({ ok: true, item: await createPublishingQueueItem(body) }, { headers: { 'Cache-Control': 'no-store' } })
}
