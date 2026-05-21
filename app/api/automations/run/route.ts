import { NextRequest, NextResponse } from 'next/server'
import type { AutomationAction } from '@/lib/bertos/types'
import {
  executeAutomationActions,
  isAutomationActionApprovalOnly,
  isAutomationActionSafe,
} from '@/lib/bertos/automation/runner'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { actions?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const actions = Array.isArray(body.actions)
    ? body.actions.filter((action): action is AutomationAction => typeof action === 'string')
    : []

  if (actions.length === 0) {
    return NextResponse.json({ ok: false, error: 'At least one automation action is required.' }, { status: 400 })
  }

  const unsafe = actions.filter(action => !isAutomationActionSafe(action))
  const blocked = unsafe.filter(action => !isAutomationActionApprovalOnly(action))
  if (blocked.length > 0) {
    return NextResponse.json({
      ok: false,
      error: `Blocked unsafe automation action(s): ${blocked.join(', ')}`,
      blocked,
    }, { status: 400 })
  }

  const result = await executeAutomationActions(actions)
  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: { 'Cache-Control': 'no-store' },
  })
}
