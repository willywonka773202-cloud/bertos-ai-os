import { NextRequest, NextResponse } from 'next/server'
import { listComposioActions } from '@/lib/tools/composio'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const app = req.nextUrl.searchParams.get('app') || undefined
    return NextResponse.json({ ok: true, actions: await listComposioActions(app) }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Composio actions request failed.',
    }, { status: 400 })
  }
}
