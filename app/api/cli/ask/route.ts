import { NextRequest, NextResponse } from 'next/server'
import { routePrompt } from '@/lib/bertos/router'
import { API_MODEL_ALIASES, CLI_MODEL_ALIASES, resolveOllamaModel } from '@/lib/bertos/providers'
import { getOllamaConfig } from '@/lib/bertos/runtime'
import type { AIModel } from '@/lib/bertos/types'

export const runtime = 'nodejs'

function requireCliSecret(req: NextRequest): string | null {
  const configured = process.env.BERTOS_AGENT_SECRET?.trim()
  if (!configured) return 'BERTOS_AGENT_SECRET is not configured on this deployment.'
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
    || req.headers.get('x-bertos-agent-secret')?.trim()
  if (supplied !== configured) return 'Invalid or missing BertOS agent secret.'
  return null
}

export async function POST(req: NextRequest) {
  const authError = requireCliSecret(req)
  if (authError) return NextResponse.json({ ok: false, error: authError }, { status: 401 })

  let body: { prompt?: string; providerId?: string; model?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ ok: false, error: 'prompt is required.' }, { status: 400 })
  }

  const preferred = (body.model || body.providerId || 'auto') as AIModel
  const routerDecision = routePrompt(body.prompt, preferred)
  const modelAlias = routerDecision.primary
  const effectiveModelAlias = CLI_MODEL_ALIASES.has(modelAlias) || API_MODEL_ALIASES.has(modelAlias)
    ? 'ollama-pro'
    : modelAlias
  const cfg = getOllamaConfig()
  const ollamaModel = resolveOllamaModel(effectiveModelAlias)

  if (cfg.requiresApiKey && !cfg.apiKey) {
    return NextResponse.json({
      ok: false,
      error: 'Ollama Cloud mode is enabled, but OLLAMA_API_KEY is missing on the server.',
      routerDecision,
    }, { status: 500 })
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`

    const res = await fetch(cfg.chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ollamaModel,
        messages: [{ role: 'user', content: body.prompt }],
        stream: true,
      }),
    })

    if (!res.ok || !res.body) {
      return NextResponse.json({
        ok: false,
        error: `Ollama returned HTTP ${res.status}.`,
        routerDecision,
      }, { status: 500 })
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let text = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const data = JSON.parse(line) as { message?: { content?: string }; response?: string }
          text += data.message?.content ?? data.response ?? ''
        } catch {
          // Ignore malformed provider chunks.
        }
      }
    }

    return NextResponse.json({
      ok: true,
      provider: cfg.providerName,
      mode: cfg.mode,
      model: ollamaModel,
      routerDecision,
      text,
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'CLI ask failed.',
      routerDecision,
    }, { status: 500 })
  }
}
