'use client'
import { useEffect, useRef, useState } from 'react'
import { Bot, CircleSlash, FileText, GitBranch, ListTodo, Plug, Send, Sparkles, Wand2, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChamberCard } from '@/components/bertos/hermes'
import { Markdown } from './Markdown'
import { getJson, postJson } from './types'

interface ProviderStatus { providerId: string; providerName: string; online: boolean; modelOrTool: string; error?: string }
interface AssistantResult {
  reply: string; intent: string; llmUsed: boolean; providerName?: string; degraded: boolean; degradedReason?: string
  outputId?: string; agentRunId?: string; createdTaskIds: string[]; memoryProposalIds: string[]; groundedIn: string[]
  suggestedActions?: string[]
}
export interface ChatMsg { role: 'user' | 'assistant'; content: string; result?: AssistantResult }

const QUICK = [
  { label: 'Explain this repo like I’m joining the project', icon: Sparkles },
  { label: 'What should I work on next?', icon: Zap },
  { label: 'Review my current diff', icon: GitBranch },
  { label: 'Find risks in this project', icon: FileText },
  { label: 'Make a plan for a feature', icon: Wand2 },
  { label: 'Summarize today’s progress', icon: ListTodo },
]

export function AICommandCenter({ projectId, projectName, onActivity, threadId: threadIdProp, initialMessages, onThreadChange, heightClass }: {
  projectId?: string
  projectName?: string
  onActivity?: () => void
  threadId?: string
  initialMessages?: ChatMsg[]
  onThreadChange?: (threadId: string) => void
  heightClass?: string
}) {
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [anyOnline, setAnyOnline] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages ?? [])
  const [threadId, setThreadId] = useState<string | undefined>(threadIdProp)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMessages(initialMessages ?? []); setThreadId(threadIdProp) }, [threadIdProp, initialMessages])
  useEffect(() => {
    void getJson<{ providers: ProviderStatus[]; anyOnline: boolean }>('/api/bertos/coding/assistant').then(d => {
      setProviders(d.providers ?? [])
      setAnyOnline(Boolean(d.anyOnline))
    })
  }, [])
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy])

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || busy) return
    setMessages(prev => [...prev, { role: 'user', content: message }])
    setInput('')
    setBusy(true)
    const data = await postJson<{ ok: boolean; result?: AssistantResult; threadId?: string; error?: string }>('/api/bertos/coding/assistant', { message, projectId, threadId })
    setBusy(false)
    if (data.ok && data.result) {
      setMessages(prev => [...prev, { role: 'assistant', content: data.result!.reply, result: data.result }])
      if (data.threadId && data.threadId !== threadId) { setThreadId(data.threadId); onThreadChange?.(data.threadId) }
      onActivity?.()
    } else {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${data.error ?? 'Assistant failed.'}` }])
    }
  }

  const testProvider = async () => {
    setTesting(true)
    setTestResult(null)
    const data = await postJson<{ result?: any }>('/api/bertos/coding/provider-test', {})
    setTesting(false)
    const r = data.result
    if (r?.ok) setTestResult(`✓ ${r.providerName} responded in ${r.latencyMs}ms: "${r.replyPreview}"`)
    else setTestResult(`✗ ${r?.reason ?? 'No provider.'}${r?.setupHint ? ` — ${r.setupHint}` : ''}`)
    void getJson<{ providers: ProviderStatus[]; anyOnline: boolean }>('/api/bertos/coding/assistant').then(d => { setProviders(d.providers ?? []); setAnyOnline(Boolean(d.anyOnline)) })
  }

  const onlineProvider = providers.find(p => p.online)
  const lastResult = [...messages].reverse().find(m => m.role === 'assistant' && m.result)?.result
  const suggestions = !busy && lastResult?.suggestedActions?.length ? lastResult.suggestedActions : (messages.length === 0 ? [] : [])

  return (
    <ChamberCard
      tone="cyan"
      eyebrow="ai command center"
      title="AI Command Center"
      description={projectName ? `Project-aware AI for ${projectName}. Grounded in your files, git, validation, tasks & decisions.` : 'Project-aware AI assistant.'}
      action={
        anyOnline === null ? null : (
          <div className="flex items-center gap-1.5">
            {anyOnline
              ? <Badge variant="success"><Bot className="mr-1 inline h-3 w-3" />{onlineProvider?.providerName ?? 'provider online'}</Badge>
              : <Badge variant="warning"><CircleSlash className="mr-1 inline h-3 w-3" />local mode</Badge>}
            <Button size="sm" variant="ghost" disabled={testing} onClick={testProvider} title="Send a tiny test prompt"><Plug className="h-3.5 w-3.5" />{testing ? '…' : 'Test'}</Button>
          </div>
        )
      }
    >
      {testResult && (
        <div className={`mb-3 rounded-lg border p-2.5 text-xs ${testResult.startsWith('✓') ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-200' : 'border-amber-500/25 bg-amber-500/5 text-amber-200'}`}>{testResult}</div>
      )}
      {anyOnline === false && !testResult && (
        <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5 text-xs text-amber-200">
          No AI provider online — answering in <strong>local deterministic mode</strong> (grounded, no LLM). Start Ollama or a CLI/API provider, then press <strong>Test</strong>. Setup: <a className="underline" href="/onboarding">guided setup</a>.
        </div>
      )}

      <div ref={scrollRef} className={`mb-3 ${heightClass ?? 'max-h-[440px]'} min-h-[140px] space-y-3 overflow-y-auto rounded-lg border border-zinc-800 bg-black/20 p-3`}>
        {messages.length === 0 ? (
          <div className="py-8 text-center">
            <Bot className="mx-auto mb-2 h-8 w-8 text-cyan-300/60" />
            <p className="text-sm text-zinc-300">Ask anything about {projectName ? <span className="text-zinc-100">{projectName}</span> : 'your project'}.</p>
            <p className="mt-1 text-xs text-zinc-600">Every prompt creates a run + output, and (when useful) tasks & memory proposals — all local.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              <div className={msg.role === 'user'
                ? 'max-w-[85%] rounded-2xl rounded-br-sm border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-50'
                : 'w-full rounded-2xl rounded-bl-sm border border-zinc-800 bg-[#0c0a08] px-3 py-2.5'}>
                {msg.role === 'user' ? msg.content : <Markdown>{msg.content}</Markdown>}
                {msg.result && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-zinc-800 pt-2 text-[10px]">
                    <Badge variant="default">{msg.result.intent}</Badge>
                    <Badge variant={msg.result.llmUsed ? 'success' : 'warning'}>{msg.result.llmUsed ? `LLM · ${msg.result.providerName}` : 'local · no LLM'}</Badge>
                    {msg.result.groundedIn?.length > 0 && <span className="text-zinc-600">grounded: {msg.result.groundedIn.slice(0, 3).join(', ')}</span>}
                    {msg.result.outputId && <a href="/outputs" className="text-cyan-400 hover:underline">output ✓</a>}
                    {msg.result.agentRunId && <a href="/runs" className="text-cyan-400 hover:underline">run ✓</a>}
                    {msg.result.createdTaskIds.length > 0 && <span className="text-zinc-500">+{msg.result.createdTaskIds.length} task(s)</span>}
                    {msg.result.memoryProposalIds.length > 0 && <a href="/memory-review" className="text-violet-300 hover:underline">+{msg.result.memoryProposalIds.length} memory</a>}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {busy && <div className="flex items-center gap-2 text-xs text-cyan-300/70"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" /> thinking… (grounding + creating run + output)</div>}
      </div>

      {(suggestions.length > 0 || messages.length === 0) && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(messages.length === 0 ? QUICK.map(q => q.label) : suggestions).map(label => (
            <button key={label} disabled={busy} onClick={() => send(label)} className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-black/20 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-cyan-500/30 hover:text-cyan-200">
              {messages.length === 0 && <Sparkles className="h-3 w-3" />}{label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-black/30 px-3">
        <Bot className="h-4 w-4 shrink-0 text-cyan-300/70" />
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input) } }}
          placeholder={projectId ? 'Ask the AI about this project…' : 'Activate a project, then ask…'}
          className="h-10 flex-1 bg-transparent text-sm text-zinc-100 outline-none"
        />
        <Button size="sm" disabled={busy || !input.trim()} onClick={() => send(input)}><Send className="h-3.5 w-3.5" /></Button>
      </div>
    </ChamberCard>
  )
}
