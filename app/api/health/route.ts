import { NextResponse } from 'next/server'
import { fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'

export const runtime = 'nodejs'

export async function GET() {
  const daemon = await fetchLocalDaemonStatus()
  const toolInstalled = (id: string) => Boolean(daemon.tools.find(tool => tool.id === id)?.installed)

  return NextResponse.json({
    'claude-code': toolInstalled('claude-code'),
    'gemini-cli': toolInstalled('gemini-cli'),
    'codex-cli': toolInstalled('codex-cli'),
    'claude-api': Boolean(process.env.ANTHROPIC_API_KEY),
    'openai-api': Boolean(process.env.OPENAI_API_KEY),
    'gemini-api': Boolean(process.env.GEMINI_API_KEY),
    enableApiProviders: process.env.ENABLE_API_PROVIDERS === 'true',
    localDaemon: daemon.online,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
