'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Brain, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Code2, Command,
  Inbox,
  Compass, Cpu, FlaskConical, Github, GitCompare, Hash, KanbanSquare, LayoutDashboard,
  Library, MessageSquare, Moon, PackageSearch, Plug, Plus, Send, Settings, ShieldCheck, Sparkles, Trash2, WandSparkles, Zap, Activity, Images,
  Rocket,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { getModelLabel } from '@/lib/bertos/router'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useProjectStore } from '@/store/bertos/projects'
import { ScrollArea } from '@/components/ui/scroll-area'
import { OperatorSigil, StatusOrb, XPMeter } from '@/components/bertos/hermes'
import { getRankProgress, useProgressionStore } from '@/store/bertos/progression'
import { usePathname, useRouter } from 'next/navigation'
import { getPrimaryAgentEngines, type AgentEngineId } from '@/lib/bertos/agent-engines'

const NAV_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Olympus', href: '/dashboard' },
  { id: 'chat', icon: MessageSquare, label: 'Oracle', href: '/chat' },
  { id: 'hermes', icon: Sparkles, label: 'Hermes', href: '/hermes' },
  { id: 'prompts', icon: Library, label: 'Prompts', href: '/prompts' },
  { id: 'compare', icon: GitCompare, label: 'Tribunal', href: '/compare' },
  { id: 'coding', icon: Zap, label: 'Forge', href: '/coding' },
  { id: 'max', icon: Moon, label: 'Max Mode', href: '/max' },
  { id: 'workspace', icon: Code2, label: 'Archive', href: '/workspace' },
  { id: 'evolution', icon: FlaskConical, label: 'Armory', href: '/evolution' },
  { id: 'agents', icon: Bot, label: 'Pantheon', href: '/agents' },
  { id: 'skills', icon: WandSparkles, label: 'Skills', href: '/skills' },
  { id: 'plugins', icon: Plug, label: 'Plugins', href: '/plugins' },
  { id: 'outputs', icon: PackageSearch, label: 'Outputs', href: '/outputs' },
  { id: 'runs', icon: Activity, label: 'Runs', href: '/runs' },
  { id: 'studio', icon: Images, label: 'Studio', href: '/studio' },
  { id: 'content-lab', icon: ClipboardList, label: 'Content Lab', href: '/content-lab' },
  { id: 'inbox-deals', icon: Inbox, label: 'Inbox / Deals', href: '/inbox-deals' },
  { id: 'publishing-queue', icon: Send, label: 'Publish', href: '/publishing-queue' },
  { id: 'memory', icon: Brain, label: 'Memory', href: '/memory' },
  { id: 'memory-review', icon: ShieldCheck, label: 'Memory Review', href: '/memory-review' },
  { id: 'brief', icon: CalendarDays, label: 'Brief', href: '/brief' },
  { id: 'playbooks', icon: ClipboardList, label: 'Doctrine', href: '/playbooks' },
  { id: 'tasks', icon: KanbanSquare, label: 'Tasks', href: '/tasks' },
  { id: 'migrations', icon: Compass, label: 'Migrations', href: '/migrations' },
  { id: 'github', icon: Github, label: 'Repo', href: '/github' },
  { id: 'autopilot', icon: Cpu, label: 'Autopilot', href: '/autopilot' },
  { id: 'launch', icon: Rocket, label: 'Launch', href: '/launch' },
] as const

const ENGINE_ICONS: Record<AgentEngineId, typeof Sparkles> = {
  bertos: Sparkles,
  codex: Zap,
  claude: Cpu,
  gemini: Compass,
  'gemini-native': Compass,
  ollama: Bot,
  hermes: Sparkles,
  openclaw: Bot,
  qwen: Bot,
  openai: Zap,
}

const ENGINE_LOGOS: Partial<Record<AgentEngineId, string>> = {
  codex: '/brand-icons/codex.svg',
  claude: '/brand-icons/claude.svg',
  gemini: '/brand-icons/gemini.svg',
  ollama: '/brand-icons/ollama.svg',
  hermes: '/brand-icons/hermes.svg',
}

