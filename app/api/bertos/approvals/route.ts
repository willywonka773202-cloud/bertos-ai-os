import type { NextRequest } from 'next/server'
import { createApprovalRequest, listApprovalRequests, type CreateApprovalInput } from '@/lib/bertos/coding/approvals'
import type { ApprovalStatus } from '@/lib/bertos/coding/types'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId') ?? undefined
    const status = (req.nextUrl.searchParams.get('status') as ApprovalStatus | null) ?? undefined
    const approvals = await listApprovalRequests({ projectId, status })
    return ok({ approvals })
  } catch (error) {
    return codingError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody<CreateApprovalInput>(req)
    const approval = await createApprovalRequest(body)
    return ok({ approval }, 201)
  } catch (error) {
    return codingError(error)
  }
}
