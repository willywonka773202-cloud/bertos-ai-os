import type { NextRequest } from 'next/server'
import { runCodingWorkflow, CODING_WORKFLOWS, type CodingWorkflowId } from '@/lib/bertos/coding/workflows'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function GET() {
  return ok({ workflows: CODING_WORKFLOWS })
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody<{ projectId?: string; workflowId?: CodingWorkflowId; request?: string }>(req)
    if (!body.projectId) throw new CodingOSError('invalid-input', 'projectId is required.')
    if (!body.workflowId) throw new CodingOSError('invalid-input', 'workflowId is required.')
    const result = await runCodingWorkflow(body.projectId, body.workflowId, { request: body.request })
    return ok({ result }, 201)
  } catch (error) {
    return codingError(error)
  }
}
