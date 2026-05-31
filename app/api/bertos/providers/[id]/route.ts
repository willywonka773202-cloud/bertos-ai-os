import type { NextRequest } from 'next/server'
import { getProviderHubEntry } from '@/lib/bertos/coding/provider-hub'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const provider = await getProviderHubEntry(id)
    if (!provider) throw new CodingOSError('not-found', `Provider not found: ${id}`)
    return ok({ provider })
  } catch (error) {
    return codingError(error)
  }
}
