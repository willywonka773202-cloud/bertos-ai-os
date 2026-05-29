import type { NextRequest } from 'next/server'
import { checkPatchConflicts, getPatchProposal } from '@/lib/bertos/coding/patches'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string; patchProposalId: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { patchProposalId } = await context.params
    const patch = await getPatchProposal(patchProposalId)
    if (!patch) throw new CodingOSError('not-found', `Patch not found: ${patchProposalId}`)
    const conflicts = patch.status === 'applied' ? [] : await checkPatchConflicts(patchProposalId).catch(() => [])
    return ok({ patch, conflicts })
  } catch (error) {
    return codingError(error)
  }
}
