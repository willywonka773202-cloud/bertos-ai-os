import type { NextRequest } from 'next/server'
import { archiveCodingTask } from '@/lib/bertos/coding/tasks'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const task = await archiveCodingTask(id)
    return ok({ task })
  } catch (error) {
    return codingError(error)
  }
}
