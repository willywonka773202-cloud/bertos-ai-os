import type { NextRequest } from 'next/server'
import { listProjectFiles } from '@/lib/bertos/coding/files'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const dir = req.nextUrl.searchParams.get('dir') ?? ''
    const result = await listProjectFiles(id, { dir })
    return ok(result)
  } catch (error) {
    return codingError(error)
  }
}
