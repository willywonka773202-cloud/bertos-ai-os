import { NextResponse } from 'next/server'
import { fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'
import { getHermesNousConfig } from '@/lib/bertos/providers/hermes-nous'
import { ensureBertOSRuntime } from '@/lib/bertos/runtime-init'

export const runtime = 'nodejs'

export async function GET() {
  const runtimeInit = await ensureBertOSRuntime()
    .then(result => ({
      initialized: true,
      root: result.root,
      directoryCount: result.directories.length,
    }))
    .catch(error => ({
      initialized: false,
      error: error instanceof Error ? error.message : 'Could not initialize BertOS runtime directories.',
    }))
  const daemon = await fetchLocalDaemonStatus()
  const toolAvailable = (id: string) => {
    const tool = daemon.tools.find(tool => tool.id === id)
    return Boolean(tool?.installed && tool.loginStatus === 'available')
  }
  const hermesCfg = getHermesNousConfig()

  return NextResponse.json({
    'claude-code': toolAvailable('claude-code'),
    'gemini-cli': toolAvailable('gemini-cli'),
    'codex-cli': toolAvailable('codex-cli'),
    'openclaw-cli': toolAvailable('openclaw-cli'),
    'claude-api': Boolean(process.env.ANTHROPIC_API_KEY),
    'openai-api': Boolean(process.env.OPENAI_API_KEY),
    'gemini-api': Boolean(process.env.GEMINI_API_KEY),
    'gemini-api-native': Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    'hermes-nous': Boolean(hermesCfg.enabled && hermesCfg.apiUrl && (hermesCfg.apiKey || hermesCfg.allowMissingKey)),
    enableApiProviders: process.env.ENABLE_API_PROVIDERS === 'true',
    localDaemon: daemon.online,
    runtime: runtimeInit,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
