import type { NextRequest } from 'next/server'
import { getApprovalRequest } from '@/lib/bertos/coding/approvals'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const approval = await getApprovalRequest(id)
    if (!approval) throw new CodingOSError('not-found', `Approval not found: ${id}`)
    return ok({ approval })
  } catch (error) {
    return codingError(error)
  }
}
