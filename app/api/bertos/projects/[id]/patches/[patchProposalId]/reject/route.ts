import type { NextRequest } from 'next/server'
import { rejectPatchProposal } from '@/lib/bertos/coding/patches'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string; patchProposalId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { patchProposalId } = await context.params
    const body = await readBody<{ note?: string }>(req)
    const patch = await rejectPatchProposal(patchProposalId, body.note)
    return ok({ patch })
  } catch (error) {
    return codingError(error)
  }
}
