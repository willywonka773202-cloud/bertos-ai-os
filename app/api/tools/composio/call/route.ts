import { NextRequest, NextResponse } from 'next/server'
import { callComposioAction } from '@/lib/tools/composio'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { action?: string; params?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  try {
    return NextResponse.json({
      ok: true,
      result: await callComposioAction(body.action || '', body.params),
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Composio action call failed.',
    }, { status: 400 })
  }
}
