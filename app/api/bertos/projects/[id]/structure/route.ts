import type { NextRequest } from 'next/server'
import { summarizeProjectStructure } from '@/lib/bertos/coding/files'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const structure = await summarizeProjectStructure(id)
    return ok({ structure })
  } catch (error) {
    return codingError(error)
  }
}
