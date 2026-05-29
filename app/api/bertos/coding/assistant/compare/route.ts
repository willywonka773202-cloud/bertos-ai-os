import type { NextRequest } from 'next/server'
import { runProviderCompare } from '@/lib/bertos/coding/assistant'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await readBody<{ message?: string; projectId?: string; providerIds?: string[]; allowPaid?: boolean }>(req)
    if (!body.message?.trim()) throw new CodingOSError('invalid-input', 'A message is required.')
    const result = await runProviderCompare({
      message: body.message,
      projectId: body.projectId,
      providerIds: body.providerIds,
      allowPaid: Boolean(body.allowPaid),
    })
    return ok({ result }, 201)
  } catch (error) {
    return codingError(error)
  }
}
