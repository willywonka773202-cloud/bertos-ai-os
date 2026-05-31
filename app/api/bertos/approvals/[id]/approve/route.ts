import type { NextRequest } from 'next/server'
import { approveAction } from '@/lib/bertos/coding/approvals'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await readBody<{ note?: string }>(req)
    const approval = await approveAction(id, body.note)
    return ok({ approval })
  } catch (error) {
    return codingError(error)
  }
}
