import type { NextRequest } from 'next/server'
import { applyPatchProposal } from '@/lib/bertos/coding/patches'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string; patchProposalId: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { patchProposalId } = await context.params
    const body = await readBody<{ revalidate?: boolean; runValidationAfter?: boolean }>(req)
    const result = await applyPatchProposal(patchProposalId, {
      revalidate: body.revalidate,
      runValidationAfter: body.runValidationAfter,
    })
    // result.ok === false means conflicts were detected; surface them as data (not an error).
    return ok({ result })
  } catch (error) {
    return codingError(error)
  }
}
