import type { NextRequest } from 'next/server'
import { testProviderById, type ProviderTestMode } from '@/lib/bertos/coding/provider-routing'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await readBody<{ allowPaid?: boolean; mode?: ProviderTestMode }>(req)
    const result = await testProviderById(id, { allowPaid: Boolean(body.allowPaid), mode: body.mode })
    return ok({ result })
  } catch (error) {
    return codingError(error)
  }
}
