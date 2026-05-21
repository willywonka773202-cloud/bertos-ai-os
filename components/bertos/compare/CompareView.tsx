'use client'
import React, { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  GitCompare, Send, Cpu, Globe, Zap, Copy, Check, Loader2,
  RotateCcw, Bot, Scale, Code2, MessageSquare, Star,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { usePromptStore } from '@/store/bertos/prompts'
import { toast } from 'sonner'

type ModelId = 'ollama-pro' | 'claude-code' | 'gemini-cli' | 'gemini-api-native' | 'codex-cli'
type CouncilMode = 'compare' | 'judge' | 'build'

const ALL_MODELS: ModelId[] = ['ollama-pro', 'claude-code', 'gemini-cli', 'gemini-api-native', 'codex-cli']

const MODEL_META: Record<string, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  'ollama-pro':  { label: 'Ollama',  icon: <Bot   className="w-4 h-4" />, color: '#F97316', desc: 'Local/Cloud · Always-on' },
  'claude-code': { label: 'Claude',  icon: <Cpu   className="w-4 h-4" />, color: '#8B5CF6', desc: 'CLI · Subscription' },
  'gemini-cli':  { label: 'Gemini',  icon: <Globe className="w-4 h-4" />, color: '#3B82F6', desc: 'CLI · Subscription' },
  'codex-cli':   { label: 'Codex',   icon: <Zap   className="w-4 h-4" />, color: '#10B981', desc: 'CLI · Subscription' },
}

MODEL_META['gemini-api-native'] = {
  label: 'Gemini Native',
  icon: <Globe className="w-4 h-4" />,
  color: '#3B82F6',
  desc: 'API - Structured',
}

const COUNCIL_MODES: { id: CouncilMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'compare', label: 'Compare Only',    icon: <GitCompare className="w-3.5 h-3.5" />, desc: 'Side-by-side responses, no synthesis' },
  { id: 'judge',   label: 'Council Judge',   icon: <Scale      className="w-3.5 h-3.5" />, desc: 'Synthesizes best answer + conflicts' },
  { id: 'build',   label: 'Build Decision',  icon: <Code2      className="w-3.5 h-3.5" />, desc: 'Implementation plan, risks, test steps' },
]

const EXAMPLE_PROMPTS: Record<CouncilMode, string[]> = {
  compare: [
    'What is the best approach to state management in React?',
    'Explain recursion with a real-world example',
  ],
  judge: [
    'Should I use PostgreSQL or MongoDB for a social feed with 100M users?',
    'What is the safest way to handle auth tokens in a Next.js app?',
  ],
  build: [
    'How should I add real-time collaboration to a Next.js app?',
    'Design a safe file patch system for an AI coding tool',
  ],
}

interface ModelResponse {
  model: ModelId
  content: string
  streaming: boolean
  done: boolean
  latency?: number
  error?: string
}

interface JudgeResult {
  content: string
  providerUsed: ModelId
  latencyMs: number
  streaming?: boolean
  error?: string
}

function buildJudgePrompt(originalQuery: string, responses: ModelResponse[]): string {
  const responseBlock = responses
    .filter(r => r.content && !r.error)
    .map(r => `### ${MODEL_META[r.model].label}:\n${r.content}`)
    .join('\n\n---\n\n')
  return [
    `Original question: ${originalQuery}`,
    '',
    'Multiple AI models answered this question:',
    '',
    responseBlock,
    '',
    '---',
    'Synthesize these responses with:',
    '**Best points from each model**',
    '**Conflicts or disagreements**',
    '**Final recommended answer**',
    '**Confidence:** high / medium / low',
    '**Next action**',
  ].join('\n')
}

function buildDecisionPrompt(originalQuery: string, responses: ModelResponse[]): string {
  const responseBlock = responses
    .filter(r => r.content && !r.error)
    .map(r => `### ${MODEL_META[r.model].label}:\n${r.content}`)
    .join('\n\n---\n\n')
  return [
    `Build/implementation question: ${originalQuery}`,
    '',
    'Multiple AI models responded:',
    '',
    responseBlock,
    '',
    '---',
    'You are a technical planning judge. Return:',
    '**Safest implementation plan** — concrete steps',
    '**Likely files affected** — specific paths if known',
    '**Risks** — what could go wrong',
    '**Test plan** — how to verify it works',
    '**Recommended provider** — best model for implementation',
  ].join('\n')
}

