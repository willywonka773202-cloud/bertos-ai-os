import type { NextRequest } from 'next/server'
import { readProjectFile } from '@/lib/bertos/coding/files'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const path = req.nextUrl.searchParams.get('path')
    if (!path) throw new CodingOSError('invalid-input', 'A path query parameter is required.')
    const file = await readProjectFile(id, path)
    return ok({ file })
  } catch (error) {
    return codingError(error)
  }
}
