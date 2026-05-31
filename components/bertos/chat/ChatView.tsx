'use client'
import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Cpu, Zap, Globe, ArrowDown, Code2 } from 'lucide-react'
import { useChatStore } from '@/store/bertos/chat'
import { useUIStore } from '@/store/bertos/ui'
import { useRouter } from 'next/navigation'
import { useProjectStore } from '@/store/bertos/projects'
import { MessageBubble } from './MessageBubble'
import { InputBar } from './InputBar'
import { RouterBadge } from './RouterBadge'
import { readAIStream } from '@/lib/bertos/stream-utils'
import type { AIModel, RouterDecision } from '@/lib/bertos/types'
import { HologramPanel, ProviderBadge, RomanDivider, StatusOrb } from '@/components/bertos/hermes'
import { fetchLocalDaemonBridge } from '@/lib/bertos/browser-daemon'
import { isLocalCliProvider } from '@/lib/bertos/provider-status-client'
import { scopedClientKeysForModel } from '@/lib/bertos/client-provider-keys'
import { buildBertOSCliChatPrompt, compactAssistantText } from '@/lib/bertos/cli-output'
import type { LocalDaemonAskResult } from '@/lib/bertos/local-daemon'

const WELCOME_PROMPTS = [
  { icon: <Cpu className="w-4 h-4 text-violet-400" />, label: 'Explain async/await in TypeScript with examples' },
  { icon: <Sparkles className="w-4 h-4 text-amber-400" />, label: 'What is the best AI stack for a startup in 2025?' },
  { icon: <Globe className="w-4 h-4 text-blue-400" />, label: 'Research the latest breakthroughs in LLM architecture' },
  { icon: <Zap className="w-4 h-4 text-emerald-400" />, label: 'Build a React hook for debounced localStorage sync' },
  { icon: <Cpu className="w-4 h-4 text-violet-400" />, label: 'Write a compelling product roadmap for an AI startup' },
  { icon: <Globe className="w-4 h-4 text-blue-400" />, label: 'Compare REST vs GraphQL vs tRPC for a Next.js app' },
]

const CREATOR_SKILL_COMMAND_RE = /^\/(youtube-researcher|second-brain|diagram|paper-canvas|motion-graphics|gen-media|brand-deal-manager|publishing-queue)\b/i

function SkeletonMessage() {
  return (
    <div className="flex gap-3 py-2">
      <div className="w-7 h-7 rounded-lg bg-zinc-800 flex-shrink-0 mt-0.5 animate-pulse" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3 bg-zinc-800 rounded-full w-20 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-2.5 bg-zinc-800/70 rounded-full w-full animate-pulse" />
          <div className="h-2.5 bg-zinc-800/60 rounded-full w-4/5 animate-pulse" style={{ animationDelay: '0.1s' }} />
          <div className="h-2.5 bg-zinc-800/40 rounded-full w-3/5 animate-pulse" style={{ animationDelay: '0.2s' }} />
        </div>
      </div>
    </div>
  )
}

