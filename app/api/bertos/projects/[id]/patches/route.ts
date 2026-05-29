import type { NextRequest } from 'next/server'
import { createPatchProposal, listPatchProposals, type CreatePatchInput } from '@/lib/bertos/coding/patches'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const patches = await listPatchProposals(id)
    return ok({ patches })
  } catch (error) {
    return codingError(error)
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await readBody<CreatePatchInput>(req)
    const patch = await createPatchProposal(id, body)
    return ok({ patch }, 201)
  } catch (error) {
    return codingError(error)
  }
}
