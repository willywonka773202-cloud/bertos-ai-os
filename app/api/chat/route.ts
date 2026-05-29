import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { routePrompt } from '@/lib/bertos/router'
import type { Message } from '@/lib/bertos/types'
import { resolveOllamaModel, CLI_MODEL_ALIASES, API_MODEL_ALIASES } from '@/lib/bertos/providers'
import { getOllamaConfig } from '@/lib/bertos/runtime'
import { askLocalDaemon, fetchLocalDaemonStatus, type LocalCliProvider } from '@/lib/bertos/local-daemon'
import { callGeminiNative } from '@/lib/bertos/providers/gemini-native'
import { callHermesNous, getHermesNousConfig, status as getHermesNousProviderStatus } from '@/lib/bertos/providers/hermes-nous'
import { buildBertOSCliChatPrompt, compactAssistantText } from '@/lib/bertos/cli-output'

// Node.js runtime required:
// - reads process.env.VERCEL to detect cloud mode
// - no localhost calls in cloud mode
export const runtime = 'nodejs'

const API_MODEL_IDS: Record<string, string> = {
  'claude-api':  'claude-opus-4-5',
  'openai-api':  'gpt-4o',
  'gemini-api':  'gemini-2.0-flash',
  'gemini-api-native': 'gemini-2.5-flash',
  'hermes-nous': 'hermes-agent',
}

interface ClientKeys {
  anthropic?: string
  openai?: string
  google?: string
  ollamaCloud?: string
}

function resolveKey(envKey: string | undefined, clientKey: string | undefined): string {
  return envKey?.trim() || clientKey?.trim() || ''
}

function isConnectivityPrompt(prompt: string): boolean {
  return /\b(connected|connections?|providers?|models?|tools?|status|online|available|can you access|what can you use)\b/i.test(prompt)
}

