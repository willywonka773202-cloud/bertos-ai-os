import { NextRequest, NextResponse } from 'next/server'
import { approveMemoryProposal } from '@/lib/bertos/memory/registry'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    return NextResponse.json({ ok: true, ...(await approveMemoryProposal(id)) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not approve proposal.' }, { status: 404 })
  }
}
