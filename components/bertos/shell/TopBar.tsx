'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import {
  Zap, Cpu, Globe, Sparkles, ChevronDown, PanelRight, PanelRightClose,
  Command, Bot, Menu, Lock, Beaker,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useAutomationsStore } from '@/store/bertos/automations'
import type { AIModel } from '@/lib/bertos/types'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { StatusOrb } from '@/components/bertos/hermes'

type ModelGate = 'enabled' | 'paid' | 'experimental' | 'planned'

type ModelOption = {
  value: AIModel
  label: string
  description: string
  icon: React.ReactNode
  color: string
  gate: ModelGate
  gateReason?: string
}

const BASE_SUBSCRIPTION_MODELS: ModelOption[] = [
  { value: 'auto',                    label: 'Auto Oracle', description: 'Smart routing · Subscription only',          icon: <Sparkles className="w-3.5 h-3.5" />, color: '#22d3ee', gate: 'enabled' },
  { value: 'team' as AIModel,         label: 'Team Mode',   description: 'Gemini plan → Claude review → Codex build',  icon: <Sparkles className="w-3.5 h-3.5" />, color: '#a855f7', gate: 'enabled' },
  { value: 'ollama-pro',              label: 'Ollama Pro',  description: 'Ollama · default · Cloud or local',           icon: <Bot className="w-3.5 h-3.5" />,      color: '#f59e0b', gate: 'enabled' },
  { value: 'claude-code',             label: 'Claude Code', description: 'Anthropic · Claude Code CLI',                 icon: <Cpu className="w-3.5 h-3.5" />,      color: '#8b5cf6', gate: 'enabled' },
  { value: 'gemini-cli',              label: 'Gemini CLI',  description: 'Google · Gemini CLI',                         icon: <Globe className="w-3.5 h-3.5" />,    color: '#3b82f6', gate: 'enabled' },
  { value: 'codex-cli',               label: 'Codex CLI',   description: 'OpenAI · Codex CLI',                          icon: <Zap className="w-3.5 h-3.5" />,      color: '#10b981', gate: 'enabled' },
]

const PAID_API_MODELS: ModelOption[] = [
  { value: 'claude-api' as AIModel,   label: 'Anthropic API', description: 'Metered · separate billing',  icon: <Cpu className="w-3.5 h-3.5" />,  color: '#8b5cf6', gate: 'paid', gateReason: 'Requires API key in Settings → API Keys (separate billing)' },
  { value: 'openai-api' as AIModel,   label: 'OpenAI API',    description: 'Metered · separate billing',  icon: <Zap className="w-3.5 h-3.5" />,  color: '#10b981', gate: 'paid', gateReason: 'Requires API key in Settings → API Keys (separate billing)' },
  { value: 'gemini-api' as AIModel,   label: 'Gemini API',    description: 'Metered · separate billing',  icon: <Globe className="w-3.5 h-3.5" />,color: '#3b82f6', gate: 'paid', gateReason: 'Requires API key in Settings → API Keys (separate billing)' },
]

const LOCAL_MODELS: ModelOption[] = [
  { value: 'qwen2.5-coder',  label: 'Qwen 2.5 Coder', description: 'Alibaba · Local Ollama fallback',  icon: <Bot className="w-3.5 h-3.5" />, color: '#f97316', gate: 'enabled' },
  { value: 'llama3',         label: 'Llama 3',         description: 'Meta · Local Ollama',              icon: <Bot className="w-3.5 h-3.5" />, color: '#f97316', gate: 'enabled' },
  { value: 'llama3.2',       label: 'Llama 3.2',       description: 'Meta · Local Ollama',              icon: <Bot className="w-3.5 h-3.5" />, color: '#f97316', gate: 'enabled' },
  { value: 'mistral',        label: 'Mistral',          description: 'Mistral AI · Local Ollama',        icon: <Bot className="w-3.5 h-3.5" />, color: '#ec4899', gate: 'enabled' },
  { value: 'deepseek-coder', label: 'DeepSeek Coder',  description: 'DeepSeek · Local Ollama',          icon: <Bot className="w-3.5 h-3.5" />, color: '#06b6d4', gate: 'enabled' },
  { value: 'hermes3',        label: 'Hermes 3',         description: 'NousResearch · Local Ollama',      icon: <Bot className="w-3.5 h-3.5" />, color: '#a855f7', gate: 'enabled' },
]

