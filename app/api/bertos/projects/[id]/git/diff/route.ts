import type { NextRequest } from 'next/server'
import { getGitDiff } from '@/lib/bertos/coding/git'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const staged = req.nextUrl.searchParams.get('staged') === 'true'
    const file = req.nextUrl.searchParams.get('file') ?? undefined
    const diff = await getGitDiff(id, { staged, file })
    return ok({ diff })
  } catch (error) {
    return codingError(error)
  }
}
