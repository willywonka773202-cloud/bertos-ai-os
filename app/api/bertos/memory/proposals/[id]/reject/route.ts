import { NextRequest, NextResponse } from 'next/server'
import { rejectMemoryProposal } from '@/lib/bertos/memory/registry'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    return NextResponse.json({ ok: true, proposal: await rejectMemoryProposal(id) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not reject proposal.' }, { status: 404 })
  }
}
