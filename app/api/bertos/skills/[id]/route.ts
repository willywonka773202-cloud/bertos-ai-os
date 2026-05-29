import { NextRequest, NextResponse } from 'next/server'
import { applySkillPatch, draftSkillPatch, getSkill } from '@/lib/bertos/skills/registry'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const skill = await getSkill(id)
  if (!skill) return NextResponse.json({ ok: false, error: 'Skill not found.' }, { status: 404 })
  return NextResponse.json({ ok: true, skill }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  if (body.operation === 'draft-patch' && body.instruction) {
    const patch = await draftSkillPatch(id, body.instruction)
    return NextResponse.json({ ok: true, patch }, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (body.operation === 'apply-patch' && body.patchId) {
    const patch = await applySkillPatch(body.patchId, Boolean(body.approved))
    return NextResponse.json({ ok: true, patch }, { headers: { 'Cache-Control': 'no-store' } })
  }
  return NextResponse.json({ ok: false, error: 'Unsupported operation.' }, { status: 400 })
}