function StreamingBars({ color }: { color: string }) {
  return (
    <div className="flex gap-0.5">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ scaleY: [1, 2.5, 1] }}
          transition={{ duration: 0.55, delay: i * 0.12, repeat: Infinity }}
          className="w-0.5 h-2.5 rounded-full origin-bottom"
          style={{ background: color }}
        />
      ))}
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children }) {
          const isBlock = className?.includes('language-')
          if (isBlock) return (
            <pre className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 overflow-x-auto text-xs my-2">
              <code>{children}</code>
            </pre>
          )
          return <code className="bg-zinc-800 text-violet-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
        },
        pre({ children }) { return <>{children}</> },
        p({ children }) { return <p className="mb-2 last:mb-0">{children}</p> },
        ul({ children }) { return <ul className="mb-2 pl-4 space-y-0.5 list-disc marker:text-zinc-600">{children}</ul> },
        ol({ children }) { return <ol className="mb-2 pl-4 space-y-0.5 list-decimal marker:text-zinc-600">{children}</ol> },
        li({ children }) { return <li className="text-zinc-400">{children}</li> },
        strong({ children }) { return <strong className="text-zinc-200 font-semibold">{children}</strong> },
        h2({ children }) { return <h2 className="text-sm font-bold text-zinc-100 mb-1.5 mt-3 first:mt-0">{children}</h2> },
        h3({ children }) { return <h3 className="text-xs font-semibold text-zinc-200 mb-1 mt-2">{children}</h3> },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export function CompareView() {
  const router = useRouter()
  const { settings, selectedModel, setPendingWorkspaceTask, setActiveView } = useUIStore()
  const { createSession, addMessage } = useChatStore()
  const { createPrompt } = usePromptStore()

  const [query, setQuery] = useState('')
  const [councilMode, setCouncilMode] = useState<CouncilMode>('compare')
  const [selectedModels, setSelectedModels] = useState<Set<ModelId>>(new Set(['ollama-pro']))
  const [judgeModel, setJudgeModel] = useState<ModelId>('ollama-pro')
  const [responses, setResponses] = useState<ModelResponse[]>([])
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [isJudging, setIsJudging] = useState(false)
  const [copiedModel, setCopiedModel] = useState<ModelId | null>(null)
  const [judgeExpanded, setJudgeExpanded] = useState(true)
  const abortRefs = useRef<Map<ModelId, AbortController>>(new Map())

  const toggleModel = (model: ModelId) => {
    setSelectedModels(prev => {
      const next = new Set(prev)
      if (next.has(model) && next.size <= 1) return prev
      if (next.has(model)) next.delete(model)
      else next.add(model)
      return next
    })
  }

  const patchResponse = useCallback((model: ModelId, patch: Partial<ModelResponse>) => {
    setResponses(prev => prev.map(r => r.model === model ? { ...r, ...patch } : r))
  }, [])

  const streamChat = async (
    prompt: string,
    model: ModelId | string,
    systemPrompt: string,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<{ content: string; latencyMs: number }> => {
    const start = Date.now()
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: '1', role: 'user', content: prompt, timestamp: Date.now() }],
        model,
        systemPrompt,
        clientKeys: settings.apiKeys,
        ollamaEndpoint: settings.ollamaEndpoint,
        enableApiProviders: settings.enableApiProviders,
      }),
      signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let content = ''

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
          if (parsed.text) { content += parsed.text; onChunk(parsed.text) }
        } catch { /* skip malformed chunks */ }
      }
    }
    return { content, latencyMs: Date.now() - start }
  }

  const runJudge = useCallback(async (prompt: string, completedResponses: ModelResponse[], mode: CouncilMode) => {
    setIsJudging(true)
    setJudgeResult({ content: '', providerUsed: judgeModel, latencyMs: 0, streaming: true })
    const start = Date.now()
    try {
      const synthesisPrompt = mode === 'build'
        ? buildDecisionPrompt(prompt, completedResponses)
        : buildJudgePrompt(prompt, completedResponses)
      const systemPrompt = mode === 'build'
        ? 'You are a technical planning judge. Return a structured build decision.'
        : 'You are an AI council judge. Synthesize the responses with clear sections.'

      if (judgeModel === 'gemini-api-native') {
        const res = await fetch('/api/providers/gemini-native', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'council-judge',
            prompt: synthesisPrompt,
            systemInstruction: systemPrompt,
          }),
        })
        const data = await res.json() as {
          ok: boolean
          json?: {
            finalAnswer?: string
            confidence?: string
            recommendedNextAction?: string
            bestPoints?: Array<{ model: string; point: string }>
            conflicts?: string[]
          }
          error?: string
          latencyMs?: number
        }
        if (!res.ok || !data.ok) throw new Error(data.error || 'Gemini Native judge failed.')
        const json = data.json
        const content = [
          json?.finalAnswer ?? '',
          '',
          json?.bestPoints?.length ? `Best points:\n${json.bestPoints.map(item => `- ${item.model}: ${item.point}`).join('\n')}` : '',
          json?.conflicts?.length ? `\nConflicts:\n${json.conflicts.map(item => `- ${item}`).join('\n')}` : '',
          json?.confidence ? `\nConfidence: ${json.confidence}` : '',
          json?.recommendedNextAction ? `\nNext action: ${json.recommendedNextAction}` : '',
        ].filter(Boolean).join('\n')
        setJudgeResult({ content, providerUsed: judgeModel, latencyMs: data.latencyMs ?? Date.now() - start, streaming: false })
        return
      }

      const { content, latencyMs } = await streamChat(
        synthesisPrompt,
        judgeModel,
        systemPrompt,
        chunk => {
          setJudgeResult(prev => prev
            ? { ...prev, content: prev.content + chunk, latencyMs: Date.now() - start }
            : { content: chunk, providerUsed: judgeModel, latencyMs: Date.now() - start, streaming: true }
          )
        },
      )
      setJudgeResult({ content, providerUsed: judgeModel, latencyMs, streaming: false })
    } catch (error) {
      setJudgeResult({
        content: '',
        providerUsed: judgeModel,
        latencyMs: Date.now() - start,
        streaming: false,
        error: error instanceof Error ? error.message : 'Judge synthesis failed.',
      })
    } finally {
      setIsJudging(false)
    }
  }, [judgeModel, settings, streamChat])

  const runCouncil = useCallback(async (prompt: string) => {
    if (!prompt.trim() || isRunning || selectedModels.size === 0) return
    setIsRunning(true)
    setJudgeResult(null)

    abortRefs.current.forEach(c => c.abort())
    abortRefs.current.clear()

    const models = Array.from(selectedModels)
    setResponses(models.map(m => ({ model: m, content: '', streaming: true, done: false })))

    const systemPrompt = councilMode === 'build'
      ? 'You are an expert software architect. Be precise and structured.'
      : 'You are a helpful AI assistant. Be concise but complete.'

    const completed: ModelResponse[] = []

    await Promise.allSettled(
      models.map(async model => {
        const ctrl = new AbortController()
        abortRefs.current.set(model, ctrl)
        try {
          const { content, latencyMs } = await streamChat(
            prompt,
            model,
            systemPrompt,
            chunk => setResponses(prev => prev.map(r => r.model === model ? { ...r, content: r.content + chunk } : r)),
            ctrl.signal,
          )
          patchResponse(model, { streaming: false, done: true, latency: latencyMs })
          completed.push({ model, content, streaming: false, done: true, latency: latencyMs })
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Request failed'
          const errMsg = (msg.includes('not configured') || msg.includes('API key'))
            ? 'Provider not configured — check Settings.'
            : msg
          patchResponse(model, { streaming: false, done: true, error: errMsg })
          completed.push({ model, content: '', streaming: false, done: true, error: errMsg })
        }
      })
    )

    setIsRunning(false)

    if (councilMode !== 'compare' && completed.some(r => r.content && !r.error)) {
      await runJudge(prompt, completed, councilMode)
    }
  }, [isRunning, selectedModels, councilMode, patchResponse, runJudge, streamChat])

  const copyResponse = (model: ModelId) => {
    const r = responses.find(r => r.model === model)
    if (!r?.content) return
    void navigator.clipboard.writeText(r.content)
    setCopiedModel(model)
    setTimeout(() => setCopiedModel(null), 2000)
  }

  const copyJudge = () => {
    if (!judgeResult?.content) return
    void navigator.clipboard.writeText(judgeResult.content)
    toast.success('Council result copied.')
  }

  const sendToChat = () => {
    const content = judgeResult?.content || responses.find(r => r.content && !r.error)?.content
    if (!content) return toast.error('Run the council first.')
    const session = createSession(selectedModel)
    addMessage(session.id, { role: 'user', content: query })
    addMessage(session.id, { role: 'assistant', content })
    setActiveView('chat')
    router.push('/chat')
    toast.success('Sent to Chat.')
  }

  const sendToWorkspace = () => {
    if (!query.trim()) return toast.error('Enter a prompt first.')
    const task = judgeResult?.content
      ? `${query}\n\n---\nCouncil synthesis:\n${judgeResult.content}`.slice(0, 4000)
      : query
    setPendingWorkspaceTask(task)
    setActiveView('workspace')
    router.push('/workspace')
    toast.success('Opening Workspace...')
  }

  const saveAsPrompt = () => {
    if (!query.trim()) return toast.error('Enter a prompt first.')
    createPrompt({
      title: query.slice(0, 60) || 'Council Prompt',
      category: 'agents',
      content: query,
      description: 'Saved from Council Mode',
      variables: [],
      tags: ['council', 'compare'],
      favorite: false,
    })
    toast.success('Saved to Prompt Library.')
  }

  const reset = () => {
    abortRefs.current.forEach(c => c.abort())
    setResponses([])
    setJudgeResult(null)
    setQuery('')
  }

  const hasResponses = responses.length > 0
  const allDone = hasResponses && responses.every(r => r.done)
  const canAct = allDone && !isJudging

  return (
    <div className="flex flex-col h-full bg-[#09090B]">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-zinc-800/50 bg-zinc-950/60 px-5 py-4 space-y-3">
        <div className="max-w-5xl mx-auto space-y-3">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <GitCompare className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Model Council</h2>
              <p className="text-[11px] text-zinc-500">Ask multiple models simultaneously, then synthesize</p>
            </div>
            {hasResponses && !isRunning && (
              <button onClick={reset} className="ml-auto flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Mode tabs */}
          <div className="flex flex-wrap gap-1">
            {COUNCIL_MODES.map(mode => (
              <button
                key={mode.id}
                onClick={() => setCouncilMode(mode.id)}
                title={mode.desc}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all',
                  councilMode === mode.id
                    ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                    : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                )}
              >
                {mode.icon}
                {mode.label}
              </button>
            ))}
          </div>

          {/* Model + judge selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-zinc-600">Models:</span>
            {ALL_MODELS.map(model => {
              const meta = MODEL_META[model]
              const active = selectedModels.has(model)
              return (
                <button
                  key={model}
                  onClick={() => toggleModel(model)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-all',
                    active ? 'border-current' : 'border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700'
                  )}
                  style={active ? { color: meta.color, borderColor: `${meta.color}60`, background: `${meta.color}10` } : undefined}
                >
                  {meta.icon}
                  {meta.label}
                </button>
              )
            })}
            <button
              onClick={() => setSelectedModels(new Set(['ollama-pro']))}
              className="rounded-full border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-600 hover:text-zinc-400 hover:border-zinc-700 transition-all"
            >
              Local only
            </button>
            <button
              onClick={() => setSelectedModels(new Set(ALL_MODELS))}
              className="rounded-full border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-600 hover:text-zinc-400 hover:border-zinc-700 transition-all"
            >
              All
            </button>
            {councilMode !== 'compare' && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[11px] text-zinc-600">Judge:</span>
                <select
                  value={judgeModel}
                  onChange={e => setJudgeModel(e.target.value as ModelId)}
                  className="h-7 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-[11px] text-zinc-300 outline-none"
                >
                  {ALL_MODELS.map(m => <option key={m} value={m}>{MODEL_META[m].label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Prompt + send */}
          <div className="flex gap-2">
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void runCouncil(query) }}
              placeholder={councilMode === 'build'
                ? 'Describe a build or implementation decision for the council... (Ctrl+Enter)'
                : 'Ask all selected models the same question... (Ctrl+Enter)'}
              rows={2}
              className="flex-1 resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-all"
            />
            <Button
              onClick={() => void runCouncil(query)}
              disabled={!query.trim() || isRunning || isJudging || selectedModels.size === 0}
              className="flex-shrink-0 self-end"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isRunning ? 'Running…' : 'Run Council'}
            </Button>
          </div>

          {/* Example prompts */}
          {!hasResponses && (
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS[councilMode].map(p => (
                <button
                  key={p}
                  onClick={() => { setQuery(p); void runCouncil(p) }}
                  className="text-[11px] px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all"
                >
                  {p.length > 55 ? p.slice(0, 55) + '…' : p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasResponses ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-16">
            <div className="flex items-center gap-3">
              {ALL_MODELS.map(m => (
                <div
                  key={m}
                  className={cn(
                    'w-10 h-10 rounded-xl border flex items-center justify-center transition-all',
                    selectedModels.has(m) ? '' : 'border-zinc-800 opacity-25'
                  )}
                  style={selectedModels.has(m) ? { color: MODEL_META[m].color, borderColor: `${MODEL_META[m].color}40`, background: `${MODEL_META[m].color}10` } : undefined}
                >
                  {MODEL_META[m].icon}
                </div>
              ))}
            </div>
            <p className="text-zinc-600 text-sm">Select models and enter a question to run the council</p>
            <p className="text-zinc-700 text-xs">Ctrl+Enter to send</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto px-5 py-4 space-y-4">
            {/* Response grid */}
            <div className={cn(
              'grid gap-3',
              responses.length === 1 ? 'grid-cols-1' :
              responses.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
              responses.length >= 3 ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' :
              'grid-cols-1'
            )}>
              {responses.map(response => {
                const meta = MODEL_META[response.model]
                return (
                  <div
                    key={response.model}
                    className="rounded-xl border overflow-hidden"
                    style={{ borderColor: `${meta.color}20` }}
                  >
                    <div
                      className="flex items-center justify-between px-3 py-2 border-b"
                      style={{ borderColor: `${meta.color}15`, background: `${meta.color}08` }}
                    >
                      <div className="flex items-center gap-2">
                        <span style={{ color: meta.color }}>{meta.icon}</span>
                        <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                        <span className="text-[10px] text-zinc-600 hidden sm:inline">{meta.desc}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {response.done && response.latency && (
                          <span className="text-[10px] text-zinc-700">{(response.latency / 1000).toFixed(1)}s</span>
                        )}
                        {response.streaming && <StreamingBars color={meta.color} />}
                        {response.done && !response.error && (
                          <button onClick={() => copyResponse(response.model)} className="p-1 rounded hover:bg-white/5 transition-colors">
                            {copiedModel === response.model
                              ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                              : <Copy className="w-3.5 h-3.5 text-zinc-600" />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="p-3 text-sm text-zinc-300 leading-relaxed max-h-72 overflow-y-auto">
                      {response.error ? (
                        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 text-xs text-red-400">
                          {response.error}
                        </div>
                      ) : response.content ? (
                        <MarkdownContent content={response.content} />
                      ) : response.streaming ? (
                        <div className="flex items-center gap-2 text-zinc-600 text-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Connecting…
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Judge result */}
            {councilMode !== 'compare' && (isJudging || judgeResult) && (
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-violet-500/15 px-3 py-2">
                  <Scale className="w-4 h-4 text-violet-400" />
                  <span className="text-xs font-semibold text-violet-300">
                    {councilMode === 'build' ? 'Build Decision' : 'Council Synthesis'}
                  </span>
                  <span className="text-[10px] text-zinc-600 ml-1">via {MODEL_META[judgeModel].label}</span>
                  {judgeResult?.latencyMs && !isJudging && (
                    <span className="text-[10px] text-zinc-700">{(judgeResult.latencyMs / 1000).toFixed(1)}s</span>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    {(isJudging || judgeResult?.streaming) && <StreamingBars color="#8B5CF6" />}
                    {judgeResult?.content && !isJudging && (
                      <>
                        <button onClick={copyJudge} className="p-1 rounded hover:bg-white/5 transition-colors">
                          <Copy className="w-3.5 h-3.5 text-zinc-600" />
                        </button>
                        <button
                          onClick={() => setJudgeExpanded(x => !x)}
                          className="p-1 rounded hover:bg-white/5 transition-colors"
                        >
                          {judgeExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
                            : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {judgeExpanded && (
                  <div className="p-3 text-sm text-zinc-300 leading-relaxed max-h-96 overflow-y-auto">
                    {judgeResult?.error ? (
                      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 text-xs text-red-400">
                        {judgeResult.error}
                      </div>
                    ) : (
                      <>
                        {judgeResult?.content && <MarkdownContent content={judgeResult.content} />}
                        {(isJudging || judgeResult?.streaming) && !judgeResult?.content && (
                          <div className="flex items-center gap-2 text-zinc-600 text-xs">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Synthesizing…
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action bar */}
            {canAct && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/50">
                <Button size="sm" variant="outline" onClick={sendToChat}>
                  <MessageSquare className="w-3.5 h-3.5" />Send to Chat
                </Button>
                <Button size="sm" variant="outline" onClick={sendToWorkspace}>
                  <Code2 className="w-3.5 h-3.5" />Send to Workspace
                </Button>
                <Button size="sm" variant="ghost" onClick={saveAsPrompt}>
                  <Star className="w-3.5 h-3.5" />Save as Prompt
                </Button>
                <Button size="sm" variant="ghost" onClick={reset} className="ml-auto text-zinc-600">
                  <RotateCcw className="w-3.5 h-3.5" />Clear
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
