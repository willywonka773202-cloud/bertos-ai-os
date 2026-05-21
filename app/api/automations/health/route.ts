import { NextResponse } from 'next/server'
import { getAutomationHealth } from '@/lib/bertos/automation/runner'

export const runtime = 'nodejs'

export async function GET() {
  const health = await getAutomationHealth()
  return NextResponse.json(health, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
