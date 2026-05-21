import { NextResponse } from 'next/server'
import { getOllamaConfig } from '@/lib/bertos/runtime'
import { fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'
import { getComposioStatus } from '@/lib/tools/composio'
import { getGeminiNativeApiKey } from '@/lib/bertos/providers/gemini-native'

export const runtime = 'nodejs'

export async function GET() {
  const ollama = getOllamaConfig()
  const localDaemon = await fetchLocalDaemonStatus()
  const composio = await getComposioStatus()
  const geminiNativeConfigured = Boolean(getGeminiNativeApiKey())
  const providers = [
    {
      id: 'ollama-pro',
      name: ollama.providerName,
      status: (ollama.requiresApiKey ? Boolean(ollama.apiKey) : true) ? 'online' : 'offline',
      message: ollama.defaultModel,
    },
    ...localDaemon.tools.map(tool => ({
      id: tool.id,
      name: tool.label,
      status: localDaemon.online && tool.installed ? 'online' : 'offline',
      message: tool.version || tool.error || tool.resolvedPath,
    })),
    {
      id: 'gemini-api-native',
      name: 'Gemini Native API',
      status: geminiNativeConfigured ? 'online' : 'offline',
      message: geminiNativeConfigured
        ? 'Structured JSON, long context, council judge'
        : 'Missing GEMINI_API_KEY',
    },
  ]

  return NextResponse.json({
    providers,
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
      geminiNative: geminiNativeConfigured,
    },
    geminiNative: {
      id: 'gemini-api-native',
      configured: geminiNativeConfigured,
      available: geminiNativeConfigured,
      requiredEnvVars: ['GEMINI_API_KEY'],
      fallbackEnvVars: ['GOOGLE_API_KEY'],
      capabilities: ['structured-json', 'long-context', 'planning', 'council-judge', 'workspace-planning', 'multimodal-foundation'],
      models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
      error: geminiNativeConfigured ? undefined : 'GEMINI_API_KEY is missing. GOOGLE_API_KEY is also supported as a fallback.',
    },
    composio,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
