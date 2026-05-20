import { NextResponse } from 'next/server'
import { listComposioApps } from '@/lib/tools/composio'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return NextResponse.json({ ok: true, apps: await listComposioApps() }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Composio apps request failed.',
    }, { status: 400 })
  }
}
