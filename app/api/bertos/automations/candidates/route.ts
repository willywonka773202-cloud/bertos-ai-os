import { NextRequest, NextResponse } from 'next/server'
import { CREATOR_OS_AUTOMATION_TEMPLATES, createAndSaveAutomationCandidate, listAutomationCandidates } from '@/lib/bertos/automation/creator-os'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    ok: true,
    templates: CREATOR_OS_AUTOMATION_TEMPLATES,
    candidates: await listAutomationCandidates(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!body.sourceRunId) return NextResponse.json({ ok: false, error: 'sourceRunId is required.' }, { status: 400 })
  return NextResponse.json({ ok: true, candidate: await createAndSaveAutomationCandidate(body) }, { headers: { 'Cache-Control': 'no-store' } })
}
