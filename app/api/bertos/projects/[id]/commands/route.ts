import type { NextRequest } from 'next/server'
import { listCommandRuns, runCommand } from '@/lib/bertos/coding/commands'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const runs = await listCommandRuns(id)
    return ok({ runs })
  } catch (error) {
    return codingError(error)
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await readBody<{ command?: string; approved?: boolean }>(req)
    if (!body.command) throw new CodingOSError('invalid-input', 'A command is required.')
    const run = await runCommand(id, body.command, { approved: body.approved })
    return ok({ run }, 201)
  } catch (error) {
    return codingError(error)
  }
}
