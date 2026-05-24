'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Bot, Clipboard, Copy, Loader2, Play, RotateCcw, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/bertos/cn'
import { getModelColor, getModelLabel } from '@/lib/bertos/router'
import type { AgentEngine } from '@/lib/bertos/agent-engines'
import { useUIStore } from '@/store/bertos/ui'
import type { Message } from '@/lib/bertos/types'

interface ProviderStatusEntry {
  id: string
  name: string
  status: string
  message?: string
}

interface ProviderStatusResponse {
  providers?: ProviderStatusEntry[]
  apiProviders?: {
    enabled?: boolean
    openai?: boolean
    geminiNative?: boolean
    hermesNous?: boolean
  }
  hermes?: {
    paidEnabled?: boolean
    statusMessage?: string
  }
}

interface EngineMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  error?: boolean
}

function storageKey(engineId: string) {
  return `bertos-agent-engine-chat-${engineId}-v1`
}

function starterPrompt(engine: AgentEngine) {
  if (engine.id === 'bertos') return 'Use the best BertOS agent lane for this task and explain which engines you would involve.'
  if (engine.id === 'codex') return 'Inspect this coding task, propose a focused implementation plan, and list validation commands.'
  if (engine.id === 'claude') return 'Review this UI or architecture idea and identify the cleanest implementation path.'
  if (engine.id === 'gemini') return 'Plan this large task, identify missing context, and break it into safe phases.'
  if (engine.id === 'ollama') return 'Summarize this into a concise action plan and memory handoff.'
  if (engine.id === 'hermes') return 'If paid Hermes is enabled, reason through this task carefully; otherwise explain what setup is missing.'
  return `Talk to ${engine.label} about this task.`
}

function statusTone(status?: string) {
  if (status === 'online') return 'success'
  if (status === 'configured' || status === 'enabled') return 'warning'
  return 'default'
}

export function AgentEngineChatView({ engine }: { engine: AgentEngine }) {
  const { settings } = useUIStore()
  const [prompt, setPrompt] = useState(starterPrompt(engine))
  const [messages, setMessages] = useState<EngineMessage[]>([])
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<ProviderStatusResponse | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const provider = status?.providers?.find(item => item.id === engine.providerStatusId)
  const apiEnabled = Boolean(settings.enableApiProviders || status?.apiProviders?.enabled)
  const hermesPaidEnabled = Boolean(status?.hermes?.paidEnabled)
  const directBlockedReason = useMemo(() => {
    if (engine.requiresApiProviders && !apiEnabled) return 'API providers are disabled in Settings.'
    if (engine.paidGated && !hermesPaidEnabled) return 'Paid Hermes gate is disabled.'
    return ''
  }, [apiEnabled, engine.paidGated, engine.requiresApiProviders, hermesPaidEnabled])

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
    fetch('/api/providers/status', { cache: 'no-store' })
      .then(res => res.json())
      .then((data: ProviderStatusResponse) => setStatus(data))
      .catch(() => setStatus(null))
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

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: conversation,
          model: engine.model,
          systemPrompt,
          clientKeys: settings.apiKeys,
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
    <div className="flex h-full min-h-0 bg-[#070503]">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-[rgba(212,180,131,0.14)] px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg border"
                  style={{ borderColor: `${getModelColor(engine.model)}55`, background: `${getModelColor(engine.model)}18` }}
                >
                  {engine.id === 'bertos' ? <Sparkles className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-[#F0EAD8]">{engine.label}</h1>
                  <p className="text-xs text-[#8D7652]">{engine.role}</p>
                </div>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">{engine.bestUse}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusTone(provider?.status)} className="text-[10px]">{provider?.status ?? 'checking'}</Badge>
              <Badge variant={engine.paidGated ? 'warning' : 'default'} className="text-[10px]">{getModelLabel(engine.model)}</Badge>
            </div>
          </div>
          {(engine.warning || directBlockedReason || provider?.message) && (
            <div className={cn(
              'mt-3 rounded-lg border p-3 text-xs leading-relaxed',
              directBlockedReason ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-zinc-800 bg-black/20 text-zinc-500',
            )}>
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
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/45 p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-200">
                  <Clipboard className="h-4 w-4 text-[#D4B483]" />
                  Direct engine chat
                </div>
                <p className="text-sm leading-relaxed text-zinc-500">
                  This tab talks directly to {engine.label}. Use BertOS when you want automatic routing across engines; use this tab when you want one specific agent’s perspective.
                </p>
              </div>
            ) : messages.map(message => (
              <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[84%] whitespace-pre-wrap rounded-xl border px-4 py-3 text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'border-[#D4B483]/30 bg-[#D4B483]/10 text-[#F0EAD8]'
                    : message.error
                      ? 'border-red-500/30 bg-red-500/10 text-red-100'
                      : 'border-zinc-800 bg-zinc-950/70 text-zinc-300',
                )}>
                  {message.content || (message.streaming ? 'Thinking...' : '')}
                  {message.streaming && <Loader2 className="mt-2 h-3.5 w-3.5 animate-spin text-zinc-500" />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-[rgba(212,180,131,0.14)] p-4">
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
              className="min-h-24 flex-1 resize-none rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-[#D4B483]/50"
            />
            <div className="flex w-24 shrink-0 flex-col gap-2">
              <Button onClick={() => void send()} disabled={running || !prompt.trim() || Boolean(directBlockedReason)}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              <Button variant="outline" onClick={running ? stop : () => setPrompt(starterPrompt(engine))}>
                {running ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <Button variant="outline" onClick={() => void copyPrompt()}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setMessages([])}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mx-auto mt-2 max-w-4xl text-[11px] text-zinc-600">
            Press Cmd/Ctrl+Enter to send. Direct tabs preserve local history per engine.
          </div>
        </div>
      </section>
    </div>
  )
}
