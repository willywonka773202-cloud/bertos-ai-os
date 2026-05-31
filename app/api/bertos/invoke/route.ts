import { NextRequest, NextResponse } from 'next/server'
import { runSkillInvocation } from '@/lib/bertos/invocations/runner'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  try {
    const result = await runSkillInvocation({
      text: String(body.text ?? ''),
      skillId: body.skillId,
      project: body.project,
      client: body.client,
      approvedPermissions: Array.isArray(body.approvedPermissions) ? body.approvedPermissions : [],
      dryRun: body.dryRun !== false,
    })
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Invocation failed.' }, { status: 400 })
  }
}
