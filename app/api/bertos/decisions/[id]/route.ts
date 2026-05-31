import type { NextRequest } from 'next/server'
import { getDecisionRecord, updateDecisionRecord, type CreateDecisionInput } from '@/lib/bertos/coding/decisions'
import type { DecisionStatus } from '@/lib/bertos/coding/types'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const decision = await getDecisionRecord(id)
    if (!decision) throw new CodingOSError('not-found', `Decision not found: ${id}`)
    return ok({ decision })
  } catch (error) {
    return codingError(error)
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await readBody<Partial<CreateDecisionInput> & { status?: DecisionStatus }>(req)
    const decision = await updateDecisionRecord(id, body)
    return ok({ decision })
  } catch (error) {
    return codingError(error)
  }
}
