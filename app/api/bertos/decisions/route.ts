import type { NextRequest } from 'next/server'
import { createDecisionRecord, listDecisionRecords, type CreateDecisionInput } from '@/lib/bertos/coding/decisions'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId') ?? undefined
    const decisions = await listDecisionRecords(projectId)
    return ok({ decisions })
  } catch (error) {
    return codingError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody<CreateDecisionInput>(req)
    const decision = await createDecisionRecord(body)
    return ok({ decision }, 201)
  } catch (error) {
    return codingError(error)
  }
}
