import { NextRequest, NextResponse } from 'next/server'
import { runReflection, type ReflectionCadence } from '@/lib/bertos/automation/reflection'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const cadence = body.cadence === 'weekly' ? 'weekly' : 'daily'
  try {
    return NextResponse.json({
      ok: true,
      result: await runReflection({
        cadence: cadence as ReflectionCadence,
        project: body.project,
        client: body.client,
      }),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Reflection failed.' }, { status: 500 })
  }
}
