import { NextRequest, NextResponse } from 'next/server'
import { runSkillInvocation } from '@/lib/bertos/invocations/runner'
import { applySkillPatch, draftSkillPatch, duplicateSkill, listSkills, seedRuntimeSkills } from '@/lib/bertos/skills/registry'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ ok: true, skills: await listSkills() }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.operation === 'seed') {
    await seedRuntimeSkills()
    return NextResponse.json({ ok: true, skills: await listSkills() }, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (body.operation === 'duplicate' && body.skillId) {
    const skill = await duplicateSkill(body.skillId, body.newId)
    return NextResponse.json({ ok: true, skill }, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (body.operation === 'draftPatch' && body.skillId && body.instruction) {
    const patch = await draftSkillPatch(body.skillId, String(body.instruction))
    return NextResponse.json({ ok: true, patch }, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (body.operation === 'applyPatch' && body.patchId) {
    const patch = await applySkillPatch(body.patchId, body.approved === true)
    return NextResponse.json({ ok: true, patch, skills: await listSkills() }, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (body.operation === 'run' && (body.skillId || body.text)) {
    const result = await runSkillInvocation({
      text: String(body.text ?? ''),
      skillId: body.skillId,
      project: body.project,
      client: body.client,
      approvedPermissions: Array.isArray(body.approvedPermissions) ? body.approvedPermissions : [],
      dryRun: body.dryRun !== false,
    })
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ ok: false, error: 'Unsupported operation.' }, { status: 400 })
}
