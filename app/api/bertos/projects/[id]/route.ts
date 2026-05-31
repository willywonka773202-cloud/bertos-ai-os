import type { NextRequest } from 'next/server'
import { getProject, updateProject, type UpdateProjectInput } from '@/lib/bertos/coding/projects'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const project = await getProject(id)
    if (!project) throw new CodingOSError('not-found', `Project not found: ${id}`)
    return ok({ project })
  } catch (error) {
    return codingError(error)
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await readBody<UpdateProjectInput>(req)
    const project = await updateProject(id, body)
    return ok({ project })
  } catch (error) {
    return codingError(error)
  }
}
