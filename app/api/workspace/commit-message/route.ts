import { NextRequest, NextResponse } from 'next/server'
import { askWithProviderRouter } from '@/lib/bertos/providers/router'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { diff?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const diff = body.diff?.trim()
  if (!diff) {
    return NextResponse.json({ ok: false, error: 'diff is required.' }, { status: 400 })
  }

  const result = await askWithProviderRouter([
    'Write a concise git commit message for this bertos-ai-os change.',
    'Return only the commit message. Use imperative mood. No markdown.',
    body.status ? `Git status:\n${body.status}` : '',
    `Diff:\n${diff.slice(0, 30000)}`,
  ].filter(Boolean).join('\n\n'), 'ollama-pro')

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error || 'Could not generate commit message.' }, { status: 500 })
  }

  const message = result.text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join('\n')
    .replace(/^["']|["']$/g, '')

  return NextResponse.json({
    ok: true,
    message: message || 'Update BertOS workspace',
    provider: {
      providerId: result.providerId,
      providerName: result.providerName,
      modelOrTool: result.modelOrTool,
      latencyMs: result.latencyMs,
      source: result.source,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
