import type { NextRequest } from 'next/server'
import { createCodingTask, listCodingTasks, type CreateTaskInput } from '@/lib/bertos/coding/tasks'
import type { TaskStatus } from '@/lib/bertos/coding/types'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId') ?? undefined
    const status = (req.nextUrl.searchParams.get('status') as TaskStatus | null) ?? undefined
    const tasks = await listCodingTasks({ projectId, status })
    return ok({ tasks })
  } catch (error) {
    return codingError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody<CreateTaskInput>(req)
    const task = await createCodingTask(body)
    return ok({ task }, 201)
  } catch (error) {
    return codingError(error)
  }
}
