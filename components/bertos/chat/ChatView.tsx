'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Cpu, Zap, Globe, ArrowDown, Download, Check } from 'lucide-react'
import { useChatStore } from '@/store/bertos/chat'
import { useUIStore } from '@/store/bertos/ui'
import { useProjectStore } from '@/store/bertos/projects'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { RouterBadge } from './RouterBadge'
import { readAIStream } from '@/lib/bertos/stream-utils'
import type { AIModel, RouterDecision } from '@/lib/bertos/types'

const WELCOME_PROMPTS = [
  { icon: <Cpu className="w-4 h-4 text-cyan-300" />,    label: 'Explain async/await in TypeScript with examples' },
  { icon: <Sparkles className="w-4 h-4 text-amber-300" />, label: 'What is the best AI stack for a startup in 2025?' },
  { icon: <Globe className="w-4 h-4 text-cyan-400" />,   label: 'Research the latest breakthroughs in LLM architecture' },
  { icon: <Zap className="w-4 h-4 text-amber-400" />,    label: 'Build a React hook for debounced localStorage sync' },
  { icon: <Cpu className="w-4 h-4 text-cyan-300" />,     label: 'Write a compelling product roadmap for an AI startup' },
  { icon: <Globe className="w-4 h-4 text-cyan-400" />,   label: 'Compare REST vs GraphQL vs tRPC for a Next.js app' },
]

function SkeletonMessage() {
  return (
    <div className="flex gap-3 py-2">
      <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0 mt-0.5 animate-pulse" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 bg-cyan-500/15 rounded-full w-24 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-2.5 bg-cyan-500/10 rounded-full w-full animate-pulse" />
          <div className="h-2.5 bg-cyan-500/10 rounded-full w-4/5 animate-pulse" style={{ animationDelay: '0.1s' }} />
          <div className="h-2.5 bg-cyan-500/8 rounded-full w-3/5 animate-pulse" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    </div>
  )
}