export function ChatView() {
  const {
    sessions, activeSessionId, isStreaming,
    getOrCreateSession, deleteEmptySessions, addMessage, appendToMessage, updateMessage,
    setStreaming, updateSessionTitle, getActiveSession, setActiveSession,
  } = useChatStore()
  const { selectedModel, settings, setActiveView } = useUIStore()
  const { getActiveProject } = useProjectStore()
  const router = useRouter()
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<RouterDecision | null>(null)

  const session = getActiveSession()
  const messages = session?.messages ?? []

  // Bootstrap existing history and cleanup empty sessions only once on mount
  useEffect(() => {
    deleteEmptySessions()
    if (!activeSessionId && sessions.length > 0) {
      const firstRealSession = sessions.find(s => s.messages.some(message => message.role === 'user')) ?? sessions[0]
      if (firstRealSession) {
        useChatStore.getState().setActiveSession(firstRealSession.id)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- intentionally once

  // Global Oracle bridge: auto-submit if a draft was sent from another route
  const sendMessageRef = useRef<((content: string) => Promise<void>) | null>(null)
  useEffect(() => {
    try {
      const draft = window.localStorage.getItem('bertos-chat-draft')
      if (draft) {
        window.localStorage.removeItem('bertos-chat-draft')
        // Defer to next tick so sendMessage ref is stable
        setTimeout(() => { if (sendMessageRef.current) void sendMessageRef.current(draft) }, 80)
      }
    } catch { /* ignore */ }
  }, []) // intentionally once on mount

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
    // For follow-up messages: use the already-active session if it has messages.
    // Only call getOrCreateSession when there is no active session or it is empty.
    const currentActive = getActiveSession()
    const targetSession =
      currentActive && currentActive.messages.length > 0
        ? currentActive
        : getOrCreateSession(selectedModel)
    const sessionId = targetSession.id
    setActiveSession(sessionId)

    addMessage(sessionId, { role: 'user', content })
    const hasPriorUserMessage = targetSession.messages.some(message => message.role === 'user')
    if (!hasPriorUserMessage || targetSession.title === 'New Chat') {
      updateSessionTitle(sessionId, content.length > 60 ? content.slice(0, 60) + '...' : content)
    }

    // Create the streaming placeholder
    const aiMsg = addMessage(sessionId, { role: 'assistant', content: '', model: selectedModel, streaming: true })
    setStreaming(true, aiMsg.id)
    abortRef.current = new AbortController()

    const project = getActiveProject()
    const systemPrompt = [
      'You are BertOS, an advanced AI assistant inside the BertOS AI operating system. Be precise, helpful, and thorough.',
      project?.context ? `Project context: ${project.context}` : '',
    ].filter(Boolean).join('\n\n')

    const allMessages = useChatStore.getState()
      .sessions.find(s => s.id === sessionId)
      ?.messages.filter(m => m.id !== aiMsg.id) ?? []

    const startTime = Date.now()
    let resolvedModel = selectedModel as string

    if (CREATOR_SKILL_COMMAND_RE.test(content)) {
      try {
        const res = await fetch('/api/bertos/invoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: content,
            project: project?.id ?? project?.name,
            dryRun: true,
          }),
          signal: abortRef.current?.signal,
        })
        const data = await res.json()
        if (!res.ok || !data.ok) throw new Error(data.error ?? `Skill invocation failed with HTTP ${res.status}.`)
        const outputId = data.output?.outputId ?? data.output?.artifactId ?? 'unknown-output'
        const gates = Array.isArray(data.permissionGates) ? data.permissionGates : []
        const warnings = Array.isArray(data.setupWarnings) ? data.setupWarnings : []
        updateMessage(sessionId, aiMsg.id, {
          content: [
            `**Skill run saved:** ${data.skill.name}`,
            '',
            `- Run: \`${data.agentRun.agentRunId}\``,
            `- Output: \`${outputId}\``,
            `- Status: \`${data.agentRun.status}\``,
            warnings.length ? `- Setup: ${warnings.join(' ')}` : '- Setup: local-ready or no setup required.',
            gates.length ? `- Permission gates: ${gates.length} checked. Risky actions were not executed.` : '- Permission gates: none triggered.',
            '',
            'Open **Outputs**, **Runs**, or **Memory Review** from the sidebar to inspect the saved records.',
          ].join('\n'),
          streaming: false,
          model: selectedModel,
          metadata: { latency: Date.now() - startTime, providerSource: 'router', modelOrTool: 'bertos-skill-runtime' },
        })
      } catch (err) {
        updateMessage(sessionId, aiMsg.id, {
          content: `**Skill invocation error:** ${(err as Error).message}`,
          streaming: false,
          model: selectedModel,
          metadata: { latency: Date.now() - startTime },
        })
      } finally {
        setStreaming(false)
        setPendingDecision(null)
      }
      return
    }

    // Inner helper: stream a single model into the existing aiMsg bubble
    const doStream = async (modelId: string): Promise<RouterDecision | null> => {
      if (isLocalCliProvider(modelId)) {
        const transcript = allMessages
          .map(message => `${message.role.toUpperCase()}: ${message.content}`)
          .join('\n\n')
        const cliPrompt = buildBertOSCliChatPrompt(systemPrompt, transcript)

        const res = await fetchLocalDaemonBridge('/api/local-daemon/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId: modelId,
            prompt: cliPrompt,
            timeoutMs: 180000,
          }),
          signal: abortRef.current?.signal,
        })
        const result = await res.json() as LocalDaemonAskResult
        if (!res.ok || !result.ok) {
          const detail = [result.stdout?.trim(), result.stderr?.trim(), result.error].filter(Boolean).join('\n\n')
          throw new Error(detail || `Local CLI bridge returned HTTP ${res.status}.`)
        }
        const stdout = compactAssistantText(result.stdout)
        appendToMessage(sessionId!, aiMsg.id, stdout || 'Local CLI completed without a visible response.')
        updateMessage(sessionId!, aiMsg.id, {
          model: modelId as AIModel,
          metadata: {
            latency: result.durationMs,
            providerSource: 'daemon',
            modelOrTool: result.executable,
          },
        })
        return null
      }

      let res: Response
      try {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: allMessages,
            model: modelId,
            systemPrompt,
            clientKeys: scopedClientKeysForModel(modelId, settings.apiKeys),
            ollamaEndpoint: settings.ollamaEndpoint,
            enableApiProviders: settings.enableApiProviders ?? false,
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
              updateMessage(sessionId!, aiMsg.id, {
                model: parsed.localCli.providerId,
                metadata: {
                  latency: parsed.localCli.durationMs,
                  providerSource: 'daemon',
                  modelOrTool: parsed.localCli.executable,
                },
              })
            }
            if (parsed.localCliFallback) {
              appendToMessage(
                sessionId!,
                aiMsg.id,
                `> Local CLI bridge unavailable for ${parsed.localCliFallback.requestedProvider}. Falling back to ${parsed.localCliFallback.fallbackProvider}: ${parsed.localCliFallback.reason}\n\n`,
              )
              updateMessage(sessionId!, aiMsg.id, {
                model: parsed.localCliFallback.fallbackProvider,
                metadata: {
                  providerSource: 'api',
                  fallbackUsed: parsed.localCliFallback.fallbackProvider,
                },
              })
            }

            if (parsed.text) {
              if (!hasFirstChunk) {
                hasFirstChunk = true
                setPendingDecision(null)
              }
              appendToMessage(sessionId!, aiMsg.id, parsed.text)
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') throw parseErr
          }
        }
      }

      return routerDecision
    }

    const isQuotaError = (err: Error) => {
      const m = err.message.toLowerCase()
      return m.includes('429') || m.includes('quota') || m.includes('billing') || m.includes('rate limit')
    }

    try {
      // For 'auto' mode, call the router first to get model + show badge
      if (selectedModel === 'auto') {
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
        metadata: { latency: Date.now() - startTime },
      })
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
          updateMessage(sessionId!, aiMsg.id, {
            streaming: false,
            metadata: { latency: Date.now() - startTime },
          })
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
    selectedModel, settings.apiKeys,
    addMessage, appendToMessage, updateMessage, setStreaming,
    getOrCreateSession, updateSessionTitle, getActiveProject, setActiveSession,
  ])

  // Keep ref current so the mount effect can call sendMessage safely
  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

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
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto relative" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-4">
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8"
            >
              <HologramPanel tone="cyan" className="w-full max-w-2xl text-left">
                <div className="flex flex-col items-center gap-4 text-center">
                  <StatusOrb state="active" size="xl" />
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-200/70">Legion query console</div>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight">
                      <span className="text-zinc-100">What shall the </span>
                      <span className="text-hermes-gradient">Oracle</span>
                      <span className="text-zinc-100"> route?</span>
                    </h1>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
                      BertOS routes Claude, Codex, Gemini, Ollama, and local tools through one guarded command channel.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <ProviderBadge model={selectedModel} />
                    <ProviderBadge model="codex-cli" label="Forge ready" />
                    <ProviderBadge model="hermes3" label="Hermes local" />
                  </div>
                </div>
              </HologramPanel>

              <div className="hidden space-y-4">
                <div className="relative inline-flex">
                  <motion.div
                    animate={{ boxShadow: ['0 0 40px rgba(139,92,246,0.3)', '0 0 70px rgba(139,92,246,0.5)', '0 0 40px rgba(139,92,246,0.3)'] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center"
                  >
                    <Sparkles className="w-8 h-8 text-white" />
                  </motion.div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-4 border-[#0A0A0B]" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    <span className="text-zinc-100">How can </span>
                    <span className="bg-gradient-to-r from-violet-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">BertOS</span>
                    <span className="text-zinc-100"> help?</span>
                  </h1>
                  <p className="text-zinc-500 mt-2 text-sm max-w-sm mx-auto leading-relaxed">
                    Claude, Codex, and Gemini — unified. The right AI for every task, automatically.
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
                    className="flex items-center gap-2.5 rounded-xl border border-cyan-300/15 bg-slate-950/60 p-3 text-left transition-all duration-150 group hover:border-cyan-300/35 hover:bg-cyan-300/8"
                  >
                    <span className="flex-shrink-0">{p.icon}</span>
                    <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors leading-snug">{p.label}</span>
                  </motion.button>
                ))}
              </div>

              <RomanDivider label="keyboard rites" className="w-full max-w-lg" />
              <div className="flex items-center gap-3 text-[11px] text-zinc-600">
                <div className="flex items-center gap-1.5"><kbd className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px]">⌘K</kbd><span>Commands</span></div>
                <span className="text-zinc-800">·</span>
                <div className="flex items-center gap-1.5"><kbd className="bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[10px]">/</kbd><span>Slash menu</span></div>
                <span className="text-zinc-800">·</span>
                <div className="flex items-center gap-1.5"><kbd className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px]">⌘?</kbd><span>Shortcuts</span></div>
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
                      <MessageBubble message={msg} isStreaming={isStreaming && !!msg.streaming} />
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

      {/* Chat-to-coding bridge — appears when there's at least one user message */}
      {messages.some(m => m.role === 'user') && (
        <div className="flex-shrink-0 flex justify-end px-4 pb-1 max-w-3xl mx-auto w-full">
          <button
            onClick={() => {
              const lastUser = [...messages].reverse().find(m => m.role === 'user')
              if (lastUser?.content) {
                try { window.localStorage.setItem('bertos-coding-draft', lastUser.content) } catch { /* ignore */ }
              }
              setActiveView('coding')
              router.push('/coding')
            }}
            className="flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/8 px-3 py-1.5 text-[11px] text-violet-300/70 transition hover:border-violet-500/50 hover:text-violet-200"
          >
            <Code2 className="h-3 w-3" />
            Send to /coding
          </button>
        </div>
      )}

      {/* Extra bottom padding on mobile so the fixed bottom nav doesn't cover the input */}
      <div className="flex-shrink-0 mb-16 md:mb-0">
        <InputBar onSubmit={sendMessage} onStop={handleStop} isStreaming={isStreaming} />
      </div>
    </div>
  )
}
