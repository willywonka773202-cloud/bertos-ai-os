'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, AlertTriangle, CheckCircle2, Code2, Cpu, FlaskConical,
  GitBranch, Hammer, Home, Loader2, MessageSquare, Plus,
  Power, RefreshCw, Sparkles, Terminal, Zap, ArrowUpRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/bertos/cn'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useAutomationsStore } from '@/store/bertos/automations'

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
  { label: 'New chat',          icon: MessageSquare, view: 'chat'      as const, href: '/chat',      tone: 'violet' },
  { label: 'Coding mission',    icon: Code2,         view: 'coding'    as const, href: '/coding',    tone: 'blue'   },
  { label: 'Workspace',         icon: Terminal,      view: 'workspace' as const, href: '/workspace', tone: 'emerald'},
  { label: 'Compare models',    icon: Sparkles,      view: 'compare'   as const, href: '/compare',   tone: 'amber'  },
  { label: 'Autopilot',         icon: Power,         view: 'autopilot' as const, href: '/autopilot', tone: 'violet' },
  { label: 'Evolution Lab',     icon: FlaskConical,  view: 'evolution' as const, href: '/evolution', tone: 'blue'   },
]

const TONE_CLASSES: Record<string, { border: string; bg: string; icon: string; hoverBorder: string }> = {
  violet:  { border: 'border-violet-500/20',  bg: 'bg-violet-500/5',  icon: 'text-violet-400',  hoverBorder: 'hover:border-violet-500/50' },
  blue:    { border: 'border-blue-500/20',    bg: 'bg-blue-500/5',    icon: 'text-blue-400',    hoverBorder: 'hover:border-blue-500/50' },
  emerald: { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', icon: 'text-emerald-400', hoverBorder: 'hover:border-emerald-500/50' },
  amber:   { border: 'border-amber-500/20',   bg: 'bg-amber-500/5',   icon: 'text-amber-400',   hoverBorder: 'hover:border-amber-500/50' },
}

function StatusOrb({ ok, pulse = false }: { ok: boolean; pulse?: boolean }) {
  return (
    <span className="relative inline-flex w-2 h-2 flex-shrink-0">
      <span className={cn('absolute inset-0 rounded-full', ok ? 'bg-emerald-400' : 'bg-red-500')} />
      {pulse && (
        <span className={cn('absolute inset-0 rounded-full animate-ping opacity-60', ok ? 'bg-emerald-400' : 'bg-red-500')} />
      )}
    </span>
  )
}

export function DashboardView() {
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null)
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [loadingDaemon, setLoadingDaemon] = useState(true)
  const { setActiveView } = useUIStore()
  const { createSession, sessions } = useChatStore()
  const { runs: automationRuns, rules: automationRules } = useAutomationsStore()
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

  const navigate = (view: typeof QUICK_ACTIONS[number]['view'], href: string) => {
    setActiveView(view)
    router.push(href)
  }

  const onlineProviders   = providers.filter(p => p.online).length
  const enabledRules      = automationRules.filter(r => r.enabled).length
  const activeRuns        = automationRuns.filter(r => r.status === 'running').length
  const needsApproval     = automationRuns.filter(r => r.status === 'needs-approval').length
  const recentRuns        = automationRuns.slice(0, 4)
  const allOnline         = providers.length > 0 && onlineProviders === providers.length
  const systemHealthy     = allOnline && daemon?.online
  const systemHealthLabel = !providers.length ? 'Checking' : systemHealthy ? 'All systems nominal' : (daemon?.online ? 'Partial outage' : 'Daemon offline')

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#09090B]">
      <ScrollArea className="flex-1">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

          {/* HERO */}
          <motion.section
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-violet-950/20 p-6"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(139,92,246,0.08),_transparent_60%)] pointer-events-none" />
            <div className="relative flex items-start gap-5">
              <motion.div
                animate={{
                  boxShadow: systemHealthy
                    ? ['0 0 16px rgba(52,211,153,0.2)', '0 0 28px rgba(52,211,153,0.35)', '0 0 16px rgba(52,211,153,0.2)']
                    : ['0 0 16px rgba(245,158,11,0.2)', '0 0 28px rgba(245,158,11,0.35)', '0 0 16px rgba(245,158,11,0.2)'],
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center border',
                  systemHealthy
                    ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-emerald-500/30'
                    : 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-amber-500/30'
                )}
              >
                <Home className={cn('w-6 h-6', systemHealthy ? 'text-emerald-300' : 'text-amber-300')} />
              </motion.div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-semibold tracking-tight text-zinc-50">BertOS Mission Control</h1>
                  <Badge variant={systemHealthy ? 'success' : 'warning'} className="text-[10px]">
                    {systemHealthLabel}
                  </Badge>
                </div>
                <p className="text-sm text-zinc-500">
                  Your AI command center. Chat, build, automate, and orchestrate every model from one console.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  <HeroStat
                    label="Providers"
                    value={loadingProviders ? '…' : `${onlineProviders}/${providers.length}`}
                    icon={Cpu}
                    tone={allOnline ? 'emerald' : providers.length === 0 ? 'zinc' : 'amber'}
                  />
                  <HeroStat
                    label="Daemon"
                    value={loadingDaemon ? '…' : daemon?.online ? 'Online' : 'Offline'}
                    icon={Activity}
                    tone={daemon?.online ? 'emerald' : 'amber'}
                  />
                  <HeroStat
                    label="Automations"
                    value={`${enabledRules}/${automationRules.length}`}
                    icon={Power}
                    tone={enabledRules > 0 ? 'violet' : 'zinc'}
                  />
                  <HeroStat
                    label="Running"
                    value={activeRuns + needsApproval > 0 ? `${activeRuns + needsApproval}` : 'Idle'}
                    icon={Zap}
                    tone={activeRuns > 0 ? 'violet' : needsApproval > 0 ? 'amber' : 'zinc'}
                    pulse={activeRuns > 0}
                  />
                </div>
              </div>

              <Button size="sm" variant="ghost" onClick={fetchStatus} className="flex-shrink-0">
                <RefreshCw className={cn('w-3.5 h-3.5', (loadingProviders || loadingDaemon) && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </motion.section>

          {/* QUICK ACTIONS */}
          <section>
            <SectionHeader title="Quick actions" subtitle="Jump into common workflows" />
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
                      if (action.view === 'chat') createSession()
                      navigate(action.view, action.href)
                    }}
                    className={cn(
                      'group relative flex flex-col items-center gap-2 p-4 rounded-xl border bg-zinc-950/60',
                      tone.border, tone.hoverBorder,
                      'transition-all duration-150 text-center hover:bg-zinc-900/60'
                    )}
                  >
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', tone.bg)}>
                      <action.icon className={cn('w-4 h-4', tone.icon)} />
                    </div>
                    <span className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-100 transition-colors">
                      {action.label}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </section>

          {/* TWO-COL: PROVIDERS + AUTOPILOT */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Providers — span 2 */}
            <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Provider fleet</h2>
                <Badge variant="default" className="ml-auto text-[10px]">{providers.length} configured</Badge>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {loadingProviders ? (
                  <div className="flex items-center gap-2 p-5 text-xs text-zinc-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking providers...
                  </div>
                ) : providers.length === 0 ? (
                  <EmptyState
                    icon={Cpu}
                    title="No provider status"
                    hint="Start the daemon to see provider availability."
                  />
                ) : (
                  providers.map(p => (
                    <div key={p.providerId} className="flex items-center gap-3 px-5 py-3 hover:bg-white/2 transition-colors">
                      <StatusOrb ok={p.online} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200 font-medium truncate">{p.providerName}</p>
                        <p className="text-[10px] text-zinc-600 font-mono truncate">{p.modelOrTool}</p>
                      </div>
                      <Badge variant={p.online ? 'success' : 'error'} className="text-[10px]">
                        {p.online ? 'online' : 'offline'}
                      </Badge>
                      {p.source && (
                        <span className="text-[10px] text-zinc-700 uppercase tracking-wider w-14 text-right">{p.source}</span>
                      )}
                      {p.error && (
                        <span className="text-[10px] text-amber-400 truncate max-w-[140px]" title={p.error}>{p.error}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Autopilot */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                <Power className="w-3.5 h-3.5 text-violet-400" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Autopilot</h2>
                <button
                  onClick={() => navigate('autopilot', '/autopilot')}
                  className="ml-auto text-[10px] text-zinc-600 hover:text-violet-300 inline-flex items-center gap-0.5"
                >
                  Open <ArrowUpRight className="w-2.5 h-2.5" />
                </button>
              </div>
              <div className="p-5">
                {needsApproval > 0 && (
                  <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <p className="text-xs font-medium text-amber-200">{needsApproval} run awaiting approval</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Rules</p>
                    <p className="text-lg font-semibold text-zinc-100 mt-0.5 tabular-nums">{enabledRules}<span className="text-sm text-zinc-700 font-normal"> / {automationRules.length}</span></p>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Total runs</p>
                    <p className="text-lg font-semibold text-zinc-100 mt-0.5 tabular-nums">{automationRuns.length}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Recent activity</p>
                  {recentRuns.length === 0 ? (
                    <p className="text-[11px] text-zinc-600">No runs yet.</p>
                  ) : (
                    recentRuns.map(run => (
                      <button
                        key={run.id}
                        onClick={() => navigate('autopilot', '/autopilot')}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/4 transition-colors text-left"
                      >
                        <StatusOrb
                          ok={run.status === 'completed'}
                          pulse={run.status === 'running' || run.status === 'needs-approval'}
                        />
                        <span className="text-[11px] text-zinc-400 truncate flex-1">{run.title}</span>
                        <span className="text-[10px] text-zinc-700 capitalize flex-shrink-0">{run.status}</span>
                      </button>
                    ))
                  )}
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate('autopilot', '/autopilot')}
                  className="w-full mt-3 text-xs"
                >
                  <Sparkles className="w-3 h-3" /> Open Autopilot
                </Button>
              </div>
            </div>
          </section>

          {/* DAEMON + REPO */}
          <section>
            <SectionHeader title="Local daemon" subtitle="File and terminal bridge — never auto-pushes" />
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
              {loadingDaemon ? (
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking daemon...
                </div>
              ) : daemon ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <StatusOrb ok={daemon.online} pulse={daemon.online} />
                    <span className={cn('text-sm font-medium', daemon.online ? 'text-zinc-100' : 'text-zinc-500')}>
                      {daemon.online ? 'Daemon online' : 'Daemon offline'}
                    </span>
                    {!daemon.online && (
                      <Badge variant="warning" className="text-[10px]">
                        Start: <code className="ml-1 font-mono">npm run bertos:daemon</code>
                      </Badge>
                    )}
                  </div>

                  {daemon.repo && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <DaemonStat icon={GitBranch} label="Branch" value={daemon.repo.branch} />
                      <DaemonStat
                        icon={daemon.repo.safeRepo ? CheckCircle2 : AlertTriangle}
                        label="Repo safety"
                        value={daemon.repo.safeRepo ? 'Safe' : 'Not safe'}
                        tone={daemon.repo.safeRepo ? 'emerald' : 'amber'}
                      />
                      <DaemonStat
                        icon={Activity}
                        label="Tools"
                        value={`${daemon.tools?.filter(t => t.installed).length ?? 0} / ${daemon.tools?.length ?? 0} installed`}
                      />
                    </div>
                  )}

                  {daemon.tools && daemon.tools.length > 0 && (
                    <div>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">CLI tools detected</p>
                      <div className="flex flex-wrap gap-2">
                        {daemon.tools.map(tool => (
                          <div
                            key={tool.id}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-zinc-800 bg-zinc-900/40"
                          >
                            <StatusOrb ok={tool.installed} />
                            <span className="text-[11px] text-zinc-400">{tool.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-zinc-600">
                  Cannot reach daemon. Run: <code className="font-mono text-zinc-400">npm run bertos:daemon</code>
                </div>
              )}
            </div>
          </section>

          {/* INTEGRATIONS */}
          <section>
            <SectionHeader title="Integrations" subtitle="Optional services for richer workflows" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <IntegrationCard name="Hermes"   desc="Remote runtime + schedules" envVars={['HERMES_API_URL','HERMES_API_KEY']} route="/api/hermes/status" />
              <IntegrationCard name="Telegram" desc="Mobile control layer"        envVars={['TELEGRAM_BOT_TOKEN','TELEGRAM_ALLOWED_CHAT_ID']} route="/api/telegram/status" />
              <IntegrationCard name="Composio" desc="Tool & app integrations"     envVars={['COMPOSIO_API_KEY']} route="/api/tools/composio/status" />
            </div>
          </section>

          {/* RECENT CHATS */}
          {sessions.length > 0 && (
            <section>
              <SectionHeader
                title="Recent chats"
                subtitle={`${sessions.length} session${sessions.length === 1 ? '' : 's'}`}
                action={
                  <Button size="sm" variant="ghost" onClick={() => { createSession(); navigate('chat', '/chat') }} className="text-xs">
                    <Plus className="w-3 h-3" /> New
                  </Button>
                }
              />
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 divide-y divide-zinc-800/50 overflow-hidden">
                {sessions.slice(0, 5).map(session => (
                  <button
                    key={session.id}
                    onClick={() => { setActiveView('chat'); router.push('/chat') }}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/3 transition-colors group"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-zinc-700 group-hover:text-violet-400 flex-shrink-0 transition-colors" />
                    <span className="text-sm text-zinc-300 truncate flex-1">{session.title}</span>
                    <span className="text-[10px] text-zinc-700 ml-auto flex-shrink-0">
                      {session.messages.length} msg
                    </span>
                    <ArrowUpRight className="w-3 h-3 text-zinc-800 group-hover:text-zinc-500 transition-colors" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* SHORTCUTS */}
          <section>
            <SectionHeader title="Keyboard shortcuts" subtitle="Navigate without leaving the keyboard" />
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
              {[
                ['⌘K', 'Command palette'],
                ['⌘1', 'Chat'],
                ['⌘2', 'Compare'],
                ['⌘3', 'Workspace'],
                ['⌘4', 'Evolution'],
                ['⌘5', 'Coding'],
                ['⌘6', 'Agents'],
                ['⌘N', 'New chat'],
                ['⌘B', 'Toggle sidebar'],
                ['⌘P', 'Toggle right panel'],
                ['⌘0', 'Dashboard'],
                ['⌘,', 'Settings'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <kbd className="text-[10px] bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-800 font-mono min-w-[28px] text-center">{key}</kbd>
                  <span className="text-xs text-zinc-500">{label}</span>
                </div>
              ))}
            </div>
          </section>

        </div>
      </ScrollArea>
    </div>
  )
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{title}</p>
        {subtitle && <p className="text-[11px] text-zinc-600 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function HeroStat({ label, value, icon: Icon, tone, pulse }: {
  label: string
  value: string
  icon: typeof Activity
  tone: 'emerald' | 'amber' | 'violet' | 'zinc'
  pulse?: boolean
}) {
  const toneClass: Record<string, string> = {
    emerald: 'text-emerald-300',
    amber:   'text-amber-300',
    violet:  'text-violet-300',
    zinc:    'text-zinc-300',
  }
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn('w-3 h-3', toneClass[tone])} />
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{label}</p>
        {pulse && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />}
      </div>
      <p className={cn('text-sm font-semibold tabular-nums', toneClass[tone])}>{value}</p>
    </div>
  )
}

function DaemonStat({ icon: Icon, label, value, tone = 'zinc' }: {
  icon: typeof Activity; label: string; value: string; tone?: 'emerald' | 'amber' | 'zinc'
}) {
  const toneClass: Record<string, string> = {
    emerald: 'text-emerald-400',
    amber:   'text-amber-400',
    zinc:    'text-zinc-400',
  }
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={cn('w-3 h-3', toneClass[tone])} />
        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{label}</span>
      </div>
      <span className={cn('font-mono text-sm', toneClass[tone])}>{value}</span>
    </div>
  )
}

function EmptyState({ icon: Icon, title, hint }: { icon: typeof Activity; title: string; hint: string }) {
  return (
    <div className="p-8 text-center">
      <Icon className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
      <p className="text-xs text-zinc-400 font-medium">{title}</p>
      <p className="text-[11px] text-zinc-600 mt-1">{hint}</p>
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <Hammer className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-sm font-medium text-zinc-200">{name}</span>
        <div className="ml-auto">
          {status === 'loading' ? <Loader2 className="w-3 h-3 animate-spin text-zinc-700" />
            : <StatusOrb ok={status === 'configured'} />}
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 mb-3">{desc}</p>
      {status === 'missing' && (
        <div className="space-y-0.5">
          {envVars.map(v => (
            <div key={v} className="font-mono text-[10px] text-zinc-700">{v}</div>
          ))}
          <p className="text-[10px] text-zinc-700 mt-1.5">Set in .env.local to enable</p>
        </div>
      )}
      {status === 'configured' && (
        <Badge variant="success" className="text-[10px]">Configured</Badge>
      )}
    </div>
  )
}

