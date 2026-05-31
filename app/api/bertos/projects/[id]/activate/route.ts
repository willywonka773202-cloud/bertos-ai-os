import type { NextRequest } from 'next/server'
import { setActiveProject } from '@/lib/bertos/coding/projects'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const project = await setActiveProject(id)
    return ok({ project })
  } catch (error) {
    return codingError(error)
  }
}
