'use client'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Beaker, Bot, ChevronDown, Command, Cpu, Globe, Lock, Menu, PanelRight, PanelRightClose, Server, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useAutomationStore } from '@/store/bertos/automations'
import { useDaemonHealth } from '@/hooks/useDaemonHealth'
import type { AIModel } from '@/lib/bertos/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ProviderStatusIndicator } from './ProviderStatusIndicator'
import { ProviderBadge, RomanDivider, StatusOrb } from '@/components/bertos/hermes'

type ModelOption = {
  value: AIModel | string
  label: string
  description: string
  icon: ReactNode
  color: string
  section: 'subscription' | 'local' | 'paid' | 'experimental'
  disabled?: boolean
  disabledReason?: string
}

const MODEL_OPTIONS: ModelOption[] = [
  { value: 'auto', label: 'Auto', description: 'Oracle routing across safe configured providers', icon: <Sparkles className="h-3.5 w-3.5" />, color: '#22D3EE', section: 'subscription' },
  { value: 'ollama-pro', label: 'Ollama Pro', description: 'Always-on local/cloud fallback, no separate API bill', icon: <Bot className="h-3.5 w-3.5" />, color: '#F97316', section: 'subscription' },
  { value: 'claude-code', label: 'Claude Code', description: 'CLI subscription for review and refactors', icon: <Cpu className="h-3.5 w-3.5" />, color: '#A78BFA', section: 'subscription' },
  { value: 'gemini-cli', label: 'Gemini CLI', description: 'CLI subscription for planning and research', icon: <Globe className="h-3.5 w-3.5" />, color: '#60A5FA', section: 'subscription' },
  { value: 'codex-cli', label: 'Codex CLI', description: 'CLI subscription for implementation work', icon: <Zap className="h-3.5 w-3.5" />, color: '#34D399', section: 'subscription' },
  { value: 'qwen2.5-coder', label: 'Qwen 2.5 Coder', description: 'Local Ollama coding fallback', icon: <Bot className="h-3.5 w-3.5" />, color: '#FB923C', section: 'local' },
  { value: 'llama3', label: 'Llama 3', description: 'Local Ollama general model', icon: <Bot className="h-3.5 w-3.5" />, color: '#FB923C', section: 'local' },
  { value: 'llama3.2', label: 'Llama 3.2', description: 'Local Ollama general model', icon: <Bot className="h-3.5 w-3.5" />, color: '#FB923C', section: 'local' },
  { value: 'mistral', label: 'Mistral', description: 'Local Ollama concise reasoning', icon: <Bot className="h-3.5 w-3.5" />, color: '#F472B6', section: 'local' },
  { value: 'deepseek-coder', label: 'DeepSeek Coder', description: 'Local Ollama coding model', icon: <Bot className="h-3.5 w-3.5" />, color: '#22D3EE', section: 'local' },
  { value: 'hermes3', label: 'Hermes 3', description: 'NousResearch local Ollama model', icon: <Bot className="h-3.5 w-3.5" />, color: '#F6C453', section: 'local' },
  { value: 'claude-api', label: 'Anthropic API', description: 'Paid metered API, disabled unless configured', icon: <Lock className="h-3.5 w-3.5" />, color: '#A78BFA', section: 'paid', disabled: true, disabledReason: 'Requires an Anthropic API key in Settings and separate paid billing.' },
  { value: 'openai-api', label: 'OpenAI API', description: 'Paid metered API, disabled unless configured', icon: <Lock className="h-3.5 w-3.5" />, color: '#34D399', section: 'paid', disabled: true, disabledReason: 'Requires an OpenAI API key in Settings and separate paid billing.' },
  { value: 'gemini-api', label: 'Gemini API', description: 'Paid metered API, disabled unless configured', icon: <Lock className="h-3.5 w-3.5" />, color: '#60A5FA', section: 'paid', disabled: true, disabledReason: 'Requires a Gemini API key in Settings and separate paid billing.' },
  { value: 'gemini-api-native', label: 'Gemini Native', description: 'Structured planning via API, paid-gated unless configured', icon: <Lock className="h-3.5 w-3.5" />, color: '#60A5FA', section: 'paid', disabled: true, disabledReason: 'Requires GEMINI_API_KEY or Settings key. It will not route silently.' },
  { value: 'hermes-nous', label: 'Hermes / Nous Remote', description: 'Paid proxy credits required', icon: <Lock className="h-3.5 w-3.5" />, color: '#F6C453', section: 'paid', disabled: true, disabledReason: 'Hermes/Nous remains paid-gated and needs ENABLE_HERMES_PAID=true plus explicit approval.' },
  { value: 'fcc-proxy', label: 'FCC Proxy', description: 'Experimental connector', icon: <Beaker className="h-3.5 w-3.5" />, color: '#C084FC', section: 'experimental', disabled: true, disabledReason: 'FCC remains experimental and is not wired as a guaranteed runtime.' },
  { value: 'anti-gravity', label: 'Anti-Gravity', description: 'Planned Google agent runtime', icon: <Beaker className="h-3.5 w-3.5" />, color: '#FBBF24', section: 'experimental', disabled: true, disabledReason: 'Planned/experimental. BertOS does not assume it is installed or configured.' },
]

