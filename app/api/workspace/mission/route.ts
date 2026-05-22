import { NextRequest, NextResponse } from 'next/server'
import { buildMission } from '@/lib/bertos/mission-builder'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { task?: string; fileTree?: string[] }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.task?.trim()) {
    return NextResponse.json({ ok: false, error: 'task is required.' }, { status: 400 })
  }

  const mission = buildMission(body.task, body.fileTree ?? [])

  return NextResponse.json({ ok: true, mission }, { headers: { 'Cache-Control': 'no-store' } })
}
