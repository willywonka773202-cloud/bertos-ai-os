'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Brain, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Code2, Command,
  Compass, Cpu, FlaskConical, Github, GitCompare, Hash, KanbanSquare, LayoutDashboard,
  Library, MessageSquare, Plus, Settings, Trash2, Zap,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { getModelLabel } from '@/lib/bertos/router'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useProjectStore } from '@/store/bertos/projects'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StatusOrb } from '@/components/bertos/hermes'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Mission', href: '/dashboard' },
  { id: 'chat', icon: MessageSquare, label: 'Oracle', href: '/chat' },
  { id: 'prompts', icon: Library, label: 'Prompts', href: '/prompts' },
  { id: 'compare', icon: GitCompare, label: 'Tribunal', href: '/compare' },
  { id: 'coding', icon: Zap, label: 'Forge', href: '/coding' },
  { id: 'workspace', icon: Code2, label: 'Deck', href: '/workspace' },
  { id: 'evolution', icon: FlaskConical, label: 'Armory', href: '/evolution' },
  { id: 'agents', icon: Bot, label: 'Legion', href: '/agents' },
  { id: 'memory', icon: Brain, label: 'Memory', href: '/memory' },
  { id: 'brief', icon: CalendarDays, label: 'Brief', href: '/brief' },
  { id: 'playbooks', icon: ClipboardList, label: 'Doctrine', href: '/playbooks' },
  { id: 'tasks', icon: KanbanSquare, label: 'Tasks', href: '/tasks' },
  { id: 'migrations', icon: Compass, label: 'Migrations', href: '/migrations' },
  { id: 'github', icon: Github, label: 'Repo', href: '/github' },
  { id: 'autopilot', icon: Cpu, label: 'Autopilot', href: '/autopilot' },
] as const

interface SidebarProps {
  isMobile?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ isMobile = false, onMobileClose }: SidebarProps) {
  const { sidebarCollapsed, setSidebarCollapsed, activeView, setActiveView, setCommandPaletteOpen } = useUIStore()
  const { sessions, activeSessionId, setActiveSession, getOrCreateSession, deleteSession } = useChatStore()
  const { projects, activeProjectId, setActiveProject } = useProjectStore()
  const router = useRouter()
  const [hoveredSession, setHoveredSession] = useState<string | null>(null)
  const collapsed = isMobile ? false : sidebarCollapsed

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

  const inner = (
    <>
      <div className="shrink-0 border-b border-cyan-300/10 px-3 py-4">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_28px_rgba(34,211,238,0.16)]">
              <Zap className="h-4 w-4 text-cyan-100" />
            </div>
            <span className="absolute -bottom-1 -right-1"><StatusOrb state="active" size="sm" /></span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="min-w-0">
                <p className="text-sm font-bold leading-none tracking-tight text-hermes-gradient">BertOS</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-amber-200/55">Roman Hermes</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 px-2 py-3">
          <button
            title="Command Palette"
            onClick={() => setCommandPaletteOpen(true)}
            className={cn('flex w-full items-center gap-2.5 rounded-lg border border-cyan-300/10 px-2 py-1.5 text-xs text-zinc-500 transition hover:border-cyan-300/30 hover:text-cyan-100', collapsed && 'justify-center')}
          >
            <Command className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <><span className="flex-1 text-left">Command search</span><kbd className="rounded border border-cyan-300/10 bg-slate-900 px-1 py-0.5 text-[9px] text-zinc-600">CTRL K</kbd></>}
          </button>

          <button
            title="New Chat"
            onClick={() => { getOrCreateSession(); setActiveView('chat'); router.push('/chat'); onMobileClose?.() }}
            className={cn('flex w-full items-center gap-2.5 rounded-lg border border-cyan-300/20 bg-cyan-300/8 px-2 py-2 text-xs font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/12', collapsed && 'justify-center')}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>New oracle thread</span>}
          </button>

          <div className="space-y-0.5">
            {!collapsed && <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/45">Navigation</p>}
            {NAV_ITEMS.map(item => {
              const isActive = activeView === item.id
              return (
                <button
                  key={item.id}
                  title={item.label}
                  onClick={() => navigate(item.id, item.href)}
                  className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition', isActive ? 'bg-cyan-300/10 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.18)]' : 'text-zinc-500 hover:bg-white/4 hover:text-cyan-100', collapsed && 'justify-center')}
                >
                  <item.icon className={cn('h-4 w-4 shrink-0', isActive && 'text-cyan-300')} />
                  {!collapsed && <span className="text-xs font-medium">{item.label}</span>}
                  {isActive && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />}
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
          className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-xs transition', activeView === 'settings' ? 'bg-cyan-300/10 text-cyan-100' : 'text-zinc-500 hover:bg-white/5 hover:text-cyan-100', collapsed && 'justify-center')}
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
    return <div className="relative flex h-full w-full flex-col overflow-hidden border-r border-cyan-300/10 bg-slate-950/96">{inner}</div>
  }

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 58 : 248 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative z-20 flex h-full shrink-0 flex-col overflow-hidden border-r border-cyan-300/10 bg-slate-950/78 backdrop-blur-xl"
    >
      <div className="hermes-grid-fine pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{inner}</div>
    </motion.aside>
  )
}
