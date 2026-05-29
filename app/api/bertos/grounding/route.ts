import { NextRequest, NextResponse } from 'next/server'
import { buildGroundingPack, enforceGroundingSourceLinks } from '@/lib/bertos/grounding/builder'
import { listGroundingPacks } from '@/lib/bertos/grounding/registry'
import { createOutputArtifact } from '@/lib/bertos/outputs/registry'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get('limit')
  return NextResponse.json({
    ok: true,
    packs: await listGroundingPacks({
      project: req.nextUrl.searchParams.get('project') ?? undefined,
      client: req.nextUrl.searchParams.get('client') ?? undefined,
      query: req.nextUrl.searchParams.get('q') ?? req.nextUrl.searchParams.get('query') ?? undefined,
      limit: limit ? Number(limit) : undefined,
    }),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const pack = await buildGroundingPack({
    taskReason: body.taskReason ?? body.query ?? 'BertOS grounding request',
    query: body.query ?? body.taskReason ?? '',
    project: body.project,
    client: body.client,
    sourceUrls: body.sourceUrls,
    pastedSources: body.pastedSources,
    includeMemory: body.includeMemory,
    includeOutputs: body.includeOutputs,
  })
  const enforcement = enforceGroundingSourceLinks(pack)
  if (!enforcement.ok && body.allowMissingSourceLinks !== true) {
    return NextResponse.json(
      {
        ok: false,
        error: enforcement.message,
        pack,
        enforcement,
        hint: 'Pass allowMissingSourceLinks=true only for explicitly local-only or user-accepted degraded grounding.',
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }
  const output = body.saveAsOutput
    ? await createOutputArtifact({
        type: 'generic',
        title: `Grounding Pack: ${pack.taskReason}`,
        content: JSON.stringify(pack, null, 2),
        tags: ['grounding'],
        sourceLinks: pack.sources.map(source => source.sourceUrl).filter((url): url is string => Boolean(url)),
        groundingPackIds: [pack.groundingPackId],
        metadata: { groundingPackId: pack.groundingPackId },
        preview: { type: 'json' },
      })
    : null
  return NextResponse.json({ ok: true, pack, enforcement, output }, { headers: { 'Cache-Control': 'no-store' } })
}
