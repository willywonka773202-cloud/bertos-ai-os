import type { NextRequest } from 'next/server'
import { getProviderSetupGuide } from '@/lib/bertos/coding/provider-hub'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const guide = getProviderSetupGuide(id)
    if (!guide) throw new CodingOSError('not-found', `No setup guide for: ${id}`)
    return ok({ guide })
  } catch (error) {
    return codingError(error)
  }
}
