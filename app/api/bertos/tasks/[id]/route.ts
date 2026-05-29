import type { NextRequest } from 'next/server'
import { getCodingTask, updateCodingTask, type UpdateTaskInput } from '@/lib/bertos/coding/tasks'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const task = await getCodingTask(id)
    if (!task) throw new CodingOSError('not-found', `Task not found: ${id}`)
    return ok({ task })
  } catch (error) {
    return codingError(error)
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await readBody<UpdateTaskInput>(req)
    const task = await updateCodingTask(id, body)
    return ok({ task })
  } catch (error) {
    return codingError(error)
  }
}
