import type { NextRequest } from 'next/server'
import { unifiedSearch } from '@/lib/bertos/coding/search'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get('q') ?? ''
    const projectId = req.nextUrl.searchParams.get('projectId') ?? undefined
    const includeFiles = req.nextUrl.searchParams.get('files') === 'true'
    const results = await unifiedSearch(query, { projectId, includeFiles })
    return ok({ results, query })
  } catch (error) {
    return codingError(error)
  }
}
