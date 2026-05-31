import type { NextRequest } from 'next/server'
import { getRecentCommits } from '@/lib/bertos/coding/git'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '20')
    const commits = await getRecentCommits(id, Number.isFinite(limit) ? limit : 20)
    return ok({ commits })
  } catch (error) {
    return codingError(error)
  }
}
