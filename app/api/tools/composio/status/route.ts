import { NextResponse } from 'next/server'
import { getComposioStatus } from '@/lib/tools/composio'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(await getComposioStatus(), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
