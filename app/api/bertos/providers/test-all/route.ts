import type { NextRequest } from 'next/server'
import { testAllProviders, type ProviderTestMode } from '@/lib/bertos/coding/provider-routing'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await readBody<{ allowPaid?: boolean; mode?: ProviderTestMode }>(req)
    const results = await testAllProviders({ allowPaid: Boolean(body.allowPaid), mode: body.mode })
    return ok({
      results,
      passed: results.filter(r => r.ok).length,
      total: results.length,
    })
  } catch (error) {
    return codingError(error)
  }
}
