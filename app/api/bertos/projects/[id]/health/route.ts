import type { NextRequest } from 'next/server'
import { getProjectHealthSummary } from '@/lib/bertos/coding/projects'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const health = await getProjectHealthSummary(id)
    return ok({ health })
  } catch (error) {
    return codingError(error)
  }
}
