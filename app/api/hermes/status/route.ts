import { NextResponse } from 'next/server'
import { getHermesNousConfig, status as getHermesNousProviderStatus } from '@/lib/bertos/providers/hermes-nous'
import { hermesPublicConfig } from '@/lib/bertos/hermes-proxy'

export const runtime = 'nodejs'

export async function GET() {
  const cfg = getHermesNousConfig()
  const configured = Boolean(cfg.apiUrl && (cfg.apiKey || cfg.allowMissingKey))
  const providerStatus = await getHermesNousProviderStatus()

  if (!configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      enabled: cfg.enabled,
      paidEnabled: cfg.paidEnabled,
      scaffolded: true,
      billing: 'No paid API key is required by BertOS. Hermes can use Ollama/local models or a custom free OpenAI-compatible endpoint.',
      config: hermesPublicConfig(),
      error: 'Hermes is not connected yet. Set HERMES_ENABLED, HERMES_BASE_URL, and HERMES_API_KEY server-side.',
      setupInstructions: [
        'On the Hermes server, enable API_SERVER_ENABLED=true and set API_SERVER_KEY.',
        'For same Hostinger VPS, use HERMES_BASE_URL=http://127.0.0.1:8642/v1.',
        'For separate VPS, expose Hermes behind HTTPS and set HERMES_BASE_URL=https://hermes.your-domain.com/v1.',
        'Add HERMES_API_KEY to the BertOS server environment. Do not expose it in browser code.',
        'Restart the dev server after environment changes.',
      ],
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json({
    ok: providerStatus.online,
    configured: true,
    enabled: cfg.enabled,
    paidEnabled: cfg.paidEnabled,
    reachable: providerStatus.online,
    model: providerStatus.modelOrTool,
    mode: cfg.backendMode,
    config: hermesPublicConfig(),
    billing: cfg.paidEnabled
      ? 'Paid provider is enabled inside Hermes only if you configured one. BertOS does not require it.'
      : 'Free/local/custom Hermes backend mode.',
    message: providerStatus.online
      ? 'Hermes API server is reachable and available for manual routing.'
      : providerStatus.error,
    safety: 'BertOS calls Hermes only through server-side routes and never exposes HERMES_API_KEY to the frontend.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
