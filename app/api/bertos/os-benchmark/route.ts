import { NextResponse } from 'next/server'
import { buildAiOsBenchmarkReport } from '@/lib/bertos/ai-os-benchmark'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await buildAiOsBenchmarkReport(), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not build AI OS benchmark report.',
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
