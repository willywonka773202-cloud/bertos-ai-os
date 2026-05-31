'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Clipboard, Copy, Loader2, Play, RotateCcw, Send, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/bertos/cn'
import { fetchLocalDaemonBridge } from '@/lib/bertos/browser-daemon'
import {
  fetchBrowserAwareProviderStatus,
  isLocalCliProvider,
  type BrowserAwareProviderStatusResponse,
} from '@/lib/bertos/provider-status-client'
import { scopedClientKeysForModel } from '@/lib/bertos/client-provider-keys'
import { buildBertOSCliChatPrompt, cleanCliAssistantText, compactAssistantText } from '@/lib/bertos/cli-output'
import { getModelLabel } from '@/lib/bertos/router'
import type { AgentEngine } from '@/lib/bertos/agent-engines'
import { useUIStore } from '@/store/bertos/ui'
import type { Message } from '@/lib/bertos/types'
import type { LocalDaemonAskResult } from '@/lib/bertos/local-daemon'

interface EngineMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  error?: boolean
}

function storageKey(engineId: string) {
  return `bertos-agent-engine-chat-${engineId}-v2`
}

function starterPrompt(engine: AgentEngine) {
  if (engine.id === 'bertos') return 'Use the best BertOS agent lane for this task and explain which engines you would involve.'
  if (engine.id === 'codex') return 'Inspect this coding task, propose a focused implementation plan, and list validation commands.'
  if (engine.id === 'claude') return 'Review this UI or architecture idea and identify the cleanest implementation path.'
  if (engine.id === 'gemini') return 'Plan this large task, identify missing context, and break it into safe phases.'
  if (engine.id === 'ollama') return 'Summarize this into a concise action plan and memory handoff.'
  if (engine.id === 'hermes') return 'Use Hermes inside BertOS for this task. If Hermes is not connected, explain exactly which free/self-hosted setup step is missing.'
  return `Talk to ${engine.label} about this task.`
}

function statusTone(status?: string) {
  if (status === 'online') return 'success'
  if (status === 'configured' || status === 'enabled') return 'warning'
  return 'default'
}

const ENGINE_LOGOS: Record<string, string> = {
  codex: '/brand-icons/codex.svg',
  claude: '/brand-icons/claude.svg',
  gemini: '/brand-icons/gemini.svg',
  ollama: '/brand-icons/ollama.svg',
  hermes: '/brand-icons/hermes.svg',
}

