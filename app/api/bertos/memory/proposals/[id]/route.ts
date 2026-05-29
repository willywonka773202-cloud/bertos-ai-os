import { NextRequest, NextResponse } from 'next/server'
import { listMemoryProposals, updateMemoryProposal } from '@/lib/bertos/memory/registry'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const proposal = (await listMemoryProposals()).find(item => item.proposalId === id)
  if (!proposal) return NextResponse.json({ ok: false, error: 'Memory proposal not found.' }, { status: 404 })
  return NextResponse.json({ ok: true, proposal }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  try {
    return NextResponse.json({ ok: true, proposal: await updateMemoryProposal(id, body) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not update proposal.' }, { status: 400 })
  }
}
