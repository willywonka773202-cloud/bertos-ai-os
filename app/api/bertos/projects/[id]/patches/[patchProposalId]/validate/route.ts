import type { NextRequest } from 'next/server'
import { checkPatchConflicts, getPatchProposal } from '@/lib/bertos/coding/patches'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string; patchProposalId: string }> }

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { patchProposalId } = await context.params
    const patch = await getPatchProposal(patchProposalId)
    if (!patch) throw new CodingOSError('not-found', `Patch not found: ${patchProposalId}`)
    const conflicts = await checkPatchConflicts(patchProposalId)
    return ok({ patchProposalId, conflicts, clean: conflicts.length === 0 })
  } catch (error) {
    return codingError(error)
  }
}