async function buildConnectivityReport() {
  const ollama = getOllamaConfig()
  const daemon = await fetchLocalDaemonStatus()
  const hermesCfg = getHermesNousConfig()
  const hermes = await getHermesNousProviderStatus()
  const geminiNativeConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ALLOWED_CHAT_ID)
  const telegramSecretConfigured = Boolean(process.env.TELEGRAM_WEBHOOK_SECRET)

  const localTools = daemon.tools.map(tool => ({
    label: tool.label,
    status: daemon.online && tool.installed && tool.loginStatus === 'available' ? 'online' : 'offline',
    detail: tool.version || tool.error || tool.resolvedPath || 'not detected',
  }))
  const onlineCount = [
    ollama.requiresApiKey ? Boolean(ollama.apiKey) : true,
    ...localTools.map(tool => tool.status === 'online'),
    geminiNativeConfigured,
    hermes.online,
  ].filter(Boolean).length
  const providerCount = 1 + localTools.length + 2

  const lines = [
    '**BertOS live connectivity right now**',
    '',
    `**Providers:** ${onlineCount}/${providerCount} online`,
    `- ${ollama.providerName}: ${ollama.requiresApiKey && !ollama.apiKey ? 'offline' : 'online'} (${ollama.defaultModel})`,
    ...localTools.map(tool => `- ${tool.label}: ${tool.status} (${tool.detail})`),
    `- Gemini Native API: ${geminiNativeConfigured ? 'online' : 'offline'} (${geminiNativeConfigured ? 'GEMINI_API_KEY configured' : 'missing GEMINI_API_KEY'})`,
    `- Hermes Agent: ${hermes.online ? 'online' : 'offline'} (${hermes.error || hermes.modelOrTool})`,
    '',
    '**Local control:**',
    `- BertOS daemon: ${daemon.online ? 'online' : 'offline'}${daemon.repo?.root ? ` at ${daemon.repo.root}` : ''}`,
    daemon.repo ? `- Repo safety: ${daemon.repo.safeRepo ? 'verified' : 'blocked'}${daemon.repo.branch ? ` on ${daemon.repo.branch}` : ''}` : '- Repo safety: daemon status unavailable',
    '',
    '**Telegram:**',
    `- Config present: ${telegramConfigured ? 'yes' : 'no'}`,
    `- Webhook secret: ${telegramSecretConfigured ? 'set' : 'missing'}`,
    '- Communication check: use Settings/Dashboard Telegram panel; if it says Unauthorized, replace TELEGRAM_BOT_TOKEN with the current BotFather token.',
    '',
    '**Safety gates:**',
    '- I can route chat/coding through the online local providers above.',
    '- I will not silently use paid API providers. Hermes can be free/local when HERMES_ENABLED points to a self-hosted or custom OpenAI-compatible endpoint.',
    '- I will not write files, apply patches, push git, deploy, or run destructive commands without the BertOS approval flow.',
  ]

  if (!hermesCfg.paidEnabled) {
    lines.splice(lines.indexOf('**Safety gates:**'), 0, '- Hermes does not require paid keys in BertOS. Configure HERMES_ENABLED, HERMES_BASE_URL, and HERMES_API_KEY server-side for the free/local path.', '')
  }

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  let body: {
    messages?: Message[]
    prompt?: string
    model?: string
    systemPrompt?: string
    clientKeys?: ClientKeys
    ollamaEndpoint?: string
    enableApiProviders?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ck = body.clientKeys ?? {}
  const serverApiProvidersEnabled = process.env.ENABLE_API_PROVIDERS === 'true'
  const browserApiProvidersEnabled = body.enableApiProviders === true
  const anthropicKey = resolveKey(serverApiProvidersEnabled ? process.env.ANTHROPIC_API_KEY : undefined, browserApiProvidersEnabled ? ck.anthropic : undefined)
  const openaiKey    = resolveKey(serverApiProvidersEnabled ? process.env.OPENAI_API_KEY : undefined, browserApiProvidersEnabled ? ck.openai : undefined)
  const geminiKey    = resolveKey(serverApiProvidersEnabled ? process.env.GEMINI_API_KEY : undefined, browserApiProvidersEnabled ? ck.google : undefined)

  const messages: Message[] = body.messages ?? [{
    id: '1',
    role: 'user',
    content: body.prompt ?? '',
    timestamp: Date.now(),
  }]

  const systemMessages       = messages.filter(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role !== 'system')
  const systemPrompt = (body.systemPrompt
    ?? systemMessages.map(m => m.content).join('\n'))
    || 'You are BertOS, an advanced AI assistant. Be precise, thorough, and helpful.'

  const modelAlias = (body.model && body.model !== 'auto')
    ? body.model
    : routePrompt(
        conversationMessages[conversationMessages.length - 1]?.content ?? '',
        'auto'
      ).primary as string

  const routerDecision = body.model === 'auto'
    ? routePrompt(conversationMessages[conversationMessages.length - 1]?.content ?? '', 'auto')
    : { primary: modelAlias, reasoning: `Routed to ${modelAlias} as selected.`, confidence: 1, taskType: 'general', strategy: 'single' }

  const encoder = new TextEncoder()

  // Build an SSE ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }
      const done = () => {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }

      try {
        send({ routerDecision })
        let effectiveModelAlias = modelAlias
        const latestPrompt = conversationMessages[conversationMessages.length - 1]?.content ?? ''

        if (isConnectivityPrompt(latestPrompt)) {
          const report = await buildConnectivityReport()
          send({
            provider: {
              providerId: 'bertos-status',
              model: 'live-connectivity-report',
              latencyMs: 0,
            },
          })
          send({ text: report })
          done()
          return
        }

        // ── CLI subscription providers ──────────────────────────────────
        if (CLI_MODEL_ALIASES.has(effectiveModelAlias)) {
          try {
            const prompt = buildBertOSCliChatPrompt(
              systemPrompt,
              conversationMessages.map(message => `${message.role.toUpperCase()}: ${message.content}`).join('\n\n'),
            )
            const result = await askLocalDaemon(effectiveModelAlias as LocalCliProvider, prompt, {
              timeoutMs: 180000,
            })
            send({
              localCli: {
                providerId: result.providerId,
                executable: result.executable,
                durationMs: result.durationMs,
              },
            })
            send({ text: compactAssistantText(result.stdout) || 'Local CLI completed without a visible response.' })
            done()
            return
          } catch (error) {
            send({
              localCliFallback: {
                requestedProvider: effectiveModelAlias,
                fallbackProvider: 'ollama-pro',
                reason: error instanceof Error ? error.message : 'Local CLI bridge unavailable.',
              },
            })
            effectiveModelAlias = 'ollama-pro'
          }
        }

        // ── Optional API providers (disabled by default) ────────────────
        if (API_MODEL_ALIASES.has(effectiveModelAlias)) {
          const hermesFreeRouteAllowed = effectiveModelAlias === 'hermes-nous' && getHermesNousConfig().enabled
          const apiAllowedForThisRequest = browserApiProvidersEnabled || serverApiProvidersEnabled || hermesFreeRouteAllowed

          if (!serverApiProvidersEnabled && effectiveModelAlias === 'gemini-api-native') {
            send({
              apiFallback: {
                requestedProvider: 'gemini-api-native',
                fallbackProvider: 'ollama-pro',
                reason: 'Gemini Native API uses server-held credentials and is disabled until ENABLE_API_PROVIDERS=true is set server-side.',
              },
            })
            effectiveModelAlias = 'ollama-pro'
          }

          if (!apiAllowedForThisRequest && effectiveModelAlias !== 'ollama-pro') {
            throw new Error(
              `API providers are disabled by default. ` +
              `Enable them in Settings with a browser-scoped key, or set ENABLE_API_PROVIDERS=true server-side. ` +
              `Note: ${effectiveModelAlias} creates a separate metered API bill.`
            )
          }

          if (effectiveModelAlias === 'claude-api') {
            if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is not configured. Add it in Settings → API Keys.')
            const client = new Anthropic({ apiKey: anthropicKey })
            const apiMessages = conversationMessages.map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }))
            const apiStream = await client.messages.create({
              model: API_MODEL_IDS['claude-api'],
              max_tokens: 4096,
              system: systemPrompt,
              messages: apiMessages,
              stream: true,
            })
            for await (const event of apiStream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                send({ text: event.delta.text })
              }
            }
          } else if (effectiveModelAlias === 'openai-api') {
            if (!openaiKey) throw new Error('OPENAI_API_KEY is not configured. Add it in Settings → API Keys.')
            const client = new OpenAI({ apiKey: openaiKey })
            const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
              ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
              ...conversationMessages.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
              })),
            ]
            const apiStream = await client.chat.completions.create({
              model: API_MODEL_IDS['openai-api'],
              messages: openaiMessages,
              stream: true,
              max_tokens: 4096,
            })
            for await (const chunk of apiStream) {
              const text = chunk.choices[0]?.delta?.content
              if (text) send({ text })
            }
          } else if (effectiveModelAlias === 'gemini-api') {
            if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured. Add it in Settings → API Keys.')
            const client = new GoogleGenAI({ apiKey: geminiKey })
            const contents = conversationMessages.map(m => ({
              role: m.role === 'user' ? 'user' : 'model',
              parts: [{ text: m.content }],
            }))
            const apiStream = await client.models.generateContentStream({
              model: API_MODEL_IDS['gemini-api'],
              contents,
              config: { systemInstruction: systemPrompt },
            })
            for await (const chunk of apiStream) {
              const text = chunk.text
              if (text) send({ text })
            }
          } else if (effectiveModelAlias === 'gemini-api-native') {
            const result = await callGeminiNative({
              model: API_MODEL_IDS['gemini-api-native'],
              mode: 'chat',
              prompt: conversationMessages.map(m => `${m.role}: ${m.content}`).join('\n\n'),
              systemInstruction: systemPrompt,
              responseMimeType: 'text/plain',
              temperature: 0.4,
            })
            if (!result.ok) throw new Error(result.error || 'Gemini Native API request failed.')
            send({
              provider: {
                providerId: result.provider,
                model: result.model,
                latencyMs: result.latencyMs,
              },
            })
            send({ text: result.text ?? '' })
          } else if (effectiveModelAlias === 'hermes-nous') {
            const result = await callHermesNous({
              model: API_MODEL_IDS['hermes-nous'],
              messages: conversationMessages.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
              })),
              systemInstruction: systemPrompt,
              temperature: 0.4,
            })
            if (!result.ok) throw new Error(result.error || 'Hermes request failed.')
            send({
              provider: {
                providerId: result.provider,
                model: result.model,
                latencyMs: result.latencyMs,
              },
            })
            send({ text: result.text ?? '' })
          }

          if (effectiveModelAlias !== 'ollama-pro') {
            done()
            return
          }
        }

        // ── Ollama (default provider, no API billing) ───────────────────
        const cfg = getOllamaConfig()

        // Override endpoint from client settings if explicitly set
        const effectiveChatUrl = body.ollamaEndpoint?.trim()
          ? body.ollamaEndpoint.trim().replace(/\/(api\/(chat|generate))?\/?$/, '') + '/api/chat'
          : cfg.chatUrl

        const ollamaModel = resolveOllamaModel(effectiveModelAlias)

        if (process.env.NODE_ENV !== 'production') {
          console.log(`[BertOS] mode=${cfg.mode} provider=${cfg.providerName} model=${ollamaModel} endpoint=${new URL(effectiveChatUrl).origin}`)
        }

        // Client-supplied key (from Settings → Providers) overrides env var
        const effectiveOllamaKey = ck.ollamaCloud?.trim() || cfg.apiKey

        if (cfg.requiresApiKey && !effectiveOllamaKey) {
          throw new Error(
            `Ollama Cloud mode is enabled, but no API key found. ` +
            `Enter your key in Settings → Providers → Ollama Cloud API Key, ` +
            `or add OLLAMA_API_KEY in Vercel Project Settings → Environment Variables.`
          )
        }

        const ollamaMessages = [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          ...conversationMessages.map(m => ({ role: m.role, content: m.content })),
        ]

        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (effectiveOllamaKey) headers['Authorization'] = `Bearer ${effectiveOllamaKey}`

        const res = await fetch(effectiveChatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: ollamaModel,
            messages: ollamaMessages,
            stream: true,
          }),
        })

        if (!res.ok) {
          let detail = `HTTP ${res.status}`
          try {
            const errBody = await res.json() as { error?: string; message?: string }
            detail = errBody.error ?? errBody.message ?? detail
          } catch { /* body not JSON */ }

          if (res.status === 401 || res.status === 403) {
            throw new Error(
              `Ollama ${cfg.mode === 'cloud' ? 'Cloud' : 'Local'} auth failed (${res.status}). ` +
              (cfg.mode === 'cloud'
                ? 'Check your Ollama API key in Settings → Providers, or set OLLAMA_API_KEY in Vercel env vars.'
                : 'Run: ollama signin')
            )
          }
          throw new Error(`Ollama ${cfg.mode === 'cloud' ? 'Cloud' : 'Local'}: ${detail}`)
        }

        if (!res.body) throw new Error('No response body from Ollama.')

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const data = JSON.parse(line) as {
                message?: { content?: string }
                response?: string
                done?: boolean
              }
              const text = data.message?.content ?? data.response ?? ''
              if (text) send({ text })
            } catch { /* skip malformed NDJSON */ }
          }
        }

        done()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Stream error'
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`))
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch { /* controller already closed */ }
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
