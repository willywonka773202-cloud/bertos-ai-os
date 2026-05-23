import { NextResponse } from 'next/server'
import { getOllamaConfig } from '@/lib/bertos/runtime'
import { fetchLocalDaemonStatus } from '@/lib/bertos/local-daemon'
import { getComposioStatus } from '@/lib/tools/composio'
import { getGeminiNativeApiKey } from '@/lib/bertos/providers/gemini-native'
import { getHermesNousConfig, status as getHermesNousProviderStatus } from '@/lib/bertos/providers/hermes-nous'

export const runtime = 'nodejs'

export async function GET() {
  const ollama = getOllamaConfig()
  const localDaemon = await fetchLocalDaemonStatus()
  const composio = await getComposioStatus()
  const geminiNativeConfigured = Boolean(getGeminiNativeApiKey())
  const hermesCfg = getHermesNousConfig()
  const hermesProviderStatus = await getHermesNousProviderStatus()
  const hermesConfigured = Boolean(hermesCfg.apiUrl && hermesCfg.apiKey)
  const fccEnabled = process.env.ENABLE_FCC_PROXY === 'true'
  const devinConfigured = Boolean(process.env.DEVIN_API_KEY)
  const qwenConfigured = Boolean(process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY)
  const hermesStatus = {
    id: 'hermes-nous',
    configured: hermesConfigured,
    proxyReachable: hermesProviderStatus.online,
    paidEnabled: hermesCfg.paidEnabled,
    availableForRouting: hermesProviderStatus.online,
    requiredEnvVars: ['HERMES_API_URL', 'HERMES_API_KEY'],
    optionalEnvVars: ['HERMES_MODEL'],
    gateEnvVar: 'ENABLE_HERMES_PAID',
    billing: 'Paid API credits may be used by remote Hermes Agent',
    statusMessage: hermesProviderStatus.online
      ? 'Hermes API server is reachable and available for manual routing.'
      : hermesProviderStatus.error ?? 'Hermes is not available for routing.',
    defaultProvider: false,
    autoRoutingDisabledUnless: 'manual selection plus ENABLE_HERMES_PAID=true',
    model: hermesProviderStatus.modelOrTool,
    error: hermesProviderStatus.error,
  }
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
    {
      id: 'hermes-nous',
      name: 'Hermes / Nous Remote',
      status: hermesProviderStatus.online ? 'online' : 'offline',
      message: hermesProviderStatus.online
        ? `OpenAI-compatible Hermes API server (${hermesProviderStatus.modelOrTool})`
        : hermesProviderStatus.error ?? 'Paid API credits required; auto-routing disabled',
    },
  ]
  const externalAgents = {
    devin: {
      id: 'devin',
      name: 'Devin',
      category: 'cloud-teammate',
      configured: devinConfigured,
      status: devinConfigured ? 'configured' : 'copy-prompt-only',
      billing: 'External cloud coding teammate',
      runnableFromBertOS: false,
      message: devinConfigured
        ? 'Credentials detected, but BertOS does not call Devin APIs in this status endpoint.'
        : 'Copy-prompt / PR workflow only. No live Devin API calls are made.',
      safety: 'Do not auto-merge Devin output.',
    },
    freeClaudeCode: {
      id: 'free-claude-code',
      name: 'Free Claude Code Proxy',
      category: 'experimental-proxy',
      configured: fccEnabled,
      status: fccEnabled ? 'enabled' : 'disabled',
      billing: 'Provider-dependent backend pricing',
      runnableFromBertOS: false,
      message: fccEnabled
        ? 'Experimental proxy flag is enabled; keep official Claude Code separate.'
        : 'Disabled unless ENABLE_FCC_PROXY=true.',
      safety: 'Not official Anthropic Claude. Do not replace Claude Code.',
    },
    googleAntiGravityCli: {
      id: 'google-antigravity-cli',
      name: 'Google Anti-Gravity CLI',
      category: 'migration',
      configured: false,
      status: 'planned',
      billing: 'Unknown until verified',
      runnableFromBertOS: false,
      message: 'Planned/experimental. Verify official docs and local command detection before routing.',
      safety: 'Gemini CLI remains supported and Anti-Gravity is not default.',
    },
    googleManagedAgents: {
      id: 'google-managed-agents',
      name: 'Google Managed Agents API',
      category: 'planned',
      configured: false,
      status: 'planned',
      billing: 'Cloud billing likely; unverified',
      runnableFromBertOS: false,
      message: 'Future cloud sandbox concept. No live paid calls are made.',
      safety: 'Local daemon remains the current file and terminal bridge.',
    },
    qwenExperimental: {
      id: 'qwen-experimental',
      name: 'Qwen Experimental',
      category: 'experimental',
      configured: qwenConfigured,
      status: qwenConfigured ? 'configured' : 'manual-or-api-needed',
      billing: 'Manual/API provider dependent',
      runnableFromBertOS: false,
      message: qwenConfigured
        ? 'Qwen key detected, but no live call is made from provider status.'
        : 'Manual/API experimental. Do not assume free unlimited usage.',
      safety: 'Use as copy-prompt or future adapter only.',
    },
    openclaw: {
      id: 'openclaw',
      name: 'OpenClaw',
      category: 'planned-local-agent',
      configured: false,
      status: 'planned',
      billing: 'Planned local/open integration',
      runnableFromBertOS: false,
      message: 'Planned local agent integration. No installed backend is claimed.',
      safety: 'No fake autonomous execution.',
    },
    browserSkills: {
      id: 'browser-skills',
      name: 'Browser Skills',
      category: 'planned-verification',
      configured: false,
      status: 'planned',
      billing: 'Local/plugin dependent',
      runnableFromBertOS: false,
      message: 'Planned browser verification surface. No direct BertOS route yet.',
      safety: 'Use route smoke checks only when a real browser workflow is wired.',
    },
    hyperframes: {
      id: 'hyperframes',
      name: 'Hyperframes Video Agent',
      category: 'planned-media',
      configured: false,
      status: 'planned',
      billing: 'Local setup dependent; requires Node, FFmpeg, and Hyperframes setup',
      runnableFromBertOS: false,
      message: 'Planned local HTML/CSS/JS animated video pipeline. Not installed or verified.',
      safety: 'No fake rendering. Treat as setup/prompt-only until detected.',
    },
    remotion: {
      id: 'remotion',
      name: 'Remotion Video Agent',
      category: 'planned-media',
      configured: false,
      status: 'planned',
      billing: 'Local setup dependent; requires Node, FFmpeg/Remotion setup',
      runnableFromBertOS: false,
      message: 'Planned local React video rendering pipeline. Not installed or verified.',
      safety: 'No fake API integration.',
    },
  }

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
      hermesNous: hermesProviderStatus.online,
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
    hermes: hermesStatus,
    hermesNous: hermesStatus,
    externalAgents,
    migrations: {
      geminiCli: {
        status: providers.find(provider => provider.id === 'gemini-cli')?.status ?? 'unknown',
        message: 'Current Gemini CLI remains supported.',
      },
      googleAntiGravityCli: externalAgents.googleAntiGravityCli,
      googleManagedAgents: externalAgents.googleManagedAgents,
    },
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
