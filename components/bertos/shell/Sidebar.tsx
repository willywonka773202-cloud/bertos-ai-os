'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, GitCompare, Code2, Bot, Brain, Settings, FlaskConical,
  Plus, ChevronLeft, ChevronRight, Zap, Command, Trash2,
  Terminal, Home, Github, Power,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useProjectStore } from '@/store/bertos/projects'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useRouter } from 'next/navigation'
import { StatusOrb } from '@/components/bertos/hermes'

const NAV_ITEMS = [
  { id: 'dashboard', icon: Home,          label: 'Mission Control', short: 'Dashboard', href: '/dashboard' },
  { id: 'chat',      icon: MessageSquare, label: 'Oracle Chat',     short: 'Chat',      href: '/chat'      },
  { id: 'coding',    icon: Terminal,      label: 'Forge',           short: 'Coding',    href: '/coding'    },
  { id: 'workspace', icon: Code2,         label: 'Workspace',       short: 'Workspace', href: '/workspace' },
  { id: 'compare',   icon: GitCompare,    label: 'Pantheon',        short: 'Compare',   href: '/compare'   },
  { id: 'evolution', icon: FlaskConical,  label: 'Evolution Lab',   short: 'Evolution', href: '/evolution' },
  { id: 'agents',    icon: Bot,           label: 'Agent Legion',    short: 'Agents',    href: '/agents'    },
  { id: 'autopilot', icon: Power,         label: 'Autopilot',       short: 'Autopilot', href: '/autopilot' },
  { id: 'memory',    icon: Brain,         label: 'Temple of Memory',short: 'Memory',    href: '/memory'    },
  { id: 'github',    icon: Github,        label: 'GitHub',          short: 'GitHub',    href: '/github'    },
] as const

interface SidebarProps {
  isMobile?: boolean
  onMobileClose?: () => void
}