const ENGINE_NAV_ITEMS = getPrimaryAgentEngines()

interface SidebarProps {
  isMobile?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ isMobile = false, onMobileClose }: SidebarProps) {
  const { sidebarCollapsed, setSidebarCollapsed, activeView, setActiveView, setCommandPaletteOpen } = useUIStore()
  const { sessions, activeSessionId, setActiveSession, getOrCreateSession, deleteSession } = useChatStore()
  const { projects, activeProjectId, setActiveProject } = useProjectStore()
  const { operatorName, xp, relayStreak } = useProgressionStore()
  const router = useRouter()
  const pathname = usePathname()
  const [hoveredSession, setHoveredSession] = useState<string | null>(null)
  const collapsed = isMobile ? false : sidebarCollapsed
  const rank = getRankProgress(xp)

  const navigate = (id: typeof NAV_ITEMS[number]['id'], href: string) => {
    setActiveView(id)
    router.push(href)
    onMobileClose?.()
  }

  const recentSessions = sessions
    .filter(session => session.messages.some(message => message.role === 'user') || session.id === activeSessionId)
    .slice(0, 10)

  const sessionTitle = (session: typeof sessions[number]) => {
    if (session.title && session.title !== 'New Chat') return session.title
    return session.messages.find(message => message.role === 'user')?.content.slice(0, 56) || (session.id === activeSessionId ? 'Active draft' : 'Untitled thread')
  }
  const sessionPreview = (session: typeof sessions[number]) =>
    [...session.messages].reverse().find(message => message.content.trim())?.content.replace(/\s+/g, ' ').slice(0, 72) || 'Awaiting first prompt'
  const sessionTime = (timestamp: number) => {
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
    if (minutes < 1) return 'now'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`
  }
  const renderEngineNav = (
    <div className="space-y-0.5">
      {!collapsed && (
        <div className="flex items-center gap-2 px-2 pb-1.5 pt-1">
          <span className="block h-px flex-1 bg-cyan-300/14" />
          <p className="text-[9px] font-semibold uppercase tracking-[0.32em] text-cyan-100/55">Engines</p>
          <span className="block h-px flex-1 bg-cyan-300/14" />
        </div>
      )}
      {ENGINE_NAV_ITEMS.map(engine => {
        const EngineIcon = ENGINE_ICONS[engine.id]
        const isActive = pathname === engine.route || pathname.startsWith(`${engine.route}/`)
        return (
          <button
            key={engine.id}
            title={engine.label}
            onClick={() => {
              setActiveView('agents')
              router.push(engine.route)
              onMobileClose?.()
            }}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-sm transition',
              !isActive && 'hover:bg-white/5',
              collapsed && 'justify-center',
            )}
            style={{
              borderColor: isActive ? engine.theme.border : 'rgba(255,255,255,0.06)',
              background: isActive ? engine.theme.surface2 : 'transparent',
              color: isActive ? engine.theme.text : engine.theme.muted,
              boxShadow: isActive ? `0 0 18px ${engine.theme.shadow}` : undefined,
            }}
          >
            <span
              className="grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[9px] font-black"
              style={{
                borderColor: engine.theme.border,
                background: `linear-gradient(135deg, ${engine.theme.accent}22, ${engine.theme.accent2}14)`,
                color: engine.theme.accent,
              }}
            >
              {ENGINE_LOGOS[engine.id] ? (
                <img src={ENGINE_LOGOS[engine.id]} alt="" className="h-[18px] w-[18px] rounded-[4px]" />
              ) : (
                <EngineIcon className="h-3 w-3" />
              )}
            </span>
            {!collapsed && <span className="text-xs font-medium">{engine.shortLabel}</span>}
            {engine.paidGated && !collapsed && <span className="ml-auto rounded border px-1 py-0.5 text-[8px] uppercase" style={{ borderColor: engine.theme.border, color: engine.theme.accent }}>paid</span>}
          </button>
        )
      })}
    </div>
  )

  const inner = (
    <>
      <div className="shrink-0 border-b border-[rgba(212,180,131,0.12)] px-3 py-4">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(212,180,131,0.28)] bg-[rgba(212,180,131,0.08)] shadow-[0_0_22px_rgba(212,180,131,0.14)]">
              <Zap className="h-4 w-4 text-[#D4B483]" />
            </div>
            <span className="absolute -bottom-1 -right-1"><StatusOrb state="active" size="sm" /></span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="min-w-0">
                <p className="text-sm font-bold leading-none tracking-tight text-hermes-gradient">BERTOS</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[rgba(103,232,249,0.62)]">Olympus Core</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="shrink-0 border-b border-[rgba(212,180,131,0.10)] px-2 py-3">
        {collapsed ? (
          <div className="flex justify-center">
            <OperatorSigil name={operatorName} rank={rank.current.title} size="sm" />
          </div>
        ) : (
          <div className="rounded-xl border border-[rgba(212,180,131,0.16)] bg-[rgba(10,8,5,0.52)] p-3">
            <div className="mb-3 flex items-center gap-3">
              <OperatorSigil name={operatorName} rank={rank.current.title} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-[#F0E8D0]">{operatorName}</div>
                <div className="text-[10px] uppercase tracking-[0.20em] text-[#D4B483]">{rank.current.title}</div>
              </div>
              <div className="ml-auto text-right text-[10px] text-[#6A5A3A]">
                <div>{xp} XP</div>
                <div>{relayStreak}d relay</div>
              </div>
            </div>
            <XPMeter xp={xp} rank={rank.current.title} nextRank={rank.next.title} progress={rank.progress} compact />
          </div>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 px-2 py-3">
          <button
            title="Command Palette"
            onClick={() => setCommandPaletteOpen(true)}
            className={cn('flex w-full items-center gap-2.5 rounded-lg border border-[rgba(212,180,131,0.12)] px-2 py-1.5 text-xs text-[#6A5A3A] transition hover:border-[rgba(212,180,131,0.28)] hover:text-[#D4B483]', collapsed && 'justify-center')}
          >
            <Command className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <><span className="flex-1 text-left">Command search</span><kbd className="rounded border border-[rgba(212,180,131,0.12)] bg-[#0A0806] px-1 py-0.5 text-[9px] text-[#5A4A2A]">CTRL K</kbd></>}
          </button>

          <button
            title="New Chat"
            onClick={() => { getOrCreateSession(); setActiveView('chat'); router.push('/chat'); onMobileClose?.() }}
            className={cn('flex w-full items-center gap-2.5 rounded-lg border border-[rgba(212,180,131,0.25)] bg-[rgba(212,180,131,0.08)] px-2 py-2 text-xs font-medium text-[#D4B483] transition hover:border-[rgba(212,180,131,0.40)] hover:bg-[rgba(212,180,131,0.12)]', collapsed && 'justify-center')}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>New oracle thread</span>}
          </button>

          {renderEngineNav}

          <div className="space-y-0.5">
            {!collapsed && (
              <div className="flex items-center gap-2 px-2 pb-1.5">
                <span className="block h-px flex-1 bg-[rgba(212,180,131,0.18)]" />
                <p className="text-[9px] font-semibold uppercase tracking-[0.32em] text-[rgba(212,180,131,0.50)]">Navigation</p>
                <span className="block h-px flex-1 bg-[rgba(212,180,131,0.18)]" />
              </div>
            )}
            {NAV_ITEMS.map(item => {
              const isActive = activeView === item.id || pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.id === 'coding' && pathname === '/builder')
              return (
                <button
                  key={item.id}
                  title={item.label}
                  onClick={() => navigate(item.id, item.href)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition',
                    isActive
                      ? 'bg-[rgba(212,180,131,0.10)] text-[#D4B483] shadow-[inset_0_0_0_1px_rgba(212,180,131,0.22)]'
                      : 'text-[#6A5A3A] hover:bg-[rgba(212,180,131,0.06)] hover:text-[#D4B483]',
                    collapsed && 'justify-center',
                  )}
                >
                  <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-[#D4B483]')} />
                  {!collapsed && <span className="text-xs font-medium">{item.label}</span>}
                  {isActive && !collapsed && <span className="ml-auto h-1 w-1 rotate-45 bg-[#D4B483] shadow-[0_0_8px_rgba(212,180,131,0.80)]" />}
                </button>
              )
            })}
          </div>

          {!collapsed && projects.length > 0 && (
            <div>
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/45">Projects</p>
              <div className="space-y-0.5">
                {projects.slice(0, 5).map(project => (
                  <button
                    key={project.id}
                    onClick={() => setActiveProject(project.id)}
                    className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition', activeProjectId === project.id ? 'bg-amber-300/10 text-amber-100' : 'text-zinc-500 hover:bg-white/4 hover:text-zinc-300')}
                  >
                    <span>{project.icon}</span>
                    <span className="flex-1 truncate text-left font-medium">{project.name}</span>
                    {activeProjectId === project.id && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!collapsed && recentSessions.length > 0 && (
            <div>
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/45">Recent oracles</p>
              <div className="space-y-1.5">
                {recentSessions.map(session => (
                  <div key={session.id} className="relative group" onMouseEnter={() => setHoveredSession(session.id)} onMouseLeave={() => setHoveredSession(null)}>
                    <button
                      onClick={() => { setActiveSession(session.id); setActiveView('chat'); router.push('/chat'); onMobileClose?.() }}
                      className={cn('flex w-full items-start gap-2 rounded-xl border px-2 py-2 pr-8 text-xs transition', activeSessionId === session.id ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100' : 'border-cyan-300/8 bg-slate-950/45 text-zinc-500 hover:border-cyan-300/20 hover:text-zinc-300')}
                    >
                      <Hash className="mt-0.5 h-3 w-3 shrink-0 opacity-50" />
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate font-medium">{sessionTitle(session)}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-zinc-600">{sessionPreview(session)}</span>
                        <span className="mt-1 flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-zinc-700">
                          <span>{getModelLabel(session.model)}</span><span>/</span><span>{sessionTime(session.updatedAt)}</span>
                          {session.messages.some(message => message.streaming) && <span className="text-cyan-300">streaming</span>}
                        </span>
                      </span>
                    </button>
                    {hoveredSession === session.id && (
                      <button onClick={e => { e.stopPropagation(); deleteSession(session.id) }} className="absolute right-1.5 top-2 rounded p-1 text-zinc-700 transition hover:bg-red-500/10 hover:text-red-300">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="shrink-0 space-y-0.5 border-t border-cyan-300/10 p-2">
        <button
          title="Settings"
          onClick={() => { setActiveView('settings'); router.push('/settings'); onMobileClose?.() }}
          className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-xs transition', activeView === 'settings' || pathname === '/settings' || pathname.startsWith('/settings/') ? 'bg-cyan-300/10 text-cyan-100' : 'text-zinc-500 hover:bg-white/5 hover:text-cyan-100', collapsed && 'justify-center')}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>
        {!isMobile && (
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] text-zinc-700 transition hover:bg-white/5 hover:text-zinc-500', collapsed ? 'justify-center' : 'justify-between')}>
            {!collapsed && <span>Collapse</span>}
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </>
  )

  if (isMobile) {
    return <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-[rgba(246,196,83,0.16)] bg-[#05030A]/96">{inner}</div>
  }

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 58 : 248 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative z-20 flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-[rgba(246,196,83,0.16)] bg-[#05030A]/68 shadow-[18px_0_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
    >
      <div className="hermes-grid-fine pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[rgba(246,196,83,0.50)] to-transparent" />
      <div className="pointer-events-none absolute -left-20 top-20 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(103,232,249,0.14),transparent_65%)]" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{inner}</div>
    </motion.aside>
  )
}
