import type { NextRequest } from 'next/server'
import { getGitStatus } from '@/lib/bertos/coding/git'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const status = await getGitStatus(id)
    return ok({ status })
  } catch (error) {
    return codingError(error)
  }
}
