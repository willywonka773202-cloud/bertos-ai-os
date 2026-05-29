'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, Zap, Clock, CheckCircle2, XCircle, AlertCircle,
  FolderOpen, MessageSquare, Code2, Server,
  Sparkles, GitBranch, Terminal, Box, Bot, Library, Scale, Cpu,
  CalendarDays, ClipboardList, ShieldCheck, KanbanSquare, Compass,
  Github, Send, Radio, Smartphone,
} from 'lucide-react'
import { useProjectStore } from '@/store/bertos/projects'
import { useChatStore } from '@/store/bertos/chat'
import { useUIStore } from '@/store/bertos/ui'
import { useAgentStore } from '@/store/bertos/agents'
import { usePromptStore } from '@/store/bertos/prompts'
import { useAutomationStore } from '@/store/bertos/automations'
import { useDaemonHealth } from '@/hooks/useDaemonHealth'
import { DaemonHealthBanner } from '@/components/bertos/shell/DaemonHealthBanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/bertos/cn'
import { useRouter } from 'next/navigation'
import type { AutomationRun } from '@/lib/bertos/types'
import { AGENT_ROSTER } from '@/lib/bertos/command-center'
import { SelfCodingSafetyContract } from '@/components/bertos/shared/SelfCodingSafetyContract'
import { AGENT_TEAMS } from '@/lib/bertos/agent-teams'
import { VisionConceptPanel } from '@/components/bertos/dashboard/VisionConceptPanel'
import { RecentOutputRail } from '@/components/bertos/dashboard/RecentOutputRail'
import { HERMES_ROUTE_STATUS } from '@/lib/bertos/hermes-theme'
import {
  AchievementChip,
  ChamberCard,
  CommandCore,
  EmptyChamber,
  HermesPowerPanel,
  HologramPanel,
  LoadingRelay,
  MissionArena,
  MissionCard,
  OlympianInterfaceIdeas,
  ProofOfWorkPanel,
  ProviderBadge,
  RouteHero,
  StatusOrb,
} from '@/components/bertos/hermes'
import {
  PRAETORIUM_ACHIEVEMENTS,
  PRAETORIUM_MISSIONS,
  getRankProgress,
  useProgressionStore,
} from '@/store/bertos/progression'
import { AIIntegrationOrbit, BrandSigil, OraclePanel } from '@/components/bertos/olympus'
import { fetchLocalDaemonBridge } from '@/lib/bertos/browser-daemon'
import { fetchBrowserAwareProviderStatus } from '@/lib/bertos/provider-status-client'

interface ProviderStatus {
  id: string
  name: string
  status: string
  latency?: number
  message?: string
}

interface TelegramRemoteEvent {
  id: string
  type: 'incoming' | 'reply' | 'running' | 'completed' | 'failed' | 'ignored'
  timestamp: number
  chatId?: string
  command?: string
  text?: string
  detail?: string
}

interface TelegramRemoteState {
  ok: boolean
  configured: boolean
  communicable?: boolean
  chatEnabled: boolean
  plainLocalChatEnabled?: boolean
  webhookSecretConfigured: boolean
  webhookEndpoint: string
  webhook?: {
    reachable: boolean
    connected: boolean
    webhookHost?: string
    pendingUpdateCount?: number
    lastErrorMessage?: string
    error?: string
  }
  supportedCommands: string[]
  remote: {
    events: TelegramRemoteEvent[]
    lastCommand?: string
    lastSeenAt?: number
  }
  safety: string
}

