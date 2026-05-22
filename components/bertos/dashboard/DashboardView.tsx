'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, AlertTriangle, ArrowUpRight, Bot, CheckCircle2, Code2, Cpu,
  FlaskConical, GitBranch, Hammer, Loader2, MessageSquare, Plus,
  Power, RefreshCw, Sparkles, Terminal, Zap, Radio, Shield, Compass, Crown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/bertos/cn'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useAutomationsStore } from '@/store/bertos/automations'
import { useAgentStore } from '@/store/bertos/agents'
import {
  StatusOrb,
  MetricTile,
  HologramPanel,
  PanelHeader,
  RomanDivider,
  ProviderBadge,
  getProviderMeta,
} from '@/components/bertos/hermes'

interface ProviderStatus {
  providerId: string
  providerName: string
  online: boolean
  modelOrTool: string
  source?: string
  error?: string
}

interface DaemonStatus {
  online: boolean
  repo?: { branch: string; safeRepo: boolean; status: string; remote: string }
  tools?: Array<{ id: string; label: string; installed: boolean }>
}

const QUICK_ACTIONS = [
  { label: 'Oracle Chat',  icon: MessageSquare, view: 'chat'      as const, href: '/chat',      tone: 'cyan'   as const },
  { label: 'Forge',        icon: Code2,         view: 'coding'    as const, href: '/coding',    tone: 'cyan'   as const },
  { label: 'Workspace',    icon: Terminal,      view: 'workspace' as const, href: '/workspace', tone: 'cyan'   as const },
  { label: 'Pantheon',     icon: Sparkles,      view: 'compare'   as const, href: '/compare',   tone: 'bronze' as const },
  { label: 'Autopilot',    icon: Power,         view: 'autopilot' as const, href: '/autopilot', tone: 'bronze' as const },
  { label: 'Evolution',    icon: FlaskConical,  view: 'evolution' as const, href: '/evolution', tone: 'bronze' as const },
]

const TONE_CLASSES: Record<'cyan' | 'bronze', { border: string; bg: string; icon: string; hoverBorder: string; halo: string }> = {
  cyan:   { border: 'border-cyan-500/25',  bg: 'bg-cyan-500/[0.04]',  icon: 'text-cyan-300',   hoverBorder: 'hover:border-cyan-400/60',  halo: 'hover:shadow-[0_0_20px_rgba(34,211,238,0.18)]' },
  bronze: { border: 'border-amber-600/30', bg: 'bg-amber-600/[0.04]', icon: 'text-amber-300',  hoverBorder: 'hover:border-amber-500/60', halo: 'hover:shadow-[0_0_20px_rgba(217,119,6,0.2)]' },
}

