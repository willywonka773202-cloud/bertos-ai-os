import { NextResponse } from 'next/server'
import { buildPublishReadinessReport } from '@/lib/bertos/readiness'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await buildPublishReadinessReport(), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not build publish readiness report.',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
