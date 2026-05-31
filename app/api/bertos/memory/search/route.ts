import { NextRequest, NextResponse } from 'next/server'
import { buildMarkdownMemoryPack, ensureMemoryVault, searchMemory } from '@/lib/bertos/memory/registry'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  await ensureMemoryVault()
  const q = req.nextUrl.searchParams.get('q') || undefined
  const kind = req.nextUrl.searchParams.get('kind') || undefined
  const project = req.nextUrl.searchParams.get('project') || undefined
  const client = req.nextUrl.searchParams.get('client') || undefined
  const tag = req.nextUrl.searchParams.get('tag') || undefined
  const limit = Number(req.nextUrl.searchParams.get('limit') || 50)
  const records = await searchMemory({ q, kind: kind as any, project, client, tag, limit })
  const pack = q ? await buildMarkdownMemoryPack({ query: q, project }) : null
  return NextResponse.json({ ok: true, records, pack }, { headers: { 'Cache-Control': 'no-store' } })
}
