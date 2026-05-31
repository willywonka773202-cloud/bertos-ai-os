import { NextRequest, NextResponse } from 'next/server'
import { WORKFLOW_DEFINITIONS } from '@/lib/bertos/workflows/definitions'
import { runWorkflow } from '@/lib/bertos/workflows/runner'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ ok: true, workflows: WORKFLOW_DEFINITIONS }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body.workflowId) return NextResponse.json({ ok: false, error: 'workflowId is required.' }, { status: 400 })
  try {
    const result = await runWorkflow(body)
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Workflow failed.' }, { status: 400 })
  }
}
