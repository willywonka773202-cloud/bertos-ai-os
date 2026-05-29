import type { NextRequest } from 'next/server'
import { testProvider } from '@/lib/bertos/coding/assistant'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await readBody<{ allowPaid?: boolean }>(req)
    const result = await testProvider({ allowPaid: Boolean(body.allowPaid) })
    return ok({ result })
  } catch (error) {
    return codingError(error)
  }
}
