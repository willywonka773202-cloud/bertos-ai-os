import { NextRequest, NextResponse } from 'next/server'
import { fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'
import { getOllamaConfig } from '@/lib/bertos/runtime'

export const runtime = 'nodejs'

function requireCliSecret(req: NextRequest): string | null {
  const configured = process.env.BERTOS_AGENT_SECRET?.trim()
  if (!configured) return 'BERTOS_AGENT_SECRET is not configured on this deployment.'
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
    || req.headers.get('x-bertos-agent-secret')?.trim()
  if (supplied !== configured) return 'Invalid or missing BertOS agent secret.'
  return null
}

export async function GET(req: NextRequest) {
  const authError = requireCliSecret(req)
  if (authError) return NextResponse.json({ ok: false, error: authError }, { status: 401 })

  const daemon = await fetchLocalDaemonStatus()
  const ollama = getOllamaConfig()

  return NextResponse.json({
    ok: true,
    api: {
      reachable: true,
      deploymentMode: ollama.mode,
      ollamaProvider: ollama.providerName,
    },
    daemon,
    repo: daemon.repo,
    providers: {
      'ollama-pro': {
        available: ollama.requiresApiKey ? Boolean(ollama.apiKey) : true,
        model: ollama.defaultModel,
        mode: ollama.mode,
      },
      'claude-code': daemon.tools.find(tool => tool.id === 'claude-code') ?? { installed: false },
      'codex-cli': daemon.tools.find(tool => tool.id === 'codex-cli') ?? { installed: false },
      'gemini-cli': daemon.tools.find(tool => tool.id === 'gemini-cli') ?? { installed: false },
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