export function DashboardView() {
  const { projects, activeProjectId, setActiveProject } = useProjectStore()
  const { sessions, getOrCreateSession } = useChatStore()
  const { setActiveView, selectedModel, setPendingAgentTask } = useUIStore()
  const { tasks: agentTasks } = useAgentStore()
  const { prompts } = usePromptStore()
  const { rules: automationRules, runs: automationRuns } = useAutomationStore()
  const { health: daemonHealth, loading: daemonHealthLoading, refresh: refreshDaemonHealth } = useDaemonHealth()
  const router = useRouter()
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [repoStatus, setRepoStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [runningCmd, setRunningCmd] = useState<string | null>(null)
  const [cmdResult, setCmdResult] = useState<{ cmd: string; ok: boolean; output: string } | null>(null)
  const [telegramRemote, setTelegramRemote] = useState<TelegramRemoteState | null>(null)
  const { operatorName, xp, relayStreak, actionCounts, unlockedAchievements, recordAction } = useProgressionStore()

  useEffect(() => {
    let mounted = true
    async function loadDashboardData() {
      setLoading(true)
      try {
        const [providersRes, repoRes] = await Promise.allSettled([
          fetchBrowserAwareProviderStatus(),
          fetchLocalDaemonBridge('/api/local-daemon/repo/status')
        ])

        if (!mounted) return

        if (providersRes.status === 'fulfilled') {
          setProviders(providersRes.value.providers || [])
        }
        
        if (repoRes.status === 'fulfilled' && repoRes.value.ok) {
          const repoData = await repoRes.value.json()
          setRepoStatus(repoData)
        }
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadDashboardData()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined

    async function loadTelegramRemote() {
      try {
        const res = await fetch('/api/telegram/remote', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setTelegramRemote(data)
      } catch {
        if (!cancelled) setTelegramRemote(null)
      }
    }

    loadTelegramRemote()
    timer = setInterval(loadTelegramRemote, 3000)
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [])

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId])
  const realSessions = useMemo(() => sessions.filter(session => session.messages.some(message => message.role === 'user')), [sessions])
  const recentSessions = useMemo(() => realSessions.slice(-5).reverse(), [realSessions])
  const chatStreaming = useMemo(() => sessions.some(session => session.messages.some(message => message.streaming)), [sessions])
  
  const providerStats = useMemo(() => {
    const online = providers.filter(p => p.status === 'online')
    const offline = providers.filter(p => p.status === 'offline')
    const byId = new Map(providers.map(provider => [provider.id, provider]))
    return { online, offline, byId }
  }, [providers])

  const agentStats = useMemo(() => {
    const done = agentTasks.filter(t => t.status === 'done').length
    const running = agentTasks.filter(t => t.status === 'running').length
    return { done, running, total: agentTasks.length }
  }, [agentTasks])

  const automationStats = useMemo(() => {
    const enabled = automationRules.filter(rule => rule.enabled).length
    const needsApproval = automationRuns.filter(run => run.status === 'needs-approval').length
    const running = automationRuns.filter(run => run.status === 'running').length
    return { enabled, needsApproval, running, total: automationRuns.length, recent: automationRuns.slice(0, 5) }
  }, [automationRules, automationRuns])

  const daemonOnline = Boolean(daemonHealth?.daemonOnline)
  const hermesProvider = providerStats.byId.get('hermes-nous')
  const rank = getRankProgress(xp)

  const featuredTeams = useMemo(
    () => AGENT_TEAMS.filter(team =>
      ['coding-team', 'content-team', 'daily-chief-of-staff-team', 'bertos-maintenance-team'].includes(team.id)
    ),
    [],
  )
  
  const nextAction = daemonOnline
    ? 'Open Builder and compile a scoped mission, then run typecheck/build from the safe daemon.'
    : 'Start npm run bertos:daemon to unlock local CLI agents, validation checks, and workspace file operations.'

  const handleNewChat = () => {
    getOrCreateSession(selectedModel)
    setActiveView('chat')
    router.push('/chat')
  }

  const handleOpenProject = (projectId: string) => {
    setActiveProject(projectId)
    setActiveView('workspace')
    router.push('/workspace')
  }

  const handleStartAgentRun = () => {
    setPendingAgentTask({ title: 'New Agent Task', description: '' })
    setActiveView('agents')
    router.push('/agents')
  }

  const navigateTo = (
    view: Parameters<typeof setActiveView>[0],
    href: string,
  ) => {
    setActiveView(view)
    router.push(href)
  }

  const handleRunCmd = async (cmd: 'typecheck' | 'build') => {
    if (!daemonOnline) {
      setCmdResult({
        cmd,
        ok: false,
        output: 'Local daemon is offline. Start it with npm run bertos:daemon from C:\\Users\\owner\\bertos-ai-os.',
      })
      return
    }
    setRunningCmd(cmd)
    setCmdResult(null)
    try {
      const res = await fetchLocalDaemonBridge('/api/local-daemon/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executable: 'npm', args: ['run', cmd], timeoutMs: 120000 }),
      })
      const data = await res.json()
      setCmdResult({
        cmd,
        ok: data.exitCode === 0,
        output: (data.stdout || '') + (data.stderr || '') || data.error || 'Done',
      })
      if (data.exitCode === 0) recordAction('validation-passed')
    } catch (e) {
      setCmdResult({ cmd, ok: false, output: e instanceof Error ? e.message : 'Failed' })
    } finally {
      setRunningCmd(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-[rgba(212,180,131,0.12)] px-6 py-4 flex-shrink-0 bg-[rgba(212,180,131,0.03)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-hermes-gradient flex items-center gap-2">
              <Activity className="w-6 h-6 text-[#D4B483]" />
              Bert OS Command Center
            </h1>
            <p className="text-sm text-[#5A4A2A] mt-0.5">
              Local-first AI operating system for coding, providers, playbooks, memory, daily brief, and self-coding workflows.
            </p>
          </div>
          <Button onClick={handleNewChat} className="gap-2 border border-[rgba(212,180,131,0.35)] bg-[rgba(212,180,131,0.10)] text-[#D4B483] hover:bg-[rgba(212,180,131,0.18)] hover:border-[rgba(212,180,131,0.50)]">
            <Sparkles className="w-4 h-4" />
            New Chat
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-6 space-y-6">
          <RouteHero
            eyebrow="bertos mission control"
            title="BERTOS: Olympus Neural OS"
            subtitle="A cinematic operating cockpit for the daemon, provider pantheon, oracle threads, agent legion, Autopilot approvals, and local code forge. Live system data stays wired to existing stores and APIs while the Olympus visual layer frames it as divine compute."
            status={automationStats.needsApproval > 0 ? 'warning' : agentStats.running > 0 || automationStats.running > 0 ? 'active' : daemonOnline ? 'nominal' : 'warning'}
            seal={<ShieldCheck className="h-5 w-5" />}
            metrics={[
              {
                label: 'Active Oracle',
                value: chatStreaming ? 'streaming' : 'ready',
                detail: recentSessions[0]?.title ?? 'No active user thread yet',
                tone: chatStreaming ? 'cyan' : 'zinc',
              },
              {
                label: 'Provider Pantheon',
                value: `${providerStats.online.length}/${providers.length || 0}`,
                detail: providers.length ? 'live providers online' : 'status endpoint pending',
                tone: providerStats.online.length > 0 ? 'emerald' : 'amber',
              },
              {
                label: 'Daemon Health',
                value: daemonOnline ? 'online' : 'offline',
                detail: daemonHealth?.workspaceRoot ?? 'local bridge not verified',
                tone: daemonOnline ? 'cyan' : 'amber',
              },
              {
                label: 'Autopilot',
                value: automationStats.needsApproval > 0 ? `${automationStats.needsApproval} approval` : automationStats.running > 0 ? `${automationStats.running} running` : `${automationStats.enabled} rules`,
                detail: `${automationStats.total} recorded runs`,
                tone: automationStats.needsApproval > 0 ? 'amber' : automationStats.running > 0 ? 'cyan' : 'bronze',
              },
            ]}
          >
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ProviderBadge model={selectedModel} />
              <Button onClick={handleNewChat} className="gap-2 border border-[rgba(212,180,131,0.35)] bg-[rgba(212,180,131,0.10)] text-[#D4B483] hover:bg-[rgba(212,180,131,0.18)]">
                <Sparkles className="w-4 h-4" />
                Open Oracle
              </Button>
            </div>
          </RouteHero>

          <section className="grid gap-4 xl:grid-cols-[minmax(340px,0.78fr)_minmax(0,1.22fr)]">
            <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-3xl border border-[rgba(246,196,83,0.22)] bg-[radial-gradient(circle_at_50%_30%,rgba(246,196,83,0.13),transparent_34%),rgba(5,3,10,0.38)] shadow-[inset_0_1px_0_rgba(248,242,223,0.08),0_24px_90px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-0 hermes-grid-fine opacity-20" />
              <div className="absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-[rgba(103,232,249,0.50)] to-transparent" />
              <AIIntegrationOrbit />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                { brand: 'claude' as const, title: 'Claude / Reasoning Oracle', detail: 'Calm architecture review, refactors, and risk analysis through configured CLI/API paths.' },
                { brand: 'codex' as const, title: 'Codex / Code Architect', detail: 'Implementation, repo edits, patch generation, and task automation inside the guarded workspace.' },
                { brand: 'ollama' as const, title: 'Ollama / Local Model Forge', detail: 'Local model routing for private fallback, classification, summaries, and offline compute.' },
                { brand: 'hermes' as const, title: 'Hermes / Messenger Core', detail: 'Server-side routing, orchestration, free/local backend support, and notification/control scaffolds.' },
              ].map(module => (
                <OraclePanel
                  key={module.brand}
                  title={module.title}
                  subtitle={module.detail}
                  action={<BrandSigil brand={module.brand} size="sm" />}
                >
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(248,242,223,0.08)] bg-[rgba(248,242,223,0.04)] px-3 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9A8A68]">Pantheon Link</span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#67E8F9]">
                      <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
                      Visual Module
                    </span>
                  </div>
                </OraclePanel>
              ))}
            </div>
          </section>

          <VisionConceptPanel
            providersOnline={providerStats.online.length}
            providersTotal={providers.length}
            daemonOnline={daemonOnline}
            activeAgents={agentStats.running}
            automationApprovals={automationStats.needsApproval}
            recentThreadTitle={recentSessions[0]?.title && recentSessions[0].title !== 'New Chat' ? recentSessions[0].title : 'No active user thread yet'}
            onOpenBuilder={() => navigateTo('coding', '/builder')}
            onOpenWorkspace={() => navigateTo('workspace', '/workspace')}
            onOpenEvolution={() => navigateTo('evolution', '/evolution')}
          />

          <RecentOutputRail />

          <CommandCore
            operatorName={operatorName}
            rank={rank.current.title}
            nextRank={rank.next.title}
            xp={xp}
            rankProgress={rank.progress}
            relayStreak={relayStreak}
            daemonOnline={daemonOnline}
          />

          <MissionArena
            providersOnline={providerStats.online.length}
            providersTotal={providers.length}
            activeAgents={agentStats.running}
            automationRunning={automationStats.running}
            chatStreaming={chatStreaming}
            daemonOnline={daemonOnline}
            xp={xp}
            rankTitle={rank.current.title}
            onOpenOracle={handleNewChat}
            onOpenBuilder={() => navigateTo('coding', '/builder')}
            onOpenAgents={() => navigateTo('agents', '/agents')}
          />

          <OlympianInterfaceIdeas
            onOpenBuilder={() => navigateTo('coding', '/builder')}
            onOpenWorkspace={() => navigateTo('workspace', '/workspace')}
            onOpenAgents={() => navigateTo('agents', '/agents')}
            onOpenEvolution={() => navigateTo('evolution', '/evolution')}
          />

          <HermesPowerPanel />

          <TelegramRemotePanel remote={telegramRemote} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <ChamberCard
              tone="bronze"
              eyebrow="active operations"
              title="Praetorium Missions"
              description="Progress is recorded from real app actions: messages, tasks, projects, validation, daemon health, and agent completion."
            >
              <div className="grid gap-3 md:grid-cols-2">
                {PRAETORIUM_MISSIONS.map(mission => {
                  const progress = actionCounts[mission.action] ?? 0
                  return (
                    <MissionCard
                      key={mission.id}
                      title={mission.title}
                      description={mission.description}
                      progress={Math.min(progress, mission.target)}
                      target={mission.target}
                      xp={mission.xp}
                      complete={progress >= mission.target}
                    />
                  )
                })}
              </div>
            </ChamberCard>

            <ChamberCard
              tone="cyan"
              eyebrow="operator honors"
              title="Achievements"
              description="Unlocked honors stay attached to the operator panel."
            >
              <div className="flex flex-wrap gap-2">
                {PRAETORIUM_ACHIEVEMENTS.map(achievement => (
                  <AchievementChip
                    key={achievement.id}
                    title={achievement.title}
                    description={achievement.description}
                    unlocked={unlockedAchievements.includes(achievement.id)}
                  />
                ))}
              </div>
            </ChamberCard>
          </div>

          {/* Global Oracle quick-send box */}
          <OracleQuickSend />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <HologramPanel tone="cyan" className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">live oracle stream</p>
                  <h2 className="mt-1 text-lg font-semibold text-zinc-100">Recent threads with real titles</h2>
                </div>
                <StatusOrb state={chatStreaming ? 'active' : 'nominal'} />
              </div>
              <div className="space-y-2">
                {recentSessions.length > 0 ? recentSessions.map(session => {
                  const lastMessage = session.messages.at(-1)
                  return (
                    <button
                      key={session.id}
                      onClick={() => { useChatStore.getState().setActiveSession(session.id); setActiveView('chat'); router.push('/chat') }}
                      className="w-full rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3 text-left transition hover:border-[rgba(212,180,131,0.30)] hover:bg-[rgba(212,180,131,0.05)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[#E8DDB8]">{session.title && session.title !== 'New Chat' ? session.title : 'Untitled oracle thread'}</span>
                        {session.messages.some(message => message.streaming) && <span className="h-2 w-2 rounded-full bg-[#D4B483] shadow-[0_0_12px_rgba(212,180,131,0.75)]" />}
                        <ProviderBadge model={session.model} className="ml-auto" />
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{lastMessage?.content || 'Draft ready for first prompt'}</p>
                    </button>
                  )
                }) : (
                  <EmptyChamber
                    tone="amber"
                    title="Idle Oracle Archive"
                    description="No user-authored chat sessions yet. Open Oracle and send a prompt to create the first live thread."
                  />
                )}
              </div>
            </HologramPanel>

            <HologramPanel tone="bronze" className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">proof gate</p>
                  <h2 className="mt-1 text-lg font-semibold text-zinc-100">Theme verification matrix</h2>
                </div>
                <ShieldCheck className="h-5 w-5 text-amber-200" />
              </div>
              <div className="grid max-h-72 gap-2 overflow-auto pr-1">
                {HERMES_ROUTE_STATUS.map(route => (
                  <div key={route.route} className="rounded-lg border border-amber-300/10 bg-slate-950/45 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-amber-100">{route.route}</span>
                      <span className="rounded-sm border border-[rgba(212,180,131,0.28)] bg-[rgba(212,180,131,0.06)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#D4B483]">
                        {route.status}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-[11px] text-zinc-500">{route.components.join(' · ')}</p>
                  </div>
                ))}
              </div>
            </HologramPanel>
          </div>

          <ProofOfWorkPanel
            filesChanged={[
              'store/bertos/max.ts',
              'app/api/max/plan/route.ts',
              'components/bertos/max/MaxModeView.tsx',
              'app/(bertos)/max/page.tsx',
              'components/bertos/shell/Sidebar.tsx',
              'components/bertos/shell/AppShell.tsx',
              'store/bertos/ui.ts',
              'scripts/start-bertos.mjs',
            ]}
            affectedRoutes={HERMES_ROUTE_STATUS.map(route => route.route)}
            commands={[
              { label: 'npm run typecheck', status: 'not-run', detail: 'available from validation workflow' },
              { label: 'npm run build', status: 'not-run', detail: 'available from validation workflow' },
              { label: 'npm run bertos:safety', status: 'not-run', detail: 'available from validation workflow' },
            ]}
            screenshots={{ available: false, detail: 'Run visual verification during release checks.' }}
            limitations={['/max plan generation requires Ollama running locally.', 'No code applied without explicit approval gate.']}
          />

          <DaemonHealthBanner health={daemonHealth} loading={daemonHealthLoading} onRefresh={refreshDaemonHealth} />

          {/* System Status */}
          <section>
            <h2 className="text-lg font-semibold text-[#E8DDB8] mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-[#D4B483]" />
              System Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatusCard
                label="Providers Online"
                value={`${providerStats.online.length}/${providers.length}`}
                icon={<Zap className="w-5 h-5" />}
                status={providerStats.online.length > 0 ? 'success' : 'error'}
                subtitle={providerStats.online.length > 0 ? 'System ready' : 'No providers available'}
              />
              <StatusCard
                label="Agent Tasks"
                value={agentStats.running > 0 ? `${agentStats.running} running` : `${agentStats.done} done`}
                icon={<Bot className="w-5 h-5" />}
                status={agentStats.running > 0 ? 'warning' : agentStats.done > 0 ? 'success' : 'info'}
                subtitle={`${agentStats.total} total tasks`}
              />
              <StatusCard
                label="Prompt Library"
                value={prompts.length.toString()}
                icon={<Library className="w-5 h-5" />}
                status="info"
                subtitle={`${prompts.filter(p => (p.usageCount ?? 0) > 0).length} used`}
              />
              <StatusCard
                label="Autopilot"
                value={automationStats.needsApproval > 0 ? `${automationStats.needsApproval} approval` : automationStats.running > 0 ? `${automationStats.running} running` : `${automationStats.enabled} rules`}
                icon={<Cpu className="w-5 h-5" />}
                status={automationStats.needsApproval > 0 ? 'warning' : automationStats.running > 0 ? 'info' : automationStats.enabled > 0 ? 'success' : 'warning'}
                subtitle={`${automationStats.total} recent runs`}
              />
              <StatusCard
                label="Active Projects"
                value={projects.length.toString()}
                icon={<FolderOpen className="w-5 h-5" />}
                status="success"
                subtitle={`${activeProject?.name || 'None'} selected`}
              />
              <StatusCard
                label="Chat Sessions"
                value={sessions.length.toString()}
                icon={<MessageSquare className="w-5 h-5" />}
                status="info"
                subtitle={`${recentSessions.length} recent`}
              />
              <StatusCard
                label="Memory"
                value="Local"
                icon={<Library className="w-5 h-5" />}
                status="info"
                subtitle="Project notes and command-center context"
              />
              <StatusCard
                label="Paid Provider Gate"
                value={hermesProvider?.status === 'online' ? 'Enabled' : 'Disabled'}
                icon={<ShieldCheck className="w-5 h-5" />}
                status={hermesProvider?.status === 'online' ? 'warning' : 'success'}
                subtitle="Hermes/Nous never routes silently"
              />
              <StatusCard
                label="Repo Status"
                value={daemonHealth?.repoDetected ? 'Detected' : 'No Repo'}
                icon={<GitBranch className="w-5 h-5" />}
                status={daemonHealth?.repoDetected ? 'success' : 'warning'}
                subtitle={repoStatus?.repo?.branch || daemonHealth?.workspaceRoot || 'Daemon required'}
              />
              <StatusCard
                label="Local Daemon"
                value={daemonOnline ? 'Online' : 'Offline'}
                icon={<Server className="w-5 h-5" />}
                status={daemonOnline ? 'success' : 'warning'}
                subtitle={daemonOnline ? 'Workspace bridge ready' : 'Copy start command above'}
              />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#E8DDB8] mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#D4B483]" />
              Self-Coding Readiness
            </h2>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Builder exists', true],
                  ['Playbooks exist', true],
                  ['Tasks exist', true],
                  ['Memory exists', true],
                  ['Provider status exists', providers.length > 0],
                  ['Daemon available', daemonOnline],
                  ['Safe verification available', daemonOnline],
                  ['Hermes setup honest', hermesProvider?.status === 'online' || hermesProvider?.status === 'offline'],
                ].map(([label, ok]) => (
                  <div key={String(label)} className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(212,180,131,0.03)] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-amber-400" />}
                      <span className="text-xs font-semibold text-[#C8B080]">{label}</span>
                    </div>
                    <p className="text-[11px] text-[#3A2E1A]">{ok ? 'Ready or safely available.' : 'Needs setup or daemon.'}</p>
                  </div>
                ))}
              </div>
              <SelfCodingSafetyContract compact />
            </div>
          </section>

          {/* Today's Command Center */}
          <section>
            <h2 className="text-lg font-semibold text-[#E8DDB8] mb-4 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#D4B483]" />
              Today's Command Center
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
              <div className="rounded-xl border border-[rgba(212,180,131,0.15)] bg-[rgba(212,180,131,0.04)] p-4">
                <div className="text-[10px] uppercase tracking-widest text-[rgba(212,180,131,0.45)] mb-2">Top goal</div>
                <h3 className="text-base font-semibold text-[#E8DDB8]">Keep BertOS local-first, safe, and useful for building itself.</h3>
                <p className="mt-2 text-sm text-[#5A4A2A]">{nextAction}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => { setActiveView('coding'); router.push('/builder') }}>
                    <Zap className="w-3.5 h-3.5" />Open Builder
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setActiveView('playbooks'); router.push('/playbooks') }}>
                    <ClipboardList className="w-3.5 h-3.5" />Open Playbooks
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-[rgba(212,180,131,0.15)] bg-[rgba(212,180,131,0.04)] p-4">
                <div className="text-[10px] uppercase tracking-widest text-[rgba(212,180,131,0.45)] mb-2">Active project</div>
                <div className="text-sm font-medium text-[#E8DDB8]">{activeProject?.name ?? 'No project selected'}</div>
                <p className="mt-1 text-xs text-[#5A4A2A]">{activeProject?.description || 'Use Memory to create project context and keep the active mission focused.'}</p>
                <div className="mt-3 text-[11px] text-[#3A2E1A]">
                  Recent task: {automationStats.recent[0]?.title ?? agentTasks[0]?.title ?? 'No recent task yet.'}
                </div>
              </div>
            </div>
          </section>

          {/* Agent Stack */}
          <section>
            <h2 className="text-lg font-semibold text-[#E8DDB8] mb-4 flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#D4B483]" />
              Agent Team Readiness
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {featuredTeams.map(team => {
                const liveCount = team.agents.filter(agent => agent.status === 'live').length
                const plannedCount = team.agents.filter(agent => agent.status === 'planned').length
                const copyCount = team.agents.filter(agent => agent.status === 'copy-prompt').length
                return (
                  <div key={team.id} className="rounded-xl border border-zinc-800/50 bg-zinc-900/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-200">{team.name}</h3>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{team.bestUse}</p>
                      </div>
                      <Badge variant={team.status === 'partially-live' ? 'warning' : 'default'} className="text-[9px] shrink-0">
                        {team.status}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
                        <div className="text-sm font-semibold text-emerald-300">{liveCount}</div>
                        <div className="text-[9px] text-zinc-600">live</div>
                      </div>
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2">
                        <div className="text-sm font-semibold text-amber-300">{copyCount}</div>
                        <div className="text-[9px] text-zinc-600">prompt</div>
                      </div>
                      <div className="rounded-lg border border-zinc-700 bg-zinc-950/50 p-2">
                        <div className="text-sm font-semibold text-zinc-300">{plannedCount}</div>
                        <div className="text-[9px] text-zinc-600">planned</div>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">{team.nextSetupStep}</p>
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#E8DDB8] mb-4 flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#D4B483]" />
              Agent Stack
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {AGENT_ROSTER.slice(1, 10).map(agent => {
                const provider = providerStats.byId.get(agent.id) ?? (agent.id === 'ollama-local' ? providerStats.byId.get('ollama-pro') : undefined)
                const configured = provider?.status === 'online'
                const statusLabel = provider ? (configured ? 'configured' : 'not configured') : agent.status
                return (
                  <div key={agent.id} className="rounded-xl border border-zinc-800/50 bg-zinc-900/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-200">{agent.name}</h3>
                        <p className="mt-1 text-xs text-zinc-500">{agent.bestUse}</p>
                      </div>
                      <Badge variant={configured ? 'success' : agent.status === 'paid-gated' || agent.status === 'experimental' ? 'warning' : 'default'} className="text-[9px] shrink-0">
                        {statusLabel}
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-1 text-[11px] text-zinc-600">
                      <div>Billing: {agent.billing}</div>
                      <div>Runnable from BertOS: {agent.canRunNow}</div>
                      {provider?.message && <div className="line-clamp-2">Status: {provider.message}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Quick Launch */}
          <section>
            <h2 className="text-lg font-semibold text-[#E8DDB8] mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#D4B483]" />
              Quick Launch
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {[
                { label: 'Dev Cockpit', href: '/cockpit', view: 'cockpit' as const, icon: <Terminal className="w-4 h-4" /> },
                { label: 'AI Assistant', href: '/assistant', view: 'chat' as const, icon: <Bot className="w-4 h-4" /> },
                { label: 'Chat', href: '/chat', view: 'chat' as const, icon: <MessageSquare className="w-4 h-4" /> },
                { label: 'Builder', href: '/builder', view: 'coding' as const, icon: <Zap className="w-4 h-4" /> },
                { label: 'Gates', href: '/approvals', view: 'approvals' as const, icon: <ShieldCheck className="w-4 h-4" /> },
                { label: 'Settings', href: '/settings', view: 'settings' as const, icon: <Server className="w-4 h-4" /> },
                { label: 'Daily Brief', href: '/brief', view: 'brief' as const, icon: <CalendarDays className="w-4 h-4" /> },
                { label: 'Playbooks', href: '/playbooks', view: 'playbooks' as const, icon: <ClipboardList className="w-4 h-4" /> },
                { label: 'Tasks', href: '/tasks', view: 'tasks' as const, icon: <KanbanSquare className="w-4 h-4" /> },
                { label: 'Agents', href: '/agents', view: 'agents' as const, icon: <Bot className="w-4 h-4" /> },
                { label: 'Migrations', href: '/migrations', view: 'migrations' as const, icon: <Compass className="w-4 h-4" /> },
                { label: 'GitHub', href: '/github', view: 'github' as const, icon: <Github className="w-4 h-4" /> },
                { label: 'Memory', href: '/memory', view: 'memory' as const, icon: <Library className="w-4 h-4" /> },
              ].map(item => (
                <button
                  key={item.href}
                  onClick={() => { setActiveView(item.view); router.push(item.href) }}
                  className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(212,180,131,0.04)] p-3 text-left hover:border-[rgba(212,180,131,0.28)] hover:bg-[rgba(212,180,131,0.07)] transition"
                >
                  <div className="mb-2 text-[#D4B483]">{item.icon}</div>
                  <div className="text-xs font-medium text-[#C8B080]">{item.label}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Provider Health */}
          <section>
            <h2 className="text-lg font-semibold text-[#E8DDB8] mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#D4B483]" />
              Provider Health
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {loading ? (
                <div className="col-span-full">
                  <LoadingRelay label="Provider Pantheon Scanning" detail="Checking configured provider status without assuming availability." />
                </div>
              ) : providers.length === 0 ? (
                <div className="col-span-full">
                  <EmptyChamber icon={<AlertCircle className="h-6 w-6" />} title="Provider Relay Dormant" description="No provider data is available from the status endpoint." tone="amber" />
                </div>
              ) : (
                providers.map((provider) => (
                  <ProviderCard key={provider.id} provider={provider} />
                ))
              )}
            </div>
          </section>

          {/* Projects & Activity */}
          <Tabs defaultValue="projects" className="w-full">
            <TabsList className="bg-zinc-900/50 border border-zinc-800/50">
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="activity">Recent Activity</TabsTrigger>
              <TabsTrigger value="actions">Quick Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="space-y-3 mt-4">
              {projects.length === 0 ? (
                <EmptyChamber
                  icon={<FolderOpen className="h-6 w-6" />}
                  title="Sealed Project Vault"
                  description="Create the first project chamber to anchor Memory, Workspace, and Oracle context."
                  action={(
                    <Button
                      variant="outline"
                      onClick={() => {
                        useProjectStore.getState().createProject({ name: 'New Project' })
                      }}
                    >
                      Create First Project
                    </Button>
                  )}
                />
              ) : (
                projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isActive={project.id === activeProjectId}
                    onClick={() => handleOpenProject(project.id)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 mt-4">
              {agentStats.total === 0 && recentSessions.length === 0 && automationStats.total === 0 ? (
                <div className="p-12 rounded-xl border border-zinc-800/50 bg-zinc-900/20 text-center">
                  <Clock className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">No recent activity</p>
                </div>
              ) : (
                <>
                  {agentStats.total > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                        <Bot className="w-4 h-4" />
                        Recent Agent Runs
                      </h3>
                      <div className="space-y-2">
                        {agentTasks.slice(-5).reverse().map((task) => (
                          <AgentActivityCard key={task.id} task={task} />
                        ))}
                      </div>
                    </div>
                  )}
                  {automationStats.total > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                        <Cpu className="w-4 h-4" />
                        Recent Autopilot Runs
                      </h3>
                      <div className="space-y-2">
                        {automationStats.recent.map((run) => (
                          <AutomationActivityCard key={run.id} run={run} />
                        ))}
                      </div>
                    </div>
                  )}
                  {recentSessions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Recent Chats
                      </h3>
                      <div className="space-y-2">
                        {recentSessions.map((session) => (
                          <ActivityCard key={session.id} session={session} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="actions" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ActionCard
                  icon={<MessageSquare className="w-5 h-5" />}
                  label="New Chat"
                  description="Start a new AI conversation"
                  onClick={handleNewChat}
                />
                <ActionCard
                  icon={<Scale className="w-5 h-5" />}
                  label="Start Council"
                  description="Run multi-model comparison"
                  onClick={() => {
                    setActiveView('compare')
                    router.push('/compare')
                  }}
                />
                <ActionCard
                  icon={<Bot className="w-5 h-5" />}
                  label="Start Agent Run"
                  description="Launch autonomous agent task"
                  onClick={handleStartAgentRun}
                />
                <ActionCard
                  icon={<Code2 className="w-5 h-5" />}
                  label="Open Workspace"
                  description="Manage files and patches"
                  onClick={() => {
                    setActiveView('workspace')
                    router.push('/workspace')
                  }}
                />
                <ActionCard
                  icon={<Library className="w-5 h-5" />}
                  label="Prompt Library"
                  description="Browse and run saved prompts"
                  onClick={() => {
                    setActiveView('prompts')
                    router.push('/prompts')
                  }}
                />
                <ActionCard
                  icon={<GitBranch className="w-5 h-5" />}
                  label="Open Coding"
                  description="Launch coding assistant"
                  onClick={() => {
                    setActiveView('coding')
                    router.push('/coding')
                  }}
                />
                <ActionCard
                  icon={<Cpu className="w-5 h-5" />}
                  label="Open Autopilot"
                  description="Manage automation rules and runs"
                  onClick={() => {
                    setActiveView('autopilot')
                    router.push('/autopilot')
                  }}
                />
              </div>
              {!daemonOnline && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100/70">
                  Project health checks are available after the local daemon is running. Use the banner above to copy the start command.
                </div>
              )}
              <div className="mt-6">
                <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Dev Commands
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    disabled={!!runningCmd || !daemonOnline}
                    onClick={() => handleRunCmd('typecheck')}
                    className="p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-zinc-700/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-zinc-200">
                        {runningCmd === 'typecheck' ? 'Running typecheck…' : 'Run Typecheck'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">npm run typecheck</p>
                  </button>
                  <button
                    disabled={!!runningCmd || !daemonOnline}
                    onClick={() => handleRunCmd('build')}
                    className="p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-zinc-700/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Box className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-medium text-zinc-200">
                        {runningCmd === 'build' ? 'Running build…' : 'Run Build'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">npm run build</p>
                  </button>
                </div>
                {cmdResult && (
                  <div className={cn(
                    'mt-3 p-3 rounded-xl border text-xs font-mono',
                    cmdResult.ok
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/5 border-red-500/20 text-red-300'
                  )}>
                    <div className="flex items-center gap-2 mb-2 font-sans">
                      {cmdResult.ok
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        : <XCircle className="w-4 h-4 text-red-400" />}
                      <span className="font-medium">{cmdResult.cmd} {cmdResult.ok ? 'passed' : 'failed'}</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-[11px] max-h-40 overflow-auto opacity-80">
                      {cmdResult.output.slice(0, 2000)}
                    </pre>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  )
}

function OracleQuickSend() {
  const router = useRouter()
  const { setActiveView } = useUIStore()
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    try { window.localStorage.setItem('bertos-chat-draft', text) } catch { /* ignore */ }
    setActiveView('chat')
    router.push('/chat')
  }

  return (
    <div className="rounded-xl border border-[rgba(212,180,131,0.18)] bg-[rgba(212,180,131,0.04)] px-4 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(212,180,131,0.55)]">Oracle quick-send</p>
      <form
        onSubmit={e => { e.preventDefault(); submit() }}
        className="flex items-center gap-2"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Ask the Oracle anything — you'll be taken to /chat…"
          className="flex-1 rounded-lg border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.70)] px-3 py-2 text-sm text-[#E8DDB8] outline-none placeholder:text-[#3A2E1A] focus:border-[rgba(212,180,131,0.35)]"
        />
        <Button type="submit" size="sm" disabled={!draft.trim()} className="gap-1.5 border border-[rgba(212,180,131,0.35)] bg-[rgba(212,180,131,0.10)] text-[#D4B483] hover:bg-[rgba(212,180,131,0.18)]">
          <Send className="h-3.5 w-3.5" />
          Send
        </Button>
      </form>
    </div>
  )
}

interface StatusCardProps {
  label: string
  value: string
  icon: React.ReactNode
  status: 'success' | 'error' | 'warning' | 'info'
  subtitle: string
}

function StatusCard({ label, value, icon, status, subtitle }: StatusCardProps) {
  const colors = {
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    error: 'text-red-400 bg-red-500/10 border-red-500/20',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  }

  return (
    <div className={cn('p-4 rounded-xl border', colors[status])}>
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm text-zinc-400">{label}</div>
        <div className="opacity-70">{icon}</div>
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs text-zinc-500">{subtitle}</div>
    </div>
  )
}

interface ProviderCardProps {
  provider: ProviderStatus
}

function TelegramRemotePanel({ remote }: { remote: TelegramRemoteState | null }) {
  const events = remote?.remote.events ?? []
  const latest = events[0]
  const configured = Boolean(remote?.configured)
  const communicable = Boolean(remote?.communicable)
  const webhookError = remote?.webhook?.error || remote?.webhook?.lastErrorMessage
  const remoteLabel = !configured
    ? 'needs setup'
    : !remote?.webhook?.reachable
      ? 'token rejected'
      : !remote.webhook.connected
        ? 'webhook missing'
        : 'connected'
  const lastSeen = remote?.remote.lastSeenAt
    ? new Date(remote.remote.lastSeenAt).toLocaleTimeString()
    : 'waiting'

  const stateTone = latest?.type === 'failed'
    ? 'text-red-300'
    : latest?.type === 'running'
      ? 'text-cyan-200'
      : communicable
        ? 'text-emerald-300'
        : 'text-amber-300'

  return (
    <HologramPanel tone="cyan" className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-cyan-200" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/70">telegram remote</p>
            <StatusOrb state={latest?.type === 'running' ? 'active' : communicable ? 'nominal' : 'warning'} />
          </div>
          <h2 className="text-lg font-semibold text-zinc-100">Phone control for the BertOS display</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500">
            Text the configured Telegram bot and this panel updates as commands arrive. Telegram is remote control only:
            safe checks and status commands can run, while file edits, patch apply, git push, deploys, and paid providers stay behind the BertOS web approval layer.
          </p>
        </div>
        <div className="grid min-w-[260px] gap-2 text-xs sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-lg border border-cyan-300/10 bg-slate-950/45 p-2">
            <div className="text-[9px] uppercase tracking-widest text-zinc-600">Remote</div>
            <div className={cn('mt-1 font-semibold', stateTone)}>{remoteLabel}</div>
            {webhookError && <div className="mt-1 line-clamp-2 text-[10px] text-amber-200/70">{webhookError}</div>}
          </div>
          <div className="rounded-lg border border-cyan-300/10 bg-slate-950/45 p-2">
            <div className="text-[9px] uppercase tracking-widest text-zinc-600">Last signal</div>
            <div className="mt-1 font-semibold text-zinc-200">{lastSeen}</div>
          </div>
          <div className="rounded-lg border border-cyan-300/10 bg-slate-950/45 p-2">
            <div className="text-[9px] uppercase tracking-widest text-zinc-600">Chat</div>
            <div className={cn('mt-1 font-semibold', remote?.chatEnabled || remote?.plainLocalChatEnabled ? 'text-emerald-300' : 'text-amber-300')}>
              {remote?.plainLocalChatEnabled ? 'local Ollama' : remote?.chatEnabled ? 'enabled' : 'disabled'}
            </div>
          </div>
          <div className="rounded-lg border border-cyan-300/10 bg-slate-950/45 p-2">
            <div className="text-[9px] uppercase tracking-widest text-zinc-600">Webhook</div>
            <div className="mt-1 font-mono text-[11px] text-zinc-300">{remote?.webhook?.webhookHost ?? remote?.webhookEndpoint ?? '/api/telegram/webhook'}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-xl border border-cyan-300/10 bg-slate-950/35 p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-600">live timeline</p>
              <p className="text-sm font-semibold text-zinc-200">{latest?.command ?? 'Awaiting Telegram command'}</p>
            </div>
            <Radio className={cn('h-4 w-4', latest?.type === 'running' ? 'animate-pulse text-cyan-200' : 'text-zinc-600')} />
          </div>
          <div className="grid max-h-56 gap-2 overflow-auto pr-1">
            {events.length ? events.slice(0, 8).map(event => (
              <div key={event.id} className="rounded-lg border border-zinc-800/70 bg-black/25 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider',
                    event.type === 'failed' ? 'text-red-300' : event.type === 'running' ? 'text-cyan-200' : event.type === 'completed' ? 'text-emerald-300' : 'text-zinc-400',
                  )}>
                    {event.type}
                  </span>
                  <span className="text-[10px] text-zinc-600">{new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="mt-1 truncate text-xs font-medium text-zinc-200">{event.command ?? 'telegram'}</div>
                {(event.text || event.detail) && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">{event.detail || event.text}</p>
                )}
              </div>
            )) : (
              <EmptyChamber
                tone="cyan"
                title="Remote waiting"
                description="Send /status, /providers, /brief, /coding, or /run-check from Telegram to make this display move."
              />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-cyan-300/10 bg-slate-950/35 p-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-600">remote commands</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(remote?.supportedCommands ?? ['/status', '/daemon', '/providers', '/brief', '/coding', '/run-check']).map(command => (
              <span key={command} className="rounded-md border border-cyan-300/10 bg-cyan-300/5 px-2 py-1 font-mono text-[10px] text-cyan-100/80">
                {command}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
            TV mode needs the Telegram webhook to reach this exact BertOS server. Localhost works only through a tunnel or a deployed URL that forwards events to this running app.
          </p>
        </div>
      </div>
    </HologramPanel>
  )
}

function ProviderCard({ provider }: ProviderCardProps) {
  const isOnline = provider.status === 'online'
  const isBlocked = provider.status === 'blocked' || provider.status === 'disabled'
  const isConfigured = provider.status === 'configured' || provider.status === 'manual-or-api-needed' || provider.status === 'copy-prompt-only' || provider.status === 'planned'
  const StatusIcon = isOnline ? CheckCircle2 : isConfigured ? AlertCircle : XCircle
  const statusLabel = isOnline
    ? 'Available'
    : provider.status === 'blocked'
      ? 'Blocked'
      : provider.status === 'configured'
        ? 'Needs test'
        : provider.status === 'planned'
          ? 'Planned'
          : provider.status === 'copy-prompt-only'
            ? 'Copy prompt'
            : provider.status === 'manual-or-api-needed'
              ? 'Manual/API'
              : 'Offline'

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-colors',
        isOnline
          ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
          : isConfigured
            ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/35'
            : isBlocked
              ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/35'
          : 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700/50'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm font-medium text-zinc-200">{provider.name}</div>
        <StatusIcon className={cn('w-4 h-4', isOnline ? 'text-emerald-400' : isConfigured ? 'text-amber-400' : isBlocked ? 'text-red-400' : 'text-zinc-600')} />
      </div>
      <div className={cn('text-xs', isOnline ? 'text-emerald-400' : isConfigured ? 'text-amber-400' : isBlocked ? 'text-red-300' : 'text-zinc-500')}>
        {statusLabel}
      </div>
      {provider.latency && (
        <div className="text-xs text-zinc-500 mt-1">{provider.latency}ms</div>
      )}
      {provider.message && (
        <div className="text-xs text-zinc-500 mt-2 line-clamp-2">{provider.message}</div>
      )}
    </div>
  )
}

interface ProjectCardProps {
  project: any
  isActive: boolean
  onClick: () => void
}

function ProjectCard({ project, isActive, onClick }: ProjectCardProps) {
  const todoCount = project.todos?.length || 0
  const doneCount = project.todos?.filter((t: any) => t.done).length || 0

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl border cursor-pointer transition-all',
        isActive
          ? 'bg-violet-500/10 border-violet-500/30 shadow-lg shadow-violet-500/10'
          : 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{project.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-zinc-100 truncate">{project.name}</h3>
            {isActive && <Badge variant="success" className="text-[10px]">Active</Badge>}
          </div>
          {project.description && (
            <p className="text-xs text-zinc-500 line-clamp-2 mb-2">{project.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            {todoCount > 0 && (
              <span>
                {doneCount}/{todoCount} todos
              </span>
            )}
            <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface ActivityCardProps {
  session: any
}

function ActivityCard({ session }: ActivityCardProps) {
  const messageCount = session.messages?.length || 0

  return (
    <div className="p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-zinc-200 truncate mb-1">{session.title}</h4>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{messageCount} messages</span>
            <span>•</span>
            <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
            {session.model && (
              <>
                <span>•</span>
                <Badge className="text-[10px]">{session.model}</Badge>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface AgentActivityCardProps {
  task: any
}

function AgentActivityCard({ task }: AgentActivityCardProps) {
  const statusColor = {
    done: 'text-emerald-400',
    running: 'text-blue-400',
    failed: 'text-red-400',
    pending: 'text-zinc-400',
  }[task.status as string] ?? 'text-zinc-400'

  return (
    <div className="p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-zinc-200 truncate">{task.title}</h4>
          <div className="flex items-center gap-2 mt-0.5 text-xs">
            <span className={statusColor}>{task.status}</span>
            {task.steps?.length > 0 && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-500">{task.steps.length} steps</span>
              </>
            )}
            {task.createdAt && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-600">{new Date(task.createdAt).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface AutomationActivityCardProps {
  run: AutomationRun
}

function AutomationActivityCard({ run }: AutomationActivityCardProps) {
  const statusColor = {
    queued: 'text-zinc-400',
    running: 'text-blue-400',
    completed: 'text-emerald-400',
    failed: 'text-red-400',
    blocked: 'text-red-400',
    'needs-approval': 'text-amber-400',
  }[run.status]

  return (
    <div className="p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-zinc-200 truncate">{run.title}</h4>
          <div className="flex items-center gap-2 mt-0.5 text-xs">
            <span className={statusColor}>{run.status}</span>
            <span className="text-zinc-600">-</span>
            <span className="text-zinc-500">{run.actions.length} actions</span>
            <span className="text-zinc-600">-</span>
            <span className="text-zinc-600">{new Date(run.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ActionCardProps {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}

function ActionCard({ icon, label, description, onClick }: ActionCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="p-4 rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(212,180,131,0.04)] hover:bg-[rgba(212,180,131,0.07)] hover:border-[rgba(212,180,131,0.28)] transition-all text-left"
    >
      <div className="w-10 h-10 rounded-lg border border-[rgba(212,180,131,0.18)] bg-[rgba(212,180,131,0.06)] flex items-center justify-center mb-3 text-[#D4B483]">
        {icon}
      </div>
      <h4 className="text-sm font-medium text-[#C8B080] mb-1">{label}</h4>
      <p className="text-xs text-[#4A3C28]">{description}</p>
    </motion.button>
  )
}
