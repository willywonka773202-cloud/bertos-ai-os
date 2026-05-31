import type { NextRequest } from 'next/server'
import { createThread, listThreads } from '@/lib/bertos/coding/threads'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId') ?? undefined
    const threads = await listThreads(projectId)
    return ok({ threads })
  } catch (error) {
    return codingError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody<{ projectId?: string; projectSlug?: string; title?: string }>(req)
    const thread = await createThread(body)
    return ok({ thread }, 201)
  } catch (error) {
    return codingError(error)
  }
}