const VIEW_LABELS: Record<string, string> = {
  dashboard: 'Mission Control',
  chat: 'Oracle Console',
  prompts: 'Prompt Arsenal',
  compare: 'Oracle Tribunal',
  coding: 'Forge Bay',
  workspace: 'Command Deck',
  evolution: 'Experimental Armory',
  agents: 'Agent Legion',
  memory: 'Memory Vault',
  brief: 'Daily Oracle Brief',
  playbooks: 'Doctrine Library',
  tasks: 'Task Phalanx',
  migrations: 'Migration Cartography',
  github: 'Repo War Room',
  settings: 'Provider Forge',
  autopilot: 'Autopilot Praetorium',
}

export function TopBar({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void }) {
  const { selectedModel, setSelectedModel, activeView, rightPanelOpen, setRightPanelOpen, setCommandPaletteOpen } = useUIStore()
  const { isStreaming, sessions, activeSessionId } = useChatStore()
  const { runs } = useAutomationStore()
  const { health: daemonHealth, loading: daemonLoading, refresh: refreshDaemonHealth } = useDaemonHealth(30000)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuRect, setMenuRect] = useState<{ right: number; top: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!modelMenuOpen || !triggerRef.current) return
    const update = () => {
      const rect = triggerRef.current!.getBoundingClientRect()
      setMenuRect({ right: Math.max(12, window.innerWidth - rect.right), top: rect.bottom + 8 })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [modelMenuOpen])

  const activeModel = MODEL_OPTIONS.find(option => option.value === selectedModel) ?? MODEL_OPTIONS[0]
  const activeSession = sessions.find(session => session.id === activeSessionId)
  const daemonOnline = Boolean(daemonHealth?.daemonOnline)
  const runningRuns = runs.filter(run => run.status === 'running').length
  const pendingApprovals = runs.filter(run => run.status === 'needs-approval').length
  const liveState = pendingApprovals > 0 ? 'approval' : isStreaming ? 'generating' : runningRuns > 0 ? 'autopilot' : daemonOnline ? 'live' : 'setup'

  const selectModel = (option: ModelOption) => {
    if (option.disabled) return
    setSelectedModel(option.value as AIModel)
    setModelMenuOpen(false)
  }

  const grouped = useMemo(() => ({
    subscription: MODEL_OPTIONS.filter(option => option.section === 'subscription'),
    local: MODEL_OPTIONS.filter(option => option.section === 'local'),
    paid: MODEL_OPTIONS.filter(option => option.section === 'paid'),
    experimental: MODEL_OPTIONS.filter(option => option.section === 'experimental'),
  }), [])

  const menu = modelMenuOpen && mounted && menuRect ? createPortal(
    <>
      <button className="fixed inset-0 z-[80] cursor-default" onClick={() => setModelMenuOpen(false)} aria-label="Close model selector" />
      <div
        className="fixed z-[90] max-h-[min(620px,calc(100dvh-80px))] w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/95 shadow-[0_24px_90px_rgba(0,0,0,0.55),0_0_40px_rgba(34,211,238,0.12)] backdrop-blur-xl"
        style={{ right: menuRect.right, top: menuRect.top }}
      >
        <div className="hermes-grid-fine pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative max-h-[inherit] overflow-y-auto p-2">
          <ModelSection title="Model Pantheon" items={grouped.subscription} selectedModel={selectedModel} onSelect={selectModel} />
          <RomanDivider label="local ollama" className="px-2" />
          <ModelSection title="Local Legion" items={grouped.local} selectedModel={selectedModel} onSelect={selectModel} />
          <RomanDivider label="paid gates" className="px-2" />
          <ModelSection title="Paid API / Metered" items={grouped.paid} selectedModel={selectedModel} onSelect={selectModel} />
          <RomanDivider label="experimental" className="px-2" />
          <ModelSection title="Experimental / Planned" items={grouped.experimental} selectedModel={selectedModel} onSelect={selectModel} />
          <div className="m-2 rounded-xl border border-amber-300/20 bg-amber-300/8 p-3 text-[11px] leading-relaxed text-amber-100/75">
            Paid APIs and planned runtimes do not become enabled silently. Configure Settings and explicitly approve paid usage before routing.
          </div>
        </div>
      </div>
    </>,
    document.body,
  ) : null

  return (
    <div className="relative z-30 flex h-12 shrink-0 items-center gap-3 border-b border-cyan-300/10 bg-slate-950/76 px-4 backdrop-blur-xl">
      <button
        onClick={onMobileMenuToggle}
        className="shrink-0 rounded-lg border border-cyan-300/10 p-1.5 text-zinc-400 transition hover:border-cyan-300/30 hover:text-cyan-100 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-3">
        <StatusOrb state={liveState === 'setup' ? 'warning' : liveState === 'approval' ? 'warning' : isStreaming ? 'loading' : 'active'} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-100">{VIEW_LABELS[activeView] ?? 'BertOS'}</div>
          <div className="hidden truncate text-[10px] text-zinc-600 sm:block">
            {activeSession?.title && activeSession.title !== 'New Chat' ? activeSession.title : 'Jarvis x Roman Hermes command channel'}
          </div>
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden items-center gap-1.5 rounded-lg border border-cyan-300/10 bg-slate-900/70 px-2.5 py-1 text-zinc-500 transition hover:border-cyan-300/30 hover:text-cyan-100 md:flex"
          >
            <Command className="h-3 w-3" />
            <span className="text-[10px]">CTRL K</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>Command Palette</TooltipContent>
      </Tooltip>

      <div className="hidden md:block"><ProviderStatusIndicator /></div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => void refreshDaemonHealth()}
            className={cn(
              'hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition md:flex',
              daemonOnline ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/20 bg-amber-300/10 text-amber-200',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', daemonOnline ? 'bg-emerald-300' : 'bg-amber-300', daemonLoading && 'animate-pulse')} />
            <Server className="h-3.5 w-3.5" />
            <span>{daemonOnline ? 'Daemon' : 'Daemon offline'}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{daemonOnline ? 'Local daemon online' : 'Start npm run bertos:daemon'}</TooltipContent>
      </Tooltip>

      <button
        ref={triggerRef}
        onClick={() => setModelMenuOpen(open => !open)}
        className="flex items-center gap-2 rounded-lg border border-cyan-300/15 bg-slate-900/80 px-3 py-1.5 text-sm transition hover:border-cyan-300/35"
      >
        <span style={{ color: activeModel.color }}>{activeModel.icon}</span>
        <span className="hidden text-xs font-medium text-zinc-100 sm:block">{activeModel.label}</span>
        <ChevronDown className={cn('h-3 w-3 text-zinc-500 transition', modelMenuOpen && 'rotate-180')} />
      </button>
      {menu}

      <div className={cn(
        'hidden items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] sm:flex',
        liveState === 'approval' ? 'border-amber-300/20 bg-amber-300/10 text-amber-200' : liveState === 'setup' ? 'border-zinc-700 bg-zinc-900/60 text-zinc-500' : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
      )}>
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
        {liveState === 'approval' ? `${pendingApprovals} approvals` : isStreaming ? 'Generating' : runningRuns > 0 ? `${runningRuns} runs` : daemonOnline ? 'Live' : 'Setup'}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className={cn(
              'rounded-lg border p-1.5 transition',
              rightPanelOpen
                ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
                : 'border-cyan-300/10 bg-slate-900/60 text-zinc-500 hover:text-cyan-100',
            )}
          >
            {rightPanelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{rightPanelOpen ? 'Hide Panel' : 'Show Panel'}</TooltipContent>
      </Tooltip>
    </div>
  )
}

function ModelSection({
  title,
  items,
  selectedModel,
  onSelect,
}: {
  title: string
  items: ModelOption[]
  selectedModel: AIModel
  onSelect: (option: ModelOption) => void
}) {
  return (
    <div className="p-1.5">
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-600">{title}</div>
      <div className="space-y-1">
        {items.map(option => {
          const selected = option.value === selectedModel
          return (
            <button
              key={option.value}
              onClick={() => onSelect(option)}
              disabled={option.disabled}
              title={option.disabledReason}
              className={cn(
                'w-full rounded-xl border px-3 py-2 text-left transition',
                selected ? 'border-cyan-300/35 bg-cyan-300/12' : 'border-transparent hover:border-cyan-300/20 hover:bg-cyan-300/6',
                option.disabled && 'cursor-not-allowed opacity-55 hover:border-transparent hover:bg-transparent',
              )}
            >
              <div className="flex items-center gap-2.5">
                <span style={{ color: option.color }}>{option.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-100">{option.label}</span>
                    {option.disabled && <ProviderBadge model={String(option.value)} label="gated" disabled />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">
                    {option.disabled ? option.disabledReason : option.description}
                  </p>
                </div>
                {selected && <StatusOrb state="active" size="sm" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