export function ChatView() {
  const {
    sessions, activeSessionId, isStreaming,
    createSession, getOrCreateSession, addMessage, appendToMessage, updateMessage, patchMessageMetadata, deleteMessage,
    setStreaming, updateSessionTitle, getActiveSession, setActiveSession,
  } = useChatStore()
  const { selectedModel, settings, setActiveView, setSelectedModel } = useUIStore()
  const { getActiveProject } = useProjectStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<RouterDecision | null>(null)
  const [exportCopied, setExportCopied] = useState(false)

  const exportChat = useCallback(() => {
    const s = getActiveSession()
    if (!s?.messages.length) return
    const lines = [
      `# ${s.title} — ${new Date().toLocaleString()}`,
      '',
      ...s.messages.map(m => [
        `**${m.role === 'user' ? 'You' : `AI (${m.model ?? 'assistant'})`}**`,
        '',
        m.content,
        '',
      ].join('\n')),
    ]
    navigator.clipboard.writeText(lines.join('\n'))
    setExportCopied(true)
    setTimeout(() => setExportCopied(false), 2000)
  }, [getActiveSession])

  const session = getActiveSession()
  const messages = session?.messages ?? []

  // Bootstrap: if no active session, focus an existing one. Do NOT spawn an
  // empty session — the welcome screen handles the zero-state, and sendMessage
  // will create the session on first submit. This stops "ghost" empty sessions
  // from cluttering Recent Chats.
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      useChatStore.getState().setActiveSession(sessions[0].id)
    }
  }, [activeSessionId, sessions])

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  useEffect(() => { scrollToBottom(false) }, [session?.id, scrollToBottom])
  useEffect(() => { if (isStreaming) scrollToBottom() }, [messages.length, isStreaming, scrollToBottom])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 300)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const sendMessage = useCallback(async (content: string) => {
    // Handle slash commands
    const trimmed = content.trim()
    if (trimmed === '/compare' || trimmed.startsWith('/compare ') || trimmed === '/ask-all' || trimmed.startsWith('/ask-all ')) {
      const query = trimmed.replace(/^\/(compare|ask-all)\s*/, '').trim()
      if (query) localStorage.setItem('bertos-compare-prefill-v1', query)
      setActiveView('compare')
      return
    }
    if (trimmed === '/code' || trimmed.startsWith('/code ')) {
      setSelectedModel('codex-cli' as AIModel)
      const rest = trimmed.replace(/^\/code\s*/, '').trim()
      if (!rest) return
      content = rest
    } else if (trimmed === '/research' || trimmed.startsWith('/research ')) {
      setSelectedModel('gemini-cli' as AIModel)
      const rest = trimmed.replace(/^\/research\s*/, '').trim()
      if (!rest) return
      content = rest
    } else if (trimmed === '/summarize') {
      content = 'Summarize our conversation so far in a few bullet points.'
    } else if (trimmed.startsWith('/explain ')) {
      content = `Explain in detail: ${trimmed.slice(9).trim()}`
    }

    // Ensure an active session — reuse the empty active one if present so
    // pressing Enter never creates a "phantom" extra chat.
    const session = getOrCreateSession(selectedModel)
    const sessionId = session.id
    setActiveSession(sessionId)

    // Title from first prompt (always rewrite "New Chat")
    const currentSession = useChatStore.getState().sessions.find(s => s.id === sessionId)
    if (!currentSession || currentSession.title === 'New Chat') {
      const fallback = content.replace(/\s+/g, ' ').trim().slice(0, 60)
      updateSessionTitle(sessionId, fallback || 'New Chat')
    }
    addMessage(sessionId, { role: 'user', content })

    // Create the streaming placeholder
    const aiMsg = addMessage(sessionId, { role: 'assistant', content: '', model: selectedModel, streaming: true })
    setStreaming(true, aiMsg.id)
    abortRef.current = new AbortController()

    const project = getActiveProject()
    const systemFactsList: string[] = settings.memoryEnabled === false ? [] : (() => {
      try {
        const raw = localStorage.getItem('bertos-system-facts-v1')
        if (!raw) return []
        return (JSON.parse(raw) as Array<{ content: string }>).map(f => f.content).filter(Boolean)
      } catch { return [] }
    })()
    const systemPrompt = [
      'You are BertOS, an advanced AI assistant inside the BertOS AI operating system. Be precise, helpful, and thorough.',
      project?.context ? `Project context: ${project.context}` : '',
      systemFactsList.length > 0 ? `User-defined facts:\n${systemFactsList.map(f => `- ${f}`).join('\n')}` : '',
    ].filter(Boolean).join('\n\n')

    const allMessages = useChatStore.getState()
      .sessions.find(s => s.id === sessionId)
      ?.messages.filter(m => m.id !== aiMsg.id) ?? []

    const startTime = Date.now()
    let resolvedModel = selectedModel as string

    // Inner helper: stream a single model into the existing aiMsg bubble
    const doStream = async (modelId: string): Promise<RouterDecision | null> => {
      let res: Response
      try {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: allMessages,
            model: modelId,
            systemPrompt,
            clientKeys: settings.apiKeys,
            ollamaEndpoint: settings.ollamaEndpoint,
            enableApiProviders: settings.enableApiProviders ?? false,
            maxTokens: settings.tokenBudget ?? 4096,
          }),
          signal: abortRef.current?.signal,
        })
      } catch (fetchErr) {
        // True network failure before any response arrived
        const msg = (fetchErr as Error).name === 'AbortError'
          ? 'AbortError'
          : 'Network connection lost. Check your internet connection and try again.'
        throw Object.assign(new Error(msg), { name: (fetchErr as Error).name })
      }

      if (!res.ok) {
        let errorMsg = `Server error: HTTP ${res.status}`
        try {
          const errBody = await res.json() as { error?: string }
          if (errBody.error) errorMsg = errBody.error
        } catch { /* body not JSON */ }
        throw new Error(errorMsg)
      }

      let routerDecision: RouterDecision | null = null
      let hasFirstChunk = false
      let bufferedText = ''
      const liveStream = settings.streamingEnabled !== false

      const reader = res.body!.getReader()
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
            const parsed = JSON.parse(raw) as {
              text?: string
              tokens?: number
              routerDecision?: RouterDecision
              error?: string
              localCli?: { providerId: AIModel; executable: string; durationMs: number }
              localCliFallback?: { requestedProvider: AIModel; fallbackProvider: AIModel; reason: string }
            }

            if (parsed.routerDecision) {
              routerDecision = parsed.routerDecision
              if (selectedModel === 'auto') setPendingDecision(parsed.routerDecision)
            }

            if (parsed.error) throw new Error(parsed.error)
            if (parsed.localCli) {
              updateMessage(sessionId!, aiMsg.id, { model: parsed.localCli.providerId })
              patchMessageMetadata(sessionId!, aiMsg.id, {
                latency: parsed.localCli.durationMs,
                providerSource: 'daemon',
                modelOrTool: parsed.localCli.executable,
              })
            }
            if (parsed.localCliFallback) {
              appendToMessage(
                sessionId!,
                aiMsg.id,
                `> Local CLI bridge unavailable for ${parsed.localCliFallback.requestedProvider}. Falling back to ${parsed.localCliFallback.fallbackProvider}: ${parsed.localCliFallback.reason}\n\n`,
              )
              updateMessage(sessionId!, aiMsg.id, { model: parsed.localCliFallback.fallbackProvider })
              patchMessageMetadata(sessionId!, aiMsg.id, {
                providerSource: 'api',
                fallbackUsed: parsed.localCliFallback.fallbackProvider,
              })
            }

            if (typeof parsed.tokens === 'number') {
              patchMessageMetadata(sessionId!, aiMsg.id, { tokens: parsed.tokens })
            }

            if (parsed.text) {
              if (!hasFirstChunk) {
                hasFirstChunk = true
                setPendingDecision(null)
              }
              if (liveStream) {
                appendToMessage(sessionId!, aiMsg.id, parsed.text)
              } else {
                bufferedText += parsed.text
              }
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') throw parseErr
          }
        }
      }

      if (!liveStream && bufferedText) {
        appendToMessage(sessionId!, aiMsg.id, bufferedText)
      }

      return routerDecision
    }

    const isQuotaError = (err: Error) => {
      const m = err.message.toLowerCase()
      return m.includes('429') || m.includes('quota') || m.includes('billing') || m.includes('rate limit')
    }

    try {
      // For 'auto' mode, call the router first to get model + show badge
      // Skip routing if the user has disabled it in Performance settings
      if (selectedModel === 'auto' && settings.routingEnabled !== false) {
        try {
          const routerRes = await fetch('/api/router', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: content }),
            signal: abortRef.current.signal,
          })
          const decision: RouterDecision = await routerRes.json()
          resolvedModel = decision.primary
          setPendingDecision(decision)
          updateMessage(sessionId, aiMsg.id, { model: decision.primary as AIModel })
        } catch {
          resolvedModel = 'ollama-pro'
        }
      }

      const routerDecision = await doStream(resolvedModel)
      updateMessage(sessionId!, aiMsg.id, {
        streaming: false,
        routerDecision: routerDecision ?? undefined,
        model: (routerDecision?.primary ?? resolvedModel) as AIModel,
      })
      patchMessageMetadata(sessionId!, aiMsg.id, { latency: Date.now() - startTime })
    } catch (err) {
      setPendingDecision(null)
      if ((err as Error).name === 'AbortError') {
        // user cancelled — leave partial content, just stop streaming
        updateMessage(sessionId!, aiMsg.id, { streaming: false })
      } else if (isQuotaError(err as Error) && resolvedModel !== 'qwen2.5-coder') {
        // Waterfall: quota exceeded → retry with local Ollama fallback
        appendToMessage(sessionId!, aiMsg.id,
          `\n\n> ⚠️ **Quota exceeded for ${resolvedModel}.** Auto-routing to Qwen 2.5 Coder (local Ollama fallback)...\n\n`)
        updateMessage(sessionId!, aiMsg.id, { model: 'qwen2.5-coder' as AIModel, streaming: true })
        setStreaming(true, aiMsg.id)

        try {
          await doStream('qwen2.5-coder')
          updateMessage(sessionId!, aiMsg.id, { streaming: false })
          patchMessageMetadata(sessionId!, aiMsg.id, { latency: Date.now() - startTime })
        } catch (fallbackErr) {
          if ((fallbackErr as Error).name !== 'AbortError') {
            appendToMessage(sessionId!, aiMsg.id,
              `\n\n**Fallback error:** ${(fallbackErr as Error).message}`)
          }
          updateMessage(sessionId!, aiMsg.id, { streaming: false })
        }
      } else {
        updateMessage(sessionId!, aiMsg.id, {
          content: `**Error:** ${(err as Error).message}`,
          streaming: false,
        })
      }
    } finally {
      setStreaming(false)
      setPendingDecision(null)
    }
  }, [
    activeSessionId, selectedModel,
    settings.apiKeys, settings.memoryEnabled, settings.streamingEnabled,
    settings.routingEnabled, settings.tokenBudget, settings.ollamaEndpoint,
    settings.enableApiProviders,
    addMessage, appendToMessage, updateMessage, patchMessageMetadata, deleteMessage, setStreaming,
    createSession, getOrCreateSession, updateSessionTitle, getActiveProject, setActiveSession, setActiveView, setSelectedModel,
  ])

  const makeRetry = useCallback((failedMsgId: string) => () => {
    const s = getActiveSession()
    if (!s) return
    const idx = s.messages.findIndex(m => m.id === failedMsgId)
    const userMsg = idx > 0
      ? [...s.messages].slice(0, idx).reverse().find(m => m.role === 'user')
      : undefined
    if (!userMsg) return
    deleteMessage(s.id, failedMsgId)
    void sendMessage(userMsg.content)
  }, [getActiveSession, deleteMessage, sendMessage])

  // Edit a user message: delete everything from that message onward, resend with new content
  const makeEdit = useCallback((userMsgId: string) => (newContent: string) => {
    const s = getActiveSession()
    if (!s) return
    const idx = s.messages.findIndex(m => m.id === userMsgId)
    if (idx < 0) return
    // Delete the user message and all subsequent messages
    const toDelete = s.messages.slice(idx).map(m => m.id)
    for (const id of toDelete) deleteMessage(s.id, id)
    void sendMessage(newContent)
  }, [getActiveSession, deleteMessage, sendMessage])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
    setPendingDecision(null)
    const s = getActiveSession()
    if (s) {
      const last = s.messages[s.messages.length - 1]
      if (last?.streaming) updateMessage(s.id, last.id, { streaming: false })
    }
  }, [setStreaming, getActiveSession, updateMessage])

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto relative" ref={scrollRef}>
        {/* Export button */}
        {messages.length > 0 && (
          <button
            onClick={exportChat}
            className="absolute top-3 right-4 z-10 flex items-center gap-1.5 text-[10px] text-zinc-700 hover:text-zinc-400 transition-colors bg-zinc-950/80 backdrop-blur-sm border border-zinc-800/50 rounded-lg px-2 py-1"
            title="Copy conversation as markdown"
          >
            {exportCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Download className="w-3 h-3" />}
            {exportCopied ? 'Copied' : 'Export'}
          </button>
        )}
        <div className="max-w-3xl mx-auto px-4">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8"
            >
              {/* Hero */}
              <div className="space-y-4">
                <div className="relative inline-flex">
                  <motion.div
                    animate={{
                      boxShadow: [
                        '0 0 32px rgba(34,211,238,0.35), inset 0 0 24px rgba(217,119,6,0.15)',
                        '0 0 60px rgba(34,211,238,0.55), inset 0 0 32px rgba(217,119,6,0.25)',
                        '0 0 32px rgba(34,211,238,0.35), inset 0 0 24px rgba(217,119,6,0.15)',
                      ],
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 via-cyan-600 to-amber-600 flex items-center justify-center border-2 border-cyan-300/40"
                  >
                    <Sparkles className="w-10 h-10 text-white drop-shadow" />
                  </motion.div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-4 border-[#02050B] shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                </div>
                <div>
                  <p className="text-[10px] text-amber-300/80 uppercase tracking-[0.3em] mb-2 font-bold">Oracle awaiting query</p>
                  <h1 className="text-3xl font-black tracking-tight">
                    <span className="text-cyan-50">How can the </span>
                    <span className="text-hermes-gradient">Oracle</span>
                    <span className="text-cyan-50"> assist?</span>
                  </h1>
                  <p className="text-cyan-100/40 mt-2 text-sm max-w-sm mx-auto leading-relaxed">
                    Claude, Codex, and Gemini — channeled through one cockpit. Smart routing engages automatically.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {WELCOME_PROMPTS.map((p, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + i * 0.04 }}
                    onClick={() => sendMessage(p.label)}
                    className="flex items-center gap-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03] hover:bg-cyan-500/[0.08] hover:border-cyan-500/40 p-3 text-left transition-all duration-150 group hover:shadow-[0_0_16px_rgba(34,211,238,0.15)]"
                  >
                    <span className="flex-shrink-0">{p.icon}</span>
                    <span className="text-xs text-cyan-100/60 group-hover:text-cyan-100 transition-colors leading-snug">{p.label}</span>
                  </motion.button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-[11px] text-cyan-100/30">
                <div className="flex items-center gap-1.5"><kbd className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded text-[10px] font-mono">⌘K</kbd><span>Commands</span></div>
                <span className="text-cyan-500/30">·</span>
                <div className="flex items-center gap-1.5"><kbd className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 px-1 py-0.5 rounded text-[10px] font-mono">/</kbd><span>Slash menu</span></div>
                <span className="text-cyan-500/30">·</span>
                <div className="flex items-center gap-1.5"><kbd className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded text-[10px] font-mono">⌘?</kbd><span>Shortcuts</span></div>
              </div>
            </motion.div>
          ) : (
            <div className="py-6 space-y-1">
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <div key={msg.id}>
                    {msg.role === 'assistant' && msg.routerDecision && !msg.streaming && (
                      <RouterBadge decision={msg.routerDecision} />
                    )}
                    <div className="py-2">
                      <MessageBubble
                        message={msg}
                        isStreaming={isStreaming && !!msg.streaming}
                        onRetry={msg.role === 'assistant' && msg.content.startsWith('**Error:**') ? makeRetry(msg.id) : undefined}
                        onEdit={msg.role === 'user' && !isStreaming ? makeEdit(msg.id) : undefined}
                      />
                    </div>
                  </div>
                ))}
              </AnimatePresence>

              {/* Routing + skeleton while waiting for first token */}
              {pendingDecision && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <RouterBadge decision={pendingDecision} />
                  <SkeletonMessage />
                </motion.div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => scrollToBottom()}
              className="fixed bottom-28 right-72 z-10 w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 shadow-lg flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all"
            >
              <ArrowDown className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Extra bottom padding on mobile so the fixed bottom nav doesn't cover the input */}
      <div className="flex-shrink-0 mb-16 md:mb-0">
        <InputBar onSubmit={sendMessage} onStop={handleStop} isStreaming={isStreaming} />
      </div>
    </div>
  )
}