export function DashboardView() {
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null)
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [loadingDaemon, setLoadingDaemon] = useState(true)
  const { setActiveView, selectedModel } = useUIStore()
  const { sessions, activeSessionId, getOrCreateSession, setActiveSession, isStreaming } = useChatStore()
  const { runs: automationRuns, rules: automationRules } = useAutomationsStore()
  const { tasks: agentTasks } = useAgentStore()
  const router = useRouter()

  const fetchStatus = async () => {
    setLoadingProviders(true)
    setLoadingDaemon(true)
    try {
      const [pRes, dRes] = await Promise.allSettled([
        fetch('/api/providers/status', { cache: 'no-store' }),
        fetch('/api/local-daemon/status', { cache: 'no-store' }),
      ])
      if (pRes.status === 'fulfilled' && pRes.value.ok) {
        const d = await pRes.value.json() as {
          ollama?: { id: string; provider: string; mode: string; online: boolean; defaultModel: string; error?: string }
          localDaemon?: { online: boolean; tools?: Array<{ id: string; label: string; installed: boolean; loginStatus: string; error?: string }> }
          apiProviders?: { enabled: boolean; anthropic: boolean; openai: boolean; gemini: boolean }
        }
        const mapped: ProviderStatus[] = []
        if (d.ollama) {
          mapped.push({
            providerId: d.ollama.id ?? 'ollama-pro',
            providerName: d.ollama.provider ?? 'Ollama Pro',
            online: d.ollama.online,
            modelOrTool: d.ollama.defaultModel,
            source: d.ollama.mode,
            error: d.ollama.error,
          })
        }
        if (d.localDaemon?.tools) {
          for (const tool of d.localDaemon.tools) {
            mapped.push({
              providerId: tool.id,
              providerName: tool.label,
              online: tool.installed && tool.loginStatus === 'available',
              modelOrTool: tool.id,
              source: 'daemon',
              error: tool.error ?? (tool.installed ? (tool.loginStatus !== 'available' ? `login: ${tool.loginStatus}` : undefined) : 'not installed'),
            })
          }
        }
        if (d.apiProviders?.enabled) {
          if (d.apiProviders.anthropic) mapped.push({ providerId: 'claude-api', providerName: 'Anthropic API', online: true, modelOrTool: 'claude-sonnet-4-6', source: 'api' })
          if (d.apiProviders.openai)    mapped.push({ providerId: 'openai-api',  providerName: 'OpenAI API',    online: true, modelOrTool: 'gpt-4o',             source: 'api' })
          if (d.apiProviders.gemini)    mapped.push({ providerId: 'gemini-api',  providerName: 'Gemini API',    online: true, modelOrTool: 'gemini-2.0-flash',    source: 'api' })
        }
        setProviders(mapped)
      }
      if (dRes.status === 'fulfilled' && dRes.value.ok) {
        const d = await dRes.value.json()
        setDaemon(d as DaemonStatus)
      }
    } finally {
      setLoadingProviders(false)
      setLoadingDaemon(false)
    }
  }

  useEffect(() => { fetchStatus() }, [])

  type NavView = ReturnType<typeof useUIStore.getState>['activeView']
  const navigate = (view: NavView, href: string) => {
    setActiveView(view)
    router.push(href)
  }

  // Live operational state
  const onlineProviders   = providers.filter(p => p.online).length
  const enabledRules      = automationRules.filter(r => r.enabled).length
  const activeRuns        = automationRuns.filter(r => r.status === 'running').length
  const needsApproval     = automationRuns.filter(r => r.status === 'needs-approval').length
  const recentRuns        = automationRuns.slice(0, 4)
  const allOnline         = providers.length > 0 && onlineProviders === providers.length
  const systemHealthy     = allOnline && daemon?.online
  const systemHealthLabel = !providers.length ? 'Booting…' : systemHealthy ? 'Nominal' : (daemon?.online ? 'Partial' : 'Daemon offline')

  // Chat operational data
  const realSessions = sessions.filter(s => s.messages.some(m => m.role === 'user'))
  const activeSession = sessions.find(s => s.id === activeSessionId)
  const activeChatName = activeSession?.title && activeSession.title !== 'New Chat'
    ? activeSession.title
    : (activeSession ? 'Draft thread' : '—')
  const activeProviderMeta = getProviderMeta(selectedModel as string)

  // Agent operational data
  const runningAgents = agentTasks.filter(t => t.status === 'running').length
  const pendingAgents = agentTasks.filter(t => t.status === 'pending').length
  const doneAgents    = agentTasks.filter(t => t.status === 'done').length

  const startNewChat = () => {
    const s = getOrCreateSession(selectedModel)
    setActiveSession(s.id)
    navigate('chat', '/chat')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* ── HERO COMMAND BAR ─────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <HologramPanel className="p-5 sm:p-6">
              <div className="flex items-start gap-5">
                {/* Insignia */}
                <motion.div
                  animate={{
                    boxShadow: systemHealthy
                      ? ['0 0 18px rgba(34,211,238,0.3)', '0 0 36px rgba(34,211,238,0.55)', '0 0 18px rgba(34,211,238,0.3)']
                      : ['0 0 16px rgba(245,158,11,0.25)', '0 0 30px rgba(245,158,11,0.45)', '0 0 16px rgba(245,158,11,0.25)'],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center border-2 flex-shrink-0 relative',
                    systemHealthy
                      ? 'border-cyan-400/50 bg-gradient-to-br from-cyan-500/15 to-cyan-700/20'
                      : 'border-amber-400/50 bg-gradient-to-br from-amber-500/15 to-amber-700/20'
                  )}
                >
                  <Crown className={cn('w-6 h-6', systemHealthy ? 'text-cyan-300' : 'text-amber-300')} />
                  <span className={cn(
                    'absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#05080F]',
                    systemHealthy ? 'bg-emerald-400' : 'bg-amber-400'
                  )} />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-hermes-gradient">
                      Mission Control
                    </h1>
                    <span className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-[0.15em]',
                      systemHealthy
                        ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-amber-400/40 bg-amber-500/10 text-amber-300'
                    )}>
                      <StatusOrb state={systemHealthy ? 'nominal' : 'warning'} size="xs" />
                      {systemHealthLabel}
                    </span>
                  </div>
                  <p className="text-sm text-cyan-100/60 mb-4">
                    All AI legions and oracles report here. Operational state is live; no fakery.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <MetricTile
                      label="Provider Fleet"
                      value={loadingProviders ? '…' : `${onlineProviders}/${providers.length}`}
                      sub={allOnline ? 'All channels live' : providers.length ? 'Partial coverage' : 'awaiting'}
                      icon={Cpu}
                      tone={allOnline ? 'cyan' : providers.length === 0 ? 'zinc' : 'amber'}
                    />
                    <MetricTile
                      label="Daemon"
                      value={loadingDaemon ? '…' : daemon?.online ? 'Online' : 'Offline'}
                      sub={daemon?.repo?.branch}
                      icon={Activity}
                      tone={daemon?.online ? 'cyan' : 'amber'}
                    />
                    <MetricTile
                      label="Autopilot"
                      value={`${enabledRules}/${automationRules.length}`}
                      sub={`${activeRuns} running · ${needsApproval} pending`}
                      icon={Power}
                      tone={activeRuns > 0 ? 'bronze' : enabledRules > 0 ? 'cyan' : 'zinc'}
                      pulse={activeRuns > 0}
                    />
                    <MetricTile
                      label="Active Stream"
                      value={isStreaming ? 'Live' : (activeSession ? 'Standby' : 'None')}
                      sub={activeSession ? activeChatName : 'No session'}
                      icon={Radio}
                      tone={isStreaming ? 'cyan' : 'zinc'}
                      pulse={isStreaming}
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={fetchStatus}
                  className="flex-shrink-0 text-cyan-200 hover:text-cyan-100 hover:bg-cyan-500/10"
                >
                  <RefreshCw className={cn('w-3.5 h-3.5', (loadingProviders || loadingDaemon) && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
            </HologramPanel>
          </motion.section>

          {/* ── QUICK ACTIONS ────────────────────────────────────────────── */}
          <section>
            <RomanDivider label="Quick Channels" className="mb-3" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {QUICK_ACTIONS.map((action, i) => {
                const tone = TONE_CLASSES[action.tone]
                return (
                  <motion.button
                    key={action.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    onClick={() => {
                      if (action.view === 'chat') {
                        startNewChat()
                      } else {
                        navigate(action.view, action.href)
                      }
                    }}
                    className={cn(
                      'group relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-[#05080F]/60 backdrop-blur-md',
                      tone.border, tone.hoverBorder, tone.halo,
                      'transition-all duration-200 text-center'
                    )}
                  >
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center border border-current/20', tone.bg)}>
                      <action.icon className={cn('w-4 h-4', tone.icon)} />
                    </div>
                    <span className={cn(
                      'text-[11px] font-semibold tracking-wide',
                      action.tone === 'cyan' ? 'text-cyan-200/80' : 'text-amber-200/80',
                      'group-hover:text-white transition-colors'
                    )}>
                      {action.label}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </section>

          {/* ── OPERATIONAL OVERVIEW — 3 panels ──────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Provider Fleet — wide */}
            <HologramPanel className="lg:col-span-2">
              <PanelHeader
                icon={Cpu}
                title="Provider Fleet"
                subtitle={`${onlineProviders} of ${providers.length} channels live`}
                action={
                  <span className="text-[10px] font-mono text-cyan-100/40 uppercase tracking-wider">
                    {selectedModel}
                  </span>
                }
              />
              <div className="divide-y divide-cyan-500/10">
                {loadingProviders ? (
                  <div className="flex items-center gap-2 p-5 text-xs text-cyan-100/40">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning channels...
                  </div>
                ) : providers.length === 0 ? (
                  <div className="p-8 text-center">
                    <Cpu className="w-8 h-8 text-cyan-100/15 mx-auto mb-2" />
                    <p className="text-xs text-cyan-100/50 font-medium">No provider status</p>
                    <p className="text-[11px] text-cyan-100/30 mt-1">Start the daemon to see availability.</p>
                  </div>
                ) : (
                  providers.map(p => {
                    const isActive = p.providerId === selectedModel
                    return (
                      <div
                        key={p.providerId}
                        className={cn(
                          'flex items-center gap-3 px-5 py-3 transition-colors',
                          isActive
                            ? 'bg-cyan-500/[0.06]'
                            : 'hover:bg-cyan-500/[0.03]'
                        )}
                      >
                        <StatusOrb state={p.online ? 'nominal' : 'danger'} pulse={p.online && isActive} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-cyan-100 font-medium truncate">{p.providerName}</p>
                            {isActive && <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300">ACTIVE</span>}
                          </div>
                          <p className="text-[10px] text-cyan-100/35 font-mono truncate">{p.modelOrTool}</p>
                        </div>
                        <span className={cn(
                          'text-[10px] font-mono uppercase tracking-wider',
                          p.online ? 'text-emerald-300' : 'text-red-300'
                        )}>
                          {p.online ? 'live' : 'offline'}
                        </span>
                        {p.source && (
                          <span className="text-[9px] text-cyan-100/30 uppercase tracking-wider w-14 text-right">{p.source}</span>
                        )}
                        {p.error && (
                          <span className="text-[10px] text-amber-300 truncate max-w-[140px]" title={p.error}>{p.error}</span>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </HologramPanel>

            {/* Autopilot */}
            <HologramPanel bronze>
              <PanelHeader
                icon={Power}
                title="Autopilot"
                tone="bronze"
                action={
                  <button
                    onClick={() => navigate('autopilot', '/autopilot')}
                    className="text-[10px] text-amber-300/70 hover:text-amber-200 inline-flex items-center gap-0.5 font-mono uppercase tracking-wider"
                  >
                    Open <ArrowUpRight className="w-2.5 h-2.5" />
                  </button>
                }
              />
              <div className="p-5">
                {needsApproval > 0 && (
                  <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 animate-hermes-bronze-pulse">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <p className="text-xs font-semibold text-amber-200">{needsApproval} awaiting approval</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-amber-600/20 bg-amber-600/[0.04] p-3">
                    <p className="text-[10px] text-amber-200/70 uppercase tracking-wider font-semibold">Rules</p>
                    <p className="text-lg font-bold font-mono text-amber-200 mt-0.5 tabular-nums">{enabledRules}<span className="text-sm text-amber-200/40 font-normal"> / {automationRules.length}</span></p>
                  </div>
                  <div className="rounded-lg border border-amber-600/20 bg-amber-600/[0.04] p-3">
                    <p className="text-[10px] text-amber-200/70 uppercase tracking-wider font-semibold">Runs</p>
                    <p className="text-lg font-bold font-mono text-amber-200 mt-0.5 tabular-nums">{automationRuns.length}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <p className="text-[10px] text-amber-200/60 uppercase tracking-wider mb-1.5 font-semibold">Recent activity</p>
                  {recentRuns.length === 0 ? (
                    <p className="text-[11px] text-amber-100/30">No runs yet.</p>
                  ) : (
                    recentRuns.map(run => (
                      <button
                        key={run.id}
                        onClick={() => navigate('autopilot', '/autopilot')}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-amber-600/[0.06] transition-colors text-left"
                      >
                        <StatusOrb
                          state={
                            run.status === 'completed' ? 'nominal'
                              : run.status === 'running' ? 'active'
                              : run.status === 'needs-approval' ? 'warning'
                              : run.status === 'failed' ? 'danger'
                              : 'idle'
                          }
                          size="xs"
                        />
                        <span className="text-[11px] text-amber-100/80 truncate flex-1">{run.title}</span>
                        <span className="text-[9px] text-amber-100/40 capitalize flex-shrink-0 font-mono">{run.status}</span>
                      </button>
                    ))
                  )}
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('autopilot', '/autopilot')}
                  className="w-full mt-3 text-xs bg-amber-600/20 hover:bg-amber-600/30 text-amber-100 border-amber-600/40"
                >
                  <Sparkles className="w-3 h-3" /> Open Autopilot
                </Button>
              </div>
            </HologramPanel>
          </section>

          {/* ── ORACLE STREAM + AGENT LEGION ────────────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Oracle Stream — active conversation */}
            <HologramPanel active={isStreaming}>
              <PanelHeader
                icon={MessageSquare}
                title="Oracle Stream"
                subtitle={isStreaming ? 'Generation live' : activeSession ? 'Ready' : 'No active thread'}
                action={
                  <button
                    onClick={startNewChat}
                    className="text-[10px] text-cyan-300/70 hover:text-cyan-200 inline-flex items-center gap-1 font-mono uppercase tracking-wider"
                  >
                    <Plus className="w-2.5 h-2.5" /> New
                  </button>
                }
              />
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <ProviderBadge providerId={selectedModel as string} size="md" active />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-cyan-100/40 font-semibold">Selected channel</p>
                    <p className="text-xs text-cyan-100/70 truncate">{activeProviderMeta.label}</p>
                  </div>
                </div>

                <div className="hermes-divider" />

                {activeSession ? (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-cyan-100/40 font-semibold mb-1">Active thread</p>
                    <p className="text-sm text-cyan-100 font-medium truncate" title={activeChatName}>{activeChatName}</p>
                    <p className="text-[10px] text-cyan-100/40 mt-0.5">
                      {activeSession.messages.length} message{activeSession.messages.length === 1 ? '' : 's'} ·
                      {' '}{isStreaming ? 'streaming...' : 'idle'}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-cyan-100/40 font-semibold mb-1">Active thread</p>
                    <p className="text-xs text-cyan-100/40">No conversation active. Press <kbd className="text-[10px] bg-cyan-500/10 border border-cyan-500/20 px-1 rounded">⌘N</kbd> or click New.</p>
                  </div>
                )}

                <div className="hermes-divider" />

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-cyan-100/40 font-semibold mb-2">Recent threads</p>
                  {realSessions.length === 0 ? (
                    <p className="text-[11px] text-cyan-100/30">No threads yet. Send your first message.</p>
                  ) : (
                    <div className="space-y-0.5">
                      {realSessions.slice(0, 4).map(session => {
                        const isActive = session.id === activeSessionId
                        const lastUser = [...session.messages].reverse().find(m => m.role === 'user')
                        return (
                          <button
                            key={session.id}
                            onClick={() => { setActiveSession(session.id); navigate('chat', '/chat') }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
                              isActive ? 'bg-cyan-500/10 text-cyan-100' : 'hover:bg-cyan-500/[0.05] text-cyan-100/70'
                            )}
                          >
                            <StatusOrb state={isStreaming && isActive ? 'active' : isActive ? 'nominal' : 'idle'} size="xs" />
                            <span className="text-xs font-medium truncate flex-1">{session.title}</span>
                            {lastUser && <span className="text-[9px] text-cyan-100/30 font-mono">{session.messages.length}m</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </HologramPanel>

            {/* Agent Legion */}
            <HologramPanel>
              <PanelHeader
                icon={Bot}
                title="Agent Legion"
                subtitle={`${agentTasks.length} task${agentTasks.length === 1 ? '' : 's'} in roster`}
                action={
                  <button
                    onClick={() => navigate('agents', '/agents')}
                    className="text-[10px] text-cyan-300/70 hover:text-cyan-200 inline-flex items-center gap-0.5 font-mono uppercase tracking-wider"
                  >
                    Open <ArrowUpRight className="w-2.5 h-2.5" />
                  </button>
                }
              />
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className={cn(
                    'rounded-lg border p-3',
                    runningAgents > 0 ? 'border-cyan-500/40 bg-cyan-500/[0.06]' : 'border-cyan-500/15 bg-cyan-500/[0.02]'
                  )}>
                    <p className="text-[10px] uppercase tracking-wider text-cyan-100/50 font-semibold">Running</p>
                    <p className="text-lg font-bold font-mono text-cyan-200 tabular-nums">{runningAgents}</p>
                  </div>
                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-amber-200/60 font-semibold">Pending</p>
                    <p className="text-lg font-bold font-mono text-amber-200 tabular-nums">{pendingAgents}</p>
                  </div>
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-200/60 font-semibold">Done</p>
                    <p className="text-lg font-bold font-mono text-emerald-200 tabular-nums">{doneAgents}</p>
                  </div>
                </div>

                <div className="hermes-divider" />

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-cyan-100/40 font-semibold mb-1.5">Active roster</p>
                  {agentTasks.length === 0 ? (
                    <p className="text-[11px] text-cyan-100/30">No agents commissioned.</p>
                  ) : (
                    <div className="space-y-0.5">
                      {agentTasks.slice(0, 4).map(task => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md"
                        >
                          <StatusOrb
                            state={
                              task.status === 'done' ? 'nominal'
                                : task.status === 'running' ? 'active'
                                : task.status === 'failed' ? 'danger'
                                : task.status === 'paused' ? 'warning'
                                : 'idle'
                            }
                            size="xs"
                          />
                          <span className="text-xs text-cyan-100/70 truncate flex-1">{task.title}</span>
                          <ProviderBadge providerId={task.model} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('agents', '/agents')}
                  className="w-full text-xs bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-100 border-cyan-500/30"
                >
                  <Bot className="w-3 h-3" /> Open Legion
                </Button>
              </div>
            </HologramPanel>
          </section>

          {/* ── LOCAL DAEMON ─────────────────────────────────────────────── */}
          <section>
            <RomanDivider label="Local Daemon" className="mb-3" />
            <HologramPanel>
              <div className="p-5">
                {loadingDaemon ? (
                  <div className="flex items-center gap-2 text-xs text-cyan-100/40">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking daemon...
                  </div>
                ) : daemon ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <StatusOrb state={daemon.online ? 'nominal' : 'warning'} pulse={daemon.online} />
                      <span className={cn('text-sm font-semibold', daemon.online ? 'text-cyan-100' : 'text-cyan-100/40')}>
                        {daemon.online ? 'Daemon online · file & terminal bridge live' : 'Daemon offline'}
                      </span>
                      {!daemon.online && (
                        <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5">
                          Start: npm run bertos:daemon
                        </span>
                      )}
                    </div>

                    {daemon.repo && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <MetricTile label="Branch" value={daemon.repo.branch} icon={GitBranch} tone="cyan" />
                        <MetricTile
                          label="Repo Safety"
                          value={daemon.repo.safeRepo ? 'Safe' : 'Blocked'}
                          icon={daemon.repo.safeRepo ? Shield : AlertTriangle}
                          tone={daemon.repo.safeRepo ? 'emerald' : 'amber'}
                        />
                        <MetricTile
                          label="CLI Tools"
                          value={`${daemon.tools?.filter(t => t.installed).length ?? 0} / ${daemon.tools?.length ?? 0}`}
                          icon={Compass}
                          tone="bronze"
                        />
                      </div>
                    )}

                    {daemon.tools && daemon.tools.length > 0 && (
                      <div>
                        <p className="text-[10px] text-cyan-100/40 uppercase tracking-wider mb-2 font-semibold">CLI tools detected</p>
                        <div className="flex flex-wrap gap-2">
                          {daemon.tools.map(tool => (
                            <div
                              key={tool.id}
                              className={cn(
                                'flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px]',
                                tool.installed
                                  ? 'border-cyan-500/30 bg-cyan-500/5 text-cyan-200'
                                  : 'border-zinc-700 bg-zinc-900/40 text-zinc-500'
                              )}
                            >
                              <StatusOrb state={tool.installed ? 'nominal' : 'idle'} size="xs" />
                              {tool.label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-cyan-100/40">
                    Cannot reach daemon. Run: <code className="font-mono text-amber-300">npm run bertos:daemon</code>
                  </div>
                )}
              </div>
            </HologramPanel>
          </section>

          {/* ── INTEGRATIONS ─────────────────────────────────────────────── */}
          <section>
            <RomanDivider label="Integrations" className="mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <IntegrationCard name="Hermes"   desc="Remote runtime + schedules" envVars={['HERMES_API_URL','HERMES_API_KEY']} route="/api/hermes/status" />
              <IntegrationCard name="Telegram" desc="Mobile control layer"        envVars={['TELEGRAM_BOT_TOKEN','TELEGRAM_ALLOWED_CHAT_ID']} route="/api/telegram/status" />
              <IntegrationCard name="Composio" desc="Tool & app integrations"     envVars={['COMPOSIO_API_KEY']} route="/api/tools/composio/status" />
            </div>
          </section>

          {/* ── SHORTCUTS ────────────────────────────────────────────────── */}
          <section>
            <RomanDivider label="Keyboard Edicts" className="mb-3" />
            <HologramPanel noScanlines>
              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                {[
                  ['⌘K', 'Command palette'],
                  ['⌘1', 'Oracle Chat'],
                  ['⌘2', 'Pantheon'],
                  ['⌘3', 'Workspace'],
                  ['⌘4', 'Evolution'],
                  ['⌘5', 'Forge'],
                  ['⌘6', 'Agent Legion'],
                  ['⌘N', 'New thread'],
                  ['⌘B', 'Toggle sidebar'],
                  ['⌘P', 'Toggle right panel'],
                  ['⌘0', 'Mission Control'],
                  ['⌘,', 'Edicts'],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <kbd className="text-[10px] bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 px-1.5 py-0.5 rounded font-mono min-w-[30px] text-center">{key}</kbd>
                    <span className="text-xs text-cyan-100/60">{label}</span>
                  </div>
                ))}
              </div>
            </HologramPanel>
          </section>

        </div>
      </ScrollArea>
    </div>
  )
}

function IntegrationCard({ name, desc, envVars, route }: {
  name: string; desc: string; envVars: string[]; route: string
}) {
  const [status, setStatus] = useState<'loading' | 'configured' | 'missing'>('loading')

  useEffect(() => {
    fetch(route, { cache: 'no-store' })
      .then(r => r.json())
      .then((d: { configured?: boolean; ok?: boolean }) => {
        setStatus(d.configured || d.ok ? 'configured' : 'missing')
      })
      .catch(() => setStatus('missing'))
  }, [route])

  return (
    <HologramPanel className={cn(status === 'configured' && 'hermes-bronze')}>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Hammer className="w-3.5 h-3.5 text-cyan-300/60" />
          <span className="text-sm font-semibold text-cyan-100">{name}</span>
          <div className="ml-auto">
            {status === 'loading'
              ? <Loader2 className="w-3 h-3 animate-spin text-cyan-100/30" />
              : <StatusOrb state={status === 'configured' ? 'nominal' : 'idle'} size="xs" />
            }
          </div>
        </div>
        <p className="text-[11px] text-cyan-100/50 mb-3">{desc}</p>
        {status === 'missing' && (
          <div className="space-y-0.5">
            {envVars.map(v => (
              <div key={v} className="font-mono text-[10px] text-cyan-100/30">{v}</div>
            ))}
            <p className="text-[10px] text-cyan-100/30 mt-1.5">Set in .env.local to enable</p>
          </div>
        )}
        {status === 'configured' && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] uppercase tracking-wider font-mono">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Configured
          </span>
        )}
      </div>
    </HologramPanel>
  )
}
