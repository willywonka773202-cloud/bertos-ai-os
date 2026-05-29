import type { NextRequest } from 'next/server'
import { generatePatchFromProvider } from '@/lib/bertos/coding/patch-provider'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await readBody<{ projectId?: string; request?: string; paths?: string[]; providerId?: string; allowPaid?: boolean }>(req)
    if (!body.projectId) throw new CodingOSError('invalid-input', 'projectId is required.')
    if (!body.request?.trim()) throw new CodingOSError('invalid-input', 'A change request is required.')
    const result = await generatePatchFromProvider({
      projectId: body.projectId,
      request: body.request,
      paths: body.paths,
      providerId: body.providerId,
      allowPaid: Boolean(body.allowPaid),
    })
    // result.ok=false (invalid output / safety reject / no provider) is valid data, not an error.
    return ok({ result }, result.ok ? 201 : 200)
  } catch (error) {
    return codingError(error)
  }
}