export function AgentEngineChatView({ engine }: { engine: AgentEngine }) {
  const theme = engine.theme
  const { settings } = useUIStore()
  const [prompt, setPrompt] = useState(starterPrompt(engine))
  const [messages, setMessages] = useState<EngineMessage[]>([])
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<BrowserAwareProviderStatusResponse | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const provider = status?.providers?.find(item => item.id === engine.providerStatusId)
  const cliProviderId = isLocalCliProvider(engine.providerStatusId) ? engine.providerStatusId : null
  const apiEnabled = Boolean(settings.enableApiProviders || status?.apiProviders?.enabled)
  const hermesEnabled = Boolean(status?.hermes?.enabled)
  const directBlockedReason = useMemo(() => {
    if (engine.requiresApiProviders && !apiEnabled) return 'API providers are disabled in Settings.'
    if (engine.id === 'hermes' && !hermesEnabled) return 'Hermes is not enabled. Set HERMES_ENABLED=true plus HERMES_BASE_URL and HERMES_API_KEY server-side.'
    if (engine.paidGated) return 'This paid engine gate is disabled.'
    if (status && cliProviderId && provider?.status === 'blocked') {
      return `${engine.label} is installed but the last CLI verification failed. ${provider.message ?? 'Open Settings -> Providers, fix the CLI account/auth issue, then retry.'}`
    }
    if (status && cliProviderId && provider?.status === 'offline') {
      return `${engine.label} is not reachable through the browser daemon. Start npm run bertos:daemon, then check Settings -> Providers.`
    }
    return ''
  }, [apiEnabled, cliProviderId, engine.id, engine.label, engine.paidGated, engine.requiresApiProviders, hermesEnabled, provider?.status, status])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(engine.id))
      if (raw) setMessages(JSON.parse(raw) as EngineMessage[])
    } catch {
      setMessages([])
    }
  }, [engine.id])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(engine.id), JSON.stringify(messages.slice(-40)))
    } catch {
      // Local history is convenience only.
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [engine.id, messages])

  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      try {
        const data = await fetchBrowserAwareProviderStatus()
        if (!cancelled) setStatus(data)
      } catch {
        if (!cancelled) setStatus(null)
      }
    }

    void loadStatus()
    const interval = window.setInterval(loadStatus, 30000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const appendToAssistant = (id: string, text: string) => {
    setMessages(current => current.map(message => (
      message.id === id ? { ...message, content: message.content + text } : message
    )))
  }

  const send = async () => {
    const content = prompt.trim()
    if (!content || running) return
    if (directBlockedReason) {
      toast.error(directBlockedReason)
      return
    }

    const userMessage: EngineMessage = { id: `${Date.now()}-u`, role: 'user', content }
    const assistantId = `${Date.now()}-a`
    const assistantMessage: EngineMessage = { id: assistantId, role: 'assistant', content: '', streaming: true }
    setMessages(current => [...current, userMessage, assistantMessage])
    setPrompt('')
    setRunning(true)
    abortRef.current = new AbortController()

    try {
      const conversation: Message[] = [...messages, userMessage]
        .slice(-12)
        .map((message, index) => ({
          id: `${message.id}-${index}`,
          role: message.role,
          content: message.content,
          timestamp: Date.now(),
        }))

      const systemPrompt = [
        `You are ${engine.label} inside BertOS.`,
        `Role: ${engine.role}`,
        `Best use: ${engine.bestUse}`,
        engine.id === 'bertos'
          ? 'You may explain how BertOS would route work across engines, but do not claim unavailable engines ran.'
          : `Answer as the direct ${engine.label} lane. If setup is missing, say exactly what is missing.`,
        'Never expose secrets, claim fake command output, push, deploy, or spend paid credits without explicit approval.',
      ].join('\n')

      if (cliProviderId) {
        const transcript = conversation
          .map(message => `${message.role.toUpperCase()}: ${message.content}`)
          .join('\n\n')
        const daemonPrompt = buildBertOSCliChatPrompt(systemPrompt, transcript)

        const res = await fetchLocalDaemonBridge('/api/local-daemon/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId: cliProviderId,
            prompt: daemonPrompt,
            timeoutMs: 180000,
          }),
          signal: abortRef.current.signal,
        })
        const result = await res.json() as LocalDaemonAskResult
        if (!res.ok || !result.ok) {
          const detail = [
            cleanCliAssistantText(result.stdout ?? ''),
            cleanCliAssistantText(result.stderr ?? ''),
            result.error,
          ].filter(Boolean).join('\n\n')
          throw new Error(detail || `Local ${engine.label} bridge returned HTTP ${res.status}.`)
        }
        const stdout = compactAssistantText(result.stdout)
        appendToAssistant(assistantId, stdout || 'Local CLI completed without a visible response.')
        setMessages(current => current.map(message => (
          message.id === assistantId ? { ...message, streaming: false } : message
        )))
        fetchBrowserAwareProviderStatus().then(setStatus).catch(() => null)
        return
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversation,
          model: engine.model,
          systemPrompt,
          clientKeys: scopedClientKeysForModel(engine.model, settings.apiKeys),
          ollamaEndpoint: settings.ollamaEndpoint,
          enableApiProviders: settings.enableApiProviders ?? false,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('No response body.')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const raw = trimmed.slice(6)
          if (raw === '[DONE]') break
          try {
            const parsed = JSON.parse(raw) as { text?: string; error?: string }
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.text) appendToAssistant(assistantId, parsed.text)
          } catch (error) {
            if (error instanceof Error && error.message !== 'Unexpected end of JSON input') throw error
          }
        }
      }

      setMessages(current => current.map(message => (
        message.id === assistantId ? { ...message, streaming: false } : message
      )))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Engine request failed.'
      setMessages(current => current.map(item => (
        item.id === assistantId ? { ...item, content: `Error: ${message}`, streaming: false, error: true } : item
      )))
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  const stop = () => {
    abortRef.current?.abort()
    setRunning(false)
    setMessages(current => current.map(message => message.streaming ? { ...message, streaming: false } : message))
  }

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt)
    toast.success('Prompt copied.')
  }

  return (
    <div
      className="flex h-full min-h-0"
      style={{
        background: `radial-gradient(circle at 18% 0%, ${theme.accent}20, transparent 32%), radial-gradient(circle at 82% 8%, ${theme.accent2}18, transparent 30%), linear-gradient(160deg, ${theme.background}, #020308 72%)`,
        color: theme.text,
      }}
    >
      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b px-5 py-4" style={{ borderColor: theme.border, background: `${theme.surface}` }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-black"
                  style={{
                    borderColor: theme.border,
                    background: `linear-gradient(135deg, ${theme.accent}24, ${theme.accent2}18)`,
                    color: theme.accent,
                    boxShadow: `0 0 24px ${theme.shadow}`,
                  }}
                >
                  {ENGINE_LOGOS[engine.id] ? (
                    <img src={ENGINE_LOGOS[engine.id]} alt="" className="h-8 w-8 rounded-md" />
                  ) : (
                    engine.theme.mark
                  )}
                </div>
                <div>
                  <h1 className="text-lg font-semibold" style={{ color: theme.text }}>{engine.label}</h1>
                  <p className="text-xs" style={{ color: theme.muted }}>{engine.role}</p>
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed" style={{ color: theme.muted }}>{engine.bestUse}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusTone(provider?.status)} className="text-[10px]">{provider?.status ?? 'checking'}</Badge>
              <Badge variant={engine.paidGated ? 'warning' : 'default'} className="text-[10px]">{getModelLabel(engine.model)}</Badge>
            </div>
          </div>
          {(engine.warning || directBlockedReason || provider?.message) && (
            <div className={cn(
              'mt-3 rounded-lg border p-3 text-xs leading-relaxed',
              directBlockedReason ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : '',
            )}
            style={!directBlockedReason ? { borderColor: theme.border, background: theme.surface2, color: theme.muted } : undefined}
            >
              <div className="flex gap-2">
                {directBlockedReason ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <div>
                  {directBlockedReason && <div>{directBlockedReason}</div>}
                  {engine.warning && <div>{engine.warning}</div>}
                  {provider?.message && <div className="text-zinc-500">{provider.message}</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto max-w-4xl space-y-4 px-5 py-5">
            {messages.length === 0 ? (
              <div className="rounded-xl border p-5" style={{ borderColor: theme.border, background: theme.surface }}>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: theme.text }}>
                  <Clipboard className="h-4 w-4" style={{ color: theme.accent }} />
                  Direct engine chat
                </div>
                <p className="text-sm leading-relaxed" style={{ color: theme.muted }}>
                  This tab talks directly to {engine.label}. Use BertOS when you want automatic routing across engines; use this tab when you want one specific agent’s perspective.
                </p>
              </div>
            ) : messages.map(message => (
              <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[84%] whitespace-pre-wrap rounded-xl border px-4 py-3 text-sm leading-relaxed',
                  message.role === 'user'
                    ? ''
                    : message.error
                      ? 'border-red-500/30 bg-red-500/10 text-red-100'
                      : '',
                )}
                  style={message.role === 'user'
                    ? { borderColor: theme.border, background: theme.surface2, color: theme.text }
                    : message.error
                      ? undefined
                      : { borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(2,3,8,0.70)', color: theme.text }}
                >
                  {message.content || (message.streaming ? 'Thinking...' : '')}
                  {message.streaming && <Loader2 className="mt-2 h-3.5 w-3.5 animate-spin" style={{ color: theme.accent }} />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t p-4" style={{ borderColor: theme.border, background: 'rgba(2,3,8,0.55)' }}>
          <div className="mx-auto flex max-w-4xl gap-2">
            <textarea
              value={prompt}
              onChange={event => setPrompt(event.target.value)}
              onKeyDown={event => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault()
                  void send()
                }
              }}
              placeholder={`Message ${engine.label}...`}
              className="min-h-24 flex-1 resize-none rounded-xl border p-3 text-sm outline-none placeholder:text-zinc-700"
              style={{
                borderColor: theme.border,
                background: 'rgba(2,3,8,0.78)',
                color: theme.text,
              }}
            />
            <div className="flex w-24 shrink-0 flex-col gap-2">
              <Button
                onClick={() => void send()}
                disabled={running || !prompt.trim() || Boolean(directBlockedReason)}
                style={{ background: theme.accent, color: theme.background }}
              >
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              <Button variant="outline" onClick={running ? stop : () => setPrompt(starterPrompt(engine))} style={{ borderColor: theme.border, color: theme.text }}>
                {running ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="outline" onClick={() => void copyPrompt()} style={{ borderColor: theme.border, color: theme.text }}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setMessages([])} style={{ borderColor: theme.border, color: theme.text }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mx-auto mt-2 max-w-4xl text-[11px]" style={{ color: theme.muted }}>
            Press Cmd/Ctrl+Enter to send. Direct tabs preserve local history per engine.
          </div>
        </div>
      </section>
    </div>
  )
}
