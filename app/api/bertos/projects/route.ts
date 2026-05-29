import type { NextRequest } from 'next/server'
import { createProject, getActiveProject, listProjects, type CreateProjectInput } from '@/lib/bertos/coding/projects'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const includeArchived = req.nextUrl.searchParams.get('includeArchived') === 'true'
    const [projects, active] = await Promise.all([listProjects(includeArchived), getActiveProject()])
    return ok({ projects, activeProjectId: active?.projectId ?? null })
  } catch (error) {
    return codingError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody<CreateProjectInput>(req)
    const project = await createProject(body)
    return ok({ project }, 201)
  } catch (error) {
    return codingError(error)
  }
}
