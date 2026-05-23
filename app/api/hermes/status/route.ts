import { NextResponse } from 'next/server'
import { getHermesNousConfig, status as getHermesNousProviderStatus } from '@/lib/bertos/providers/hermes-nous'

export const runtime = 'nodejs'

export async function GET() {
  const cfg = getHermesNousConfig()
  const configured = Boolean(cfg.apiUrl && cfg.apiKey)
  const providerStatus = await getHermesNousProviderStatus()

  if (!configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      paidEnabled: cfg.paidEnabled,
      scaffolded: true,
      billing: 'Paid API credits may be used by remote Hermes Agent',
      error: 'HERMES_API_URL and HERMES_API_KEY are not set.',
      setupInstructions: [
        'On Hostinger Hermes, enable API_SERVER_ENABLED=true and set API_SERVER_KEY.',
        'Expose the Hermes API server /v1 endpoint over a trusted HTTPS URL or tunnel.',
        'Add HERMES_API_URL and HERMES_API_KEY to the BertOS server environment.',
        'Set ENABLE_HERMES_PAID=true only when you accept paid routing.',
        'Restart the dev server after environment changes.',
      ],
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json({
    ok: providerStatus.online,
    configured: true,
    paidEnabled: cfg.paidEnabled,
    reachable: providerStatus.online,
    model: providerStatus.modelOrTool,
    billing: 'Paid API credits may be used by remote Hermes Agent',
    message: providerStatus.online
      ? 'Hermes API server is reachable and available for manual routing.'
      : providerStatus.error,
    safety: cfg.paidEnabled
      ? 'Health check made only after ENABLE_HERMES_PAID=true; chat calls still require manual provider selection.'
      : 'No Hermes network health call was made because paid routing is disabled.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