const EXPERIMENTAL_MODELS: ModelOption[] = [
  { value: 'fcc' as unknown as AIModel,         label: 'FCC',           description: 'Experimental fast-channel comms', icon: <Beaker className="w-3.5 h-3.5" />, color: '#84cc16', gate: 'experimental', gateReason: 'FCC remains experimental — not wired up yet' },
  { value: 'anti-gravity' as unknown as AIModel,label: 'Anti-Gravity',  description: 'Planned · advanced runtime',      icon: <Beaker className="w-3.5 h-3.5" />, color: '#a855f7', gate: 'planned',      gateReason: 'Planned — not implemented yet' },
  { value: 'nous-hermes' as unknown as AIModel, label: 'Nous Hermes',   description: 'Paid · remote Hermes runtime',    icon: <Cpu className="w-3.5 h-3.5" />,    color: '#06b6d4', gate: 'paid',         gateReason: 'Requires HERMES_API_KEY in .env.local — paid-gated' },
]

export function TopBar({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
  const { selectedModel, setSelectedModel, activeView, rightPanelOpen, setRightPanelOpen, setCommandPaletteOpen } = useUIStore()
  const { isStreaming } = useChatStore()
  const { runs } = useAutomationsStore()
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [subscriptionModels, setSubscriptionModels] = useState<ModelOption[]>(BASE_SUBSCRIPTION_MODELS)
  const [daemonOnline, setDaemonOnline] = useState<boolean | null>(null)
  const [mounted, setMounted] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // System health poll
  useEffect(() => {
    let cancelled = false
    const ping = async () => {
      try {
        const res = await fetch('/api/local-daemon/status', { cache: 'no-store' })
        if (cancelled) return
        if (!res.ok) { setDaemonOnline(false); return }
        const d = await res.json() as { online?: boolean }
        setDaemonOnline(Boolean(d.online))
      } catch { if (!cancelled) setDaemonOnline(false) }
    }
    ping()
    const id = setInterval(ping, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const activeAutopilotRuns = runs.filter(r => r.status === 'running').length
  const pendingApprovals    = runs.filter(r => r.status === 'needs-approval').length

  // Deployment mode
  useEffect(() => {
    fetch('/api/bertos/mode')
      .then(r => r.json())
      .then((data: { mode: string; provider: string; defaultModel: string }) => {
        const modeLabel = data.mode === 'cloud' ? 'Cloud' : 'Local'
        setSubscriptionModels(prev =>
          prev.map(m =>
            m.value === 'ollama-pro'
              ? { ...m, description: `Ollama · ${data.defaultModel} · ${modeLabel}` }
              : m
          )
        )
      })
      .catch(() => { /* keep defaults */ })
  }, [])

  // Compute menu position via fixed positioning so AppShell's overflow-hidden cannot clip it.
  useLayoutEffect(() => {
    if (!modelMenuOpen || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
  }, [modelMenuOpen])

  useEffect(() => {
    if (!modelMenuOpen) return
    const onScroll = () => {
      if (!triggerRef.current) return
      const r = triggerRef.current.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [modelMenuOpen])

  const allModelOptions: ModelOption[] = [...subscriptionModels, ...PAID_API_MODELS, ...LOCAL_MODELS, ...EXPERIMENTAL_MODELS]
  const activeModel = allModelOptions.find(m => m.value === selectedModel) ?? subscriptionModels[0]

  const viewLabels: Record<string, string> = {
    chat: 'Oracle Chat',
    compare: 'Pantheon',
    workspace: 'Coding Workspace',
    coding: 'Forge',
    evolution: 'Evolution Lab',
    agents: 'Agent Legion',
    autopilot: 'Autopilot',
    memory: 'Temple of Memory',
    settings: 'Edicts & Settings',
    dashboard: 'Mission Control',
    github: 'GitHub',
  }

  const renderModelSection = (title: string, models: ModelOption[]) => (
    <>
      <p className="px-2.5 py-1 text-[9px] font-bold text-amber-300/70 uppercase tracking-[0.2em] flex items-center gap-1.5">
        <span className="inline-block w-1 h-1 bg-amber-500 rotate-45" />
        {title}
      </p>
      {models.map(option => {
        const disabled = option.gate !== 'enabled'
        return (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (disabled) return
                  setSelectedModel(option.value)
                  setModelMenuOpen(false)
                }}
                disabled={disabled}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all duration-100',
                  disabled
                    ? 'opacity-40 cursor-not-allowed text-zinc-500'
                    : selectedModel === option.value
                      ? 'bg-cyan-500/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]'
                      : 'text-cyan-100/70 hover:bg-cyan-500/[0.06] hover:text-cyan-50'
                )}
              >
                <span style={{ color: disabled ? '#71717a' : option.color }}>{option.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium truncate">{option.label}</p>
                    {option.gate === 'paid' && <Lock className="w-2.5 h-2.5 text-amber-500/80 flex-shrink-0" />}
                    {option.gate === 'experimental' && <Beaker className="w-2.5 h-2.5 text-amber-500/80 flex-shrink-0" />}
                    {option.gate === 'planned' && <span className="text-[8px] uppercase tracking-wider text-zinc-600">soon</span>}
                  </div>
                  <p className="text-[10px] text-cyan-100/40 truncate">{option.description}</p>
                </div>
                {selectedModel === option.value && !disabled && (
                  <StatusOrb state="active" size="xs" />
                )}
              </button>
            </TooltipTrigger>
            {disabled && option.gateReason && (
              <TooltipContent side="left">{option.gateReason}</TooltipContent>
            )}
          </Tooltip>
        )
      })}
    </>
  )

  return (
    <div className="relative flex items-center gap-3 px-4 h-12 border-b border-cyan-500/15 bg-[#05080F]/85 backdrop-blur-xl flex-shrink-0 z-20">
      {/* Bronze bottom edge */}
      <div className="absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-600/30 to-transparent pointer-events-none" />

      {/* Hamburger — mobile only */}
      <button
        onClick={onMobileMenuToggle}
        className="md:hidden flex-shrink-0 p-1.5 rounded-lg text-cyan-100/60 hover:text-cyan-200 hover:bg-cyan-500/[0.06] transition-all"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* View title */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-sm font-bold tracking-tight text-cyan-100 truncate">
          {viewLabels[activeView] ?? 'BertOS'}
        </span>
        <AnimatePresence>
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 flex-shrink-0"
            >
              <div className="flex gap-0.5">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ scaleY: [1, 2.5, 1] }}
                    transition={{ duration: 0.6, delay: i * 0.12, repeat: Infinity }}
                    className="w-0.5 h-2.5 rounded-full bg-cyan-400 origin-bottom shadow-[0_0_4px_rgba(34,211,238,0.8)]"
                  />
                ))}
              </div>
              <span className="text-[10px] text-cyan-300 uppercase tracking-wider font-semibold">Stream</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Command palette hint */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all text-cyan-200/70 hover:text-cyan-200"
          >
            <Command className="w-3 h-3" />
            <span className="text-[10px] font-mono">⌘K</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Command Palette</TooltipContent>
      </Tooltip>

      {/* Model selector — fixed-position dropdown to escape parent overflow-hidden */}
      <div className="relative">
        <button
          ref={triggerRef}
          onClick={() => setModelMenuOpen(o => !o)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-150 text-sm',
            modelMenuOpen
              ? 'border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_14px_rgba(34,211,238,0.25)]'
              : 'border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/40 hover:bg-cyan-500/10'
          )}
        >
          <span style={{ color: activeModel.color }} className="flex-shrink-0">{activeModel.icon}</span>
          <span className="text-cyan-100 font-medium text-xs truncate max-w-[120px]">{activeModel.label}</span>
          <ChevronDown className={cn('w-3 h-3 text-cyan-300 transition-transform duration-150 flex-shrink-0', modelMenuOpen && 'rotate-180')} />
        </button>
      </div>

      {/* Portal-rendered menu */}
      {mounted && createPortal(
        <AnimatePresence>
          {modelMenuOpen && menuPos && (
            <>
              {/* Click-outside backdrop */}
              <div className="fixed inset-0 z-[80]" onClick={() => setModelMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.14 }}
                className="fixed z-[90] w-72 rounded-2xl border border-cyan-500/30 bg-[#05080F]/97 backdrop-blur-2xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.8),0_0_30px_rgba(34,211,238,0.15)] overflow-hidden"
                style={{ top: menuPos.top, right: menuPos.right }}
              >
                <div className="hermes-grid-fine absolute inset-0 opacity-30 pointer-events-none" />
                <div className="relative max-h-[70vh] overflow-y-auto">
                  <div className="p-2 space-y-0.5">
                    {renderModelSection('Model Pantheon', subscriptionModels)}
                    <div className="my-1 hermes-divider" />
                    {renderModelSection('Local Ollama', LOCAL_MODELS)}
                    <div className="my-1 hermes-divider" />
                    {renderModelSection('Paid API · Metered', PAID_API_MODELS)}
                    <div className="my-1 hermes-divider" />
                    {renderModelSection('Experimental / Planned', EXPERIMENTAL_MODELS)}
                  </div>
                  <div className="px-3 py-2 border-t border-cyan-500/15 bg-cyan-500/[0.03]">
                    <p className="text-[9px] text-cyan-100/40 leading-relaxed">
                      <Lock className="w-2.5 h-2.5 inline mr-1" />
                      Paid APIs disabled by default. Enable in Settings → API Keys (separate billing).
                    </p>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* System health pill */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors',
            daemonOnline === null
              ? 'bg-zinc-900/40 border-zinc-700/40'
              : daemonOnline
                ? 'bg-emerald-500/5 border-emerald-500/25'
                : 'bg-amber-500/5 border-amber-500/30'
          )}>
            <StatusOrb
              state={daemonOnline === null ? 'loading' : daemonOnline ? 'nominal' : 'warning'}
              size="xs"
            />
            <span className={cn(
              'text-[10px] font-mono uppercase tracking-wider',
              daemonOnline === null ? 'text-zinc-400' : daemonOnline ? 'text-emerald-300' : 'text-amber-300'
            )}>
              {daemonOnline === null ? '...' : daemonOnline ? 'NOMINAL' : 'DAEMON OFF'}
            </span>
            {(activeAutopilotRuns > 0 || pendingApprovals > 0) && (
              <span className="ml-0.5 inline-flex items-center gap-0.5 text-[10px] text-cyan-300 font-mono">
                <Sparkles className="w-2.5 h-2.5" />
                {activeAutopilotRuns + pendingApprovals}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {daemonOnline === null ? 'Checking system health...' : daemonOnline
            ? `Systems nominal${activeAutopilotRuns > 0 ? ` · ${activeAutopilotRuns} autopilot running` : ''}${pendingApprovals > 0 ? ` · ${pendingApprovals} need approval` : ''}`
            : 'Local daemon offline — run: npm run bertos:daemon'}
        </TooltipContent>
      </Tooltip>

      {/* Right panel toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className={cn(
              'p-1.5 rounded-lg border transition-all duration-150',
              rightPanelOpen
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                : 'border-cyan-500/15 bg-cyan-500/[0.03] text-cyan-100/40 hover:text-cyan-200 hover:border-cyan-500/30'
            )}
          >
            {rightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{rightPanelOpen ? 'Hide Panel' : 'Show Panel'}</TooltipContent>
      </Tooltip>
    </div>
  )
}
