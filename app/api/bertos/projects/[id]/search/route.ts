import type { NextRequest } from 'next/server'
import { searchProjectFiles } from '@/lib/bertos/coding/files'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const query = req.nextUrl.searchParams.get('q') ?? ''
    const hits = await searchProjectFiles(id, query)
    return ok({ hits, query })
  } catch (error) {
    return codingError(error)
  }
}
