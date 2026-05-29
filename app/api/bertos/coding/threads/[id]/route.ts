import type { NextRequest } from 'next/server'
import { deleteThread, getThread, renameThread } from '@/lib/bertos/coding/threads'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const thread = await getThread(id)
    if (!thread) throw new CodingOSError('not-found', `Thread not found: ${id}`)
    return ok({ thread })
  } catch (error) {
    return codingError(error)
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await readBody<{ title?: string }>(req)
    if (!body.title) throw new CodingOSError('invalid-input', 'A title is required.')
    const thread = await renameThread(id, body.title)
    return ok({ thread })
  } catch (error) {
    return codingError(error)
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const deleted = await deleteThread(id)
    return ok({ deleted })
  } catch (error) {
    return codingError(error)
  }
}
