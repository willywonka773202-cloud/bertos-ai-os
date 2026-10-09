import { NextResponse } from 'next/server'
import { getOllamaConfig } from '@/lib/bertos/runtime'
import { fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'
import { getComposioStatus } from '@/lib/tools/composio'
import { getDevinStatus } from '@/lib/bertos/external-agents'

export const runtime = 'nodejs'

export async function GET() {
  const ollama = getOllamaConfig()
  const localDaemon = await fetchLocalDaemonStatus()
  const composio = await getComposioStatus()

  return NextResponse.json({
    ollama: {
      id: 'ollama-pro',
      provider: ollama.providerName,
      mode: ollama.mode,
      online: ollama.requiresApiKey ? Boolean(ollama.apiKey) : true,
      defaultModel: ollama.defaultModel,
      requiresApiKey: ollama.requiresApiKey,
      error: ollama.requiresApiKey && !ollama.apiKey
        ? 'OLLAMA_API_KEY is missing on the server. The browser can still provide an Ollama Cloud key from Settings.'
        : undefined,
    },
    localDaemon,
    apiProviders: {
      enabled: process.env.ENABLE_API_PROVIDERS === 'true',
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
    },
    composio,
    externalAgents: {
      devin: {
        id: 'devin',
        name: 'Devin',
        status: getDevinStatus(),
        type: 'cloud-agent',
        description: 'Cloud AI software engineer — generates PRs from scoped task prompts',
      },
    },
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
