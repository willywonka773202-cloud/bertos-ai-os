import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const apiUrl = process.env.HERMES_API_URL
  const apiKey = process.env.HERMES_API_KEY
  const paidEnabled = process.env.ENABLE_HERMES_PAID === 'true'
  const configured = Boolean(apiUrl && apiKey)

  if (!configured) {
    return NextResponse.json({
      ok: false,
      configured: false,
      paidEnabled,
      scaffolded: true,
      billing: 'Paid API credits required',
      error: 'HERMES_API_URL and HERMES_API_KEY are not set.',
      setupInstructions: [
        'Add HERMES_API_URL and HERMES_API_KEY to server environment.',
        'Set ENABLE_HERMES_PAID=true only when you accept paid routing.',
        'Restart the dev server after environment changes.',
        'Local daemon remains responsible for file editing, terminal, and local CLIs.',
      ],
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (!paidEnabled) {
    return NextResponse.json({
      ok: false,
      configured: true,
      paidEnabled: false,
      reachable: null,
      scaffolded: true,
      billing: 'Paid API credits required',
      message: 'Hermes credentials are present, but paid routing is disabled by ENABLE_HERMES_PAID.',
      safety: 'No Hermes network health call was made because paid routing is disabled.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const res = await fetch(`${apiUrl}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    return NextResponse.json({
      ok: res.ok,
      configured: true,
      paidEnabled: true,
      reachable: res.ok,
      billing: 'Paid API credits required',
      message: res.ok ? 'Hermes proxy health endpoint is reachable.' : `Hermes health returned HTTP ${res.status}.`,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({
      ok: false,
      configured: true,
      paidEnabled: true,
      reachable: false,
      billing: 'Paid API credits required',
      error: 'Cannot reach Hermes API. Check HERMES_API_URL.',
    }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
