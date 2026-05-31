import { NextRequest, NextResponse } from 'next/server'
import { createMemoryProposal, ensureMemoryVault, listMemoryProposals } from '@/lib/bertos/memory/registry'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  await ensureMemoryVault()
  const status = req.nextUrl.searchParams.get('status') || undefined
  return NextResponse.json({ ok: true, proposals: await listMemoryProposals(status as any) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  await ensureMemoryVault()
  const body = await req.json().catch(() => null)
  if (!body?.kind || !body?.title || !body?.content) {
    return NextResponse.json({ ok: false, error: 'kind, title, and content are required.' }, { status: 400 })
  }
  try {
    const proposal = await createMemoryProposal(body)
    return NextResponse.json({ ok: true, proposal }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not create proposal.' }, { status: 400 })
  }
}
