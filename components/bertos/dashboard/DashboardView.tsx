'use client'
import { useEffect, useState } from 'react'
import {
  AlertTriangle, Bot, CheckCircle2, Code2, FlaskConical,
  GitBranch, Home, Loader2, MessageSquare, Play,
  RefreshCw, Server, Sparkles, Terminal, Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/bertos/cn'
import { useRouter } from 'next/navigation'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'

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
  { label: 'New coding mission', icon: Code2,        view: 'coding'    as const, href: '/coding'    },
  { label: 'New chat',           icon: MessageSquare, view: 'chat'      as const, href: '/chat'      },
  { label: 'Workspace',          icon: Terminal,      view: 'workspace' as const, href: '/workspace' },
  { label: 'Evolution Lab',      icon: FlaskConical,  view: 'evolution' as const, href: '/evolution' },
]

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', ok ? 'bg-emerald-400' : 'bg-red-500')} />
  )
}

export function DashboardView() {
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null)
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [loadingDaemon, setLoadingDaemon] = useState(true)
  const { setActiveView, activeView: _ } = useUIStore()
  const { createSession, sessions } = useChatStore()
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#09090B]">
      <div className="border-b border-zinc-800/50 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Home className="w-4.5 h-4.5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-100">BertOS Dashboard</h1>
            <p className="text-xs text-zinc-500">Your AI creation operating system</p>
          </div>
          <Button size="sm" variant="ghost" onClick={fetchStatus} className="ml-auto">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 max-w-4xl">

          {/* Quick actions */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700 mb-3">Quick actions</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action.label}
                  onClick={() => {
                    if (action.view === 'chat') { createSession() }
                    navigate(action.view, action.href)
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all text-center group"
                >
                  <action.icon className="w-5 h-5 text-zinc-600 group-hover:text-violet-400 transition-colors" />
                  <span className="text-xs text-zinc-500 group-hover:text-zinc-200 transition-colors">{action.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Provider status */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700 mb-3">Provider status</p>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800/50">
              {loadingProviders ? (
                <div className="flex items-center gap-2 p-4 text-xs text-zinc-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking providers...
                </div>
              ) : providers.length === 0 ? (
                <div className="p-4 text-xs text-zinc-600">No provider status available. Is the daemon running?</div>
              ) : (
                providers.map(p => (
                  <div key={p.providerId} className="flex items-center gap-3 px-4 py-3">
                    <StatusDot ok={p.online} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-zinc-300 font-medium">{p.providerName}</span>
                      <span className="ml-2 text-[11px] text-zinc-600">{p.modelOrTool}</span>
                    </div>
                    <Badge
                      variant={p.online ? 'success' : 'error'}
                      className="text-[10px]"
                    >
                      {p.online ? 'online' : 'offline'}
                    </Badge>
                    {p.source && (
                      <span className="text-[10px] text-zinc-700">{p.source}</span>
                    )}
                    {p.error && (
                      <span className="text-[11px] text-red-400 truncate max-w-40" title={p.error}>{p.error}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Daemon + repo status */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700 mb-3">Local daemon</p>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              {loadingDaemon ? (
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking daemon...
                </div>
              ) : daemon ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <StatusDot ok={daemon.online} />
                    <span className={cn('text-sm font-medium', daemon.online ? 'text-zinc-200' : 'text-zinc-500')}>
                      {daemon.online ? 'Daemon online' : 'Daemon offline'}
                    </span>
                    {!daemon.online && (
                      <Badge variant="warning" className="text-[10px]">Run: npm run bertos:daemon</Badge>
                    )}
                  </div>

                  {daemon.repo && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <GitBranch className="w-3 h-3 text-zinc-600" />
                          <span className="text-[10px] text-zinc-600">Branch</span>
                        </div>
                        <span className="font-mono text-xs text-zinc-300">{daemon.repo.branch}</span>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          {daemon.repo.safeRepo
                            ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            : <AlertTriangle className="w-3 h-3 text-amber-400" />}
                          <span className="text-[10px] text-zinc-600">Repo safety</span>
                        </div>
                        <span className={cn('text-xs', daemon.repo.safeRepo ? 'text-emerald-400' : 'text-amber-400')}>
                          {daemon.repo.safeRepo ? 'Safe' : 'Not safe'}
                        </span>
                      </div>
                    </div>
                  )}

                  {daemon.tools && daemon.tools.length > 0 && (
                    <div>
                      <p className="text-[10px] text-zinc-700 mb-1.5">CLI tools</p>
                      <div className="flex flex-wrap gap-2">
                        {daemon.tools.map(tool => (
                          <div key={tool.id} className="flex items-center gap-1.5">
                            <StatusDot ok={tool.installed} />
                            <span className="text-xs text-zinc-500">{tool.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-zinc-600">Cannot reach daemon. Run: <code className="font-mono text-zinc-400">npm run bertos:daemon</code></div>
              )}
            </div>
          </section>

          {/* Integration scaffolds */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700 mb-3">Integrations</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { name: 'Hermes', desc: 'Remote runtime + schedules', envVars: ['HERMES_API_URL', 'HERMES_API_KEY'], route: '/api/hermes/status' },
                { name: 'Telegram', desc: 'Mobile control layer', envVars: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_CHAT_ID'], route: '/api/telegram/status' },
                { name: 'Composio', desc: 'Tool & app integrations', envVars: ['COMPOSIO_API_KEY'], route: '/api/tools/composio/status' },
              ].map(integration => (
                <IntegrationCard key={integration.name} {...integration} />
              ))}
            </div>
          </section>

          {/* Recent chats */}
          {sessions.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700 mb-3">Recent chats</p>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800/50">
                {sessions.slice(0, 5).map(session => (
                  <button
                    key={session.id}
                    onClick={() => { setActiveView('chat'); router.push('/chat') }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/4 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0" />
                    <span className="text-xs text-zinc-400 truncate">{session.title}</span>
                    <span className="text-[10px] text-zinc-700 ml-auto flex-shrink-0">
                      {session.messages.length} messages
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Keyboard shortcuts */}
          <section>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700 mb-3">Keyboard shortcuts</p>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 grid grid-cols-2 gap-2">
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
                  <kbd className="text-[10px] bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-800 font-mono">{key}</kbd>
                  <span className="text-xs text-zinc-600">{label}</span>
                </div>
              ))}
            </div>
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Zap className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-sm font-medium text-zinc-300">{name}</span>
        <div className="ml-auto">
          {status === 'loading' ? <Loader2 className="w-3 h-3 animate-spin text-zinc-700" />
            : status === 'configured' ? <StatusDot ok={true} />
            : <StatusDot ok={false} />}
        </div>
      </div>
      <p className="text-[11px] text-zinc-600 mb-2">{desc}</p>
      {status === 'missing' && (
        <div className="space-y-0.5">
          {envVars.map(v => (
            <div key={v} className="font-mono text-[10px] text-zinc-700">{v}</div>
          ))}
          <p className="text-[10px] text-zinc-700 mt-1">Set in .env.local to enable</p>
        </div>
      )}
      {status === 'configured' && (
        <Badge variant="success" className="text-[10px]">Configured</Badge>
      )}
    </div>
  )
}