export function Sidebar({ isMobile = false, onMobileClose }: SidebarProps) {
  const { sidebarCollapsed, setSidebarCollapsed, activeView, setActiveView, setCommandPaletteOpen, selectedModel } = useUIStore()
  const { sessions, activeSessionId, isStreaming, setActiveSession, getOrCreateSession, deleteSession } = useChatStore()
  const { projects, activeProjectId, setActiveProject } = useProjectStore()
  const router = useRouter()
  const [hoveredSession, setHoveredSession] = useState<string | null>(null)

  const collapsed = isMobile ? false : sidebarCollapsed

  const navigate = (id: typeof NAV_ITEMS[number]['id'], href: string) => {
    setActiveView(id)
    router.push(href)
    onMobileClose?.()
  }

  // Hide ghost empty sessions from display but always keep the active session visible
  const displaySessions = sessions.filter(s =>
    s.id === activeSessionId || s.messages.some(m => m.role === 'user')
  )

  const startNewChat = () => {
    const s = getOrCreateSession(selectedModel)
    setActiveSession(s.id)
    setActiveView('chat')
    router.push('/chat')
    onMobileClose?.()
  }

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60_000) return 'now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
    return `${Math.floor(diff / 86_400_000)}d`
  }

  const inner = (
    <>
      {/* Logo / brand */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b border-cyan-500/15 flex-shrink-0 relative">
        <div className="relative flex-shrink-0">
          <motion.div
            animate={{
              boxShadow: [
                '0 0 14px rgba(34,211,238,0.4), inset 0 0 10px rgba(217,119,6,0.15)',
                '0 0 24px rgba(34,211,238,0.6), inset 0 0 16px rgba(217,119,6,0.25)',
                '0 0 14px rgba(34,211,238,0.4), inset 0 0 10px rgba(217,119,6,0.15)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 via-cyan-600 to-amber-600 flex items-center justify-center border border-cyan-300/40"
          >
            <Zap className="w-4 h-4 text-white drop-shadow" />
          </motion.div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#05080F]" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="min-w-0"
            >
              <p className="text-sm font-bold text-cyan-50 tracking-tight leading-none">
                <span className="text-bronze-gradient">BERT</span>
                <span className="text-cyan-300">OS</span>
              </p>
              <p className="text-[9px] text-cyan-100/40 leading-none mt-1 uppercase tracking-[0.2em]">Mission Control</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 py-3 space-y-1">
          {/* Command palette */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-cyan-100/50 hover:text-cyan-200 hover:bg-cyan-500/5 transition-all duration-150 border border-cyan-500/10 hover:border-cyan-500/30',
                  collapsed && 'justify-center'
                )}
              >
                <Command className="w-3.5 h-3.5 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">Command Palette</span>
                    <kbd className="text-[9px] bg-cyan-500/10 text-cyan-300 px-1 py-0.5 rounded border border-cyan-500/20 font-mono">⌘K</kbd>
                  </>
                )}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">Command Palette (⌘K)</TooltipContent>}
          </Tooltip>

          {/* New chat — reuses empty session */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={startNewChat}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs text-amber-200 hover:text-amber-100 transition-all duration-150',
                  'border border-amber-600/30 hover:border-amber-500/60',
                  'bg-amber-600/5 hover:bg-amber-600/10',
                  'shadow-[inset_0_0_10px_rgba(217,119,6,0.08)]',
                  collapsed && 'justify-center'
                )}
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                {!collapsed && <span className="font-semibold tracking-wide">New Mission</span>}
              </button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">New chat</TooltipContent>}
          </Tooltip>

          {/* Nav items */}
          <div className="pt-3 space-y-0.5">
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-cyan-300/40">
                Console
              </p>
            )}
            {NAV_ITEMS.map(item => {
              const isActive = activeView === item.id
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(item.id, item.href)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-all duration-150 relative',
                        isActive
                          ? 'bg-cyan-500/10 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.3),0_0_12px_rgba(34,211,238,0.15)]'
                          : 'text-cyan-100/45 hover:text-cyan-100 hover:bg-cyan-500/[0.04]',
                        collapsed && 'justify-center'
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="nav-active-bar"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-gradient-to-b from-cyan-300 to-amber-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                        />
                      )}
                      <item.icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-cyan-300')} />
                      {!collapsed && <span className="text-xs font-medium truncate">{item.label}</span>}
                      {isActive && !collapsed && <div className="ml-auto w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />}
                    </button>
                  </TooltipTrigger>
                  {collapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
                </Tooltip>
              )
            })}
          </div>

          {/* Projects */}
          {!collapsed && projects.length > 0 && (
            <div className="pt-3">
              <p className="px-2 pb-1.5 text-[9px] font-bold uppercase tracking-[0.25em] text-cyan-300/40">Projects</p>
              <div className="space-y-0.5">
                {projects.slice(0, 5).map(project => (
                  <button
                    key={project.id}
                    onClick={() => setActiveProject(project.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all duration-150',
                      activeProjectId === project.id
                        ? 'bg-cyan-500/8 text-cyan-200'
                        : 'text-cyan-100/45 hover:text-cyan-200 hover:bg-cyan-500/[0.04]'
                    )}
                  >
                    <span className="text-sm leading-none">{project.icon}</span>
                    <span className="flex-1 text-left truncate font-medium">{project.name}</span>
                    {activeProjectId === project.id && <div className="w-1 h-1 rounded-full" style={{ background: project.color }} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent chats — real titles + previews + status */}
          {!collapsed && displaySessions.length > 0 && (
            <div className="pt-3">
              <div className="flex items-center justify-between px-2 pb-1.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-cyan-300/40">Recent Threads</p>
                <span className="text-[9px] text-cyan-100/30 font-mono">{displaySessions.length}</span>
              </div>
              <div className="space-y-0.5">
                {displaySessions.slice(0, 10).map(session => {
                  const isActive = activeSessionId === session.id
                  const isStreamingHere = isActive && isStreaming
                  const hasMessages = session.messages.length > 0
                  const lastMsg = session.messages[session.messages.length - 1]
                  const title = session.title && session.title !== 'New Chat'
                    ? session.title
                    : (hasMessages ? 'Untitled' : 'Draft')
                  return (
                    <div
                      key={session.id}
                      className="relative group"
                      onMouseEnter={() => setHoveredSession(session.id)}
                      onMouseLeave={() => setHoveredSession(null)}
                    >
                      <button
                        onClick={() => { setActiveSession(session.id); setActiveView('chat'); router.push('/chat'); onMobileClose?.() }}
                        className={cn(
                          'w-full flex items-start gap-2 px-2 py-2 rounded-lg text-xs transition-all duration-150 pr-8 text-left relative',
                          isActive
                            ? 'bg-cyan-500/10 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]'
                            : 'text-cyan-100/55 hover:text-cyan-100 hover:bg-cyan-500/[0.04]'
                        )}
                      >
                        <div className="flex-shrink-0 pt-0.5">
                          {isStreamingHere
                            ? <StatusOrb state="active" size="sm" />
                            : isActive
                              ? <StatusOrb state="nominal" size="sm" />
                              : <span className="block w-2 h-2 rounded-full border border-cyan-500/30" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('truncate font-medium', isActive ? 'text-cyan-100' : 'text-cyan-100/70')}>{title}</span>
                            {isStreamingHere && <span className="text-[9px] text-cyan-300 uppercase tracking-wider">live</span>}
                          </div>
                          {lastMsg && (
                            <p className="text-[10px] text-cyan-100/35 truncate mt-0.5">
                              {lastMsg.role === 'user' ? 'You: ' : '→ '}
                              {lastMsg.content.replace(/\s+/g, ' ').slice(0, 38) || (hasMessages ? '...' : 'no messages yet')}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-cyan-100/30 font-mono">{session.model}</span>
                            <span className="text-[9px] text-cyan-100/20">·</span>
                            <span className="text-[9px] text-cyan-100/30 font-mono">{formatTime(session.updatedAt)}</span>
                            {session.messages.length > 0 && (
                              <>
                                <span className="text-[9px] text-cyan-100/20">·</span>
                                <span className="text-[9px] text-cyan-100/30 font-mono">{session.messages.length}m</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                      {hoveredSession === session.id && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteSession(session.id) }}
                          className="absolute right-1.5 top-2 p-1 rounded text-cyan-100/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Bottom actions */}
      <div className="border-t border-cyan-500/15 p-2 space-y-0.5 flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => { setActiveView('settings'); router.push('/settings'); onMobileClose?.() }}
              className={cn(
                'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs transition-all duration-150',
                activeView === 'settings'
                  ? 'text-cyan-200 bg-cyan-500/10 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]'
                  : 'text-cyan-100/45 hover:text-cyan-100 hover:bg-cyan-500/[0.04]',
                collapsed && 'justify-center'
              )}
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>Edicts & Settings</span>}
            </button>
          </TooltipTrigger>
          {collapsed && <TooltipContent side="right">Settings</TooltipContent>}
        </Tooltip>

        {!isMobile && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] text-cyan-100/30 hover:text-cyan-300 hover:bg-cyan-500/[0.04] transition-all duration-150',
              collapsed ? 'justify-center' : 'justify-between'
            )}
          >
            {!collapsed && <span className="uppercase tracking-wider">Collapse</span>}
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </>
  )

  if (isMobile) {
    return (
      <div className="relative flex h-full w-full flex-col bg-[#05080F]/95 border-r border-cyan-500/15 overflow-hidden">
        <div className="absolute inset-0 hermes-grid pointer-events-none opacity-30" />
        <div className="relative flex flex-col h-full w-full">{inner}</div>
      </div>
    )
  }

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 56 : 232 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex h-full flex-col bg-[#05080F]/85 backdrop-blur-xl border-r border-cyan-500/15 overflow-hidden z-10 flex-shrink-0"
    >
      <div className="absolute inset-0 hermes-grid pointer-events-none opacity-30" />
      <div className="relative flex flex-col h-full">{inner}</div>
    </motion.aside>
  )
}
