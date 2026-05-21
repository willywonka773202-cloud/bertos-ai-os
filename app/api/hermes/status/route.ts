import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const apiUrl = process.env.HERMES_API_URL
  const apiKey = process.env.HERMES_API_KEY

  if (!apiUrl || !apiKey) {
    return NextResponse.json({
      ok: false,
      configured: false,
      scaffolded: true,
      error: 'HERMES_API_URL and HERMES_API_KEY are not set.',
      setupInstructions: [
        'Add HERMES_API_URL=https://your-hermes-instance to .env.local',
        'Add HERMES_API_KEY=your-api-key to .env.local',
        'Restart the dev server',
        'Hermes handles: always-on tasks, schedules, memory, Telegram webhooks, background scans',
        'Local daemon remains responsible for file editing, terminal, and local CLIs',
      ],
    })
  }

  try {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${apiUrl}/health`, { signal: controller.signal, cache: 'no-store' })
    return NextResponse.json({
      ok: res.ok,
      configured: true,
      reachable: res.ok,
      apiUrl,
    })
  } catch {
    return NextResponse.json({
      ok: false,
      configured: true,
      reachable: false,
      error: 'Cannot reach Hermes API. Check HERMES_API_URL.',
      apiUrl,
    })
  }
}
