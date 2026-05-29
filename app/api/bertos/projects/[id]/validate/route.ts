import type { NextRequest } from 'next/server'
import { listValidationReports, runValidation } from '@/lib/bertos/coding/commands'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const reports = await listValidationReports(id)
    return ok({ reports })
  } catch (error) {
    return codingError(error)
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await readBody<{ commands?: string[] }>(req)
    const report = await runValidation(id, body.commands)
    return ok({ report }, 201)
  } catch (error) {
    return codingError(error)
  }
}
