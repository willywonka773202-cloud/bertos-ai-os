'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import * as THREE from 'three'
import {
  Activity,
  Bot,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Code2,
  Compass,
  Crosshair,
  Cpu,
  Flag,
  FlaskConical,
  Github,
  GitCompare,
  KanbanSquare,
  LayoutDashboard,
  Library,
  MessageSquare,
  Moon,
  Radio,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import {
  GAME_MODULES,
  getGameModuleForPath,
  getNextGameModule,
  getPreviousGameModule,
  type GameModule,
  type GameModuleId,
} from '@/lib/bertos/game-modules'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useAgentStore } from '@/store/bertos/agents'
import { useAutomationStore } from '@/store/bertos/automations'
import { useDaemonStore } from '@/store/bertos/daemon'
import { getRankProgress, useProgressionStore } from '@/store/bertos/progression'
import { fetchBrowserAwareProviderStatus } from '@/lib/bertos/provider-status-client'

const moduleIcons: Record<GameModuleId, LucideIcon> = {
  dashboard: LayoutDashboard,
  cockpit: Code2,
  approvals: GitCompare,
  providers: Cpu,
  chat: MessageSquare,
  hermes: Sparkles,
  prompts: Library,
  compare: GitCompare,
  coding: Zap,
  max: Moon,
  workspace: Code2,
  evolution: FlaskConical,
  agents: Bot,
  memory: Brain,
  brief: CalendarDays,
  playbooks: ClipboardList,
  tasks: KanbanSquare,
  migrations: Compass,
  github: Github,
  autopilot: Cpu,
  automations: Activity,
  settings: Settings,
  launch: Rocket,
}

interface ProviderStatus {
  id: string
  status: string
}

interface GameMetrics {
  xp: number
  rank: string
  relayStreak: number
  providersOnline: number
  providersTotal: number
  chatSessions: number
  streaming: boolean
  agentRunning: number
  agentDone: number
  automationRunning: number
  automationApprovals: number
  daemonOnline: boolean
}

interface GameQuest {
  id: string
  title: string
  objective: string
  progress: number
  target: number
  reward: string
  module: GameModule
  tone: string
}

interface AppLogoVisual {
  id: string
  label: string
  asset: string
  color: string
  secondaryColor: string
}

const APP_LOGO_VISUALS: AppLogoVisual[] = [
  {
    id: 'codex',
    label: 'Codex',
    asset: '/brand-icons/codex.svg',
    color: '#10B981',
    secondaryColor: '#22D3EE',
  },
  {
    id: 'claude',
    label: 'Claw / Claude',
    asset: '/brand-icons/claude.svg',
    color: '#D97757',
    secondaryColor: '#F6C453',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    asset: '/brand-icons/gemini.svg',
    color: '#8E75FF',
    secondaryColor: '#60A5FA',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    asset: '/brand-icons/ollama.svg',
    color: '#F7F7F2',
    secondaryColor: '#86C9A0',
  },
  {
    id: 'hermes',
    label: 'Hermes',
    asset: '/brand-icons/hermes.svg',
    color: '#8C5CFF',
    secondaryColor: '#D4B483',
  },
]

export function BertOSGameLayer() {
  const pathname = usePathname()
  const router = useRouter()
  const { setActiveView, settings } = useUIStore()
  const { sessions, isStreaming } = useChatStore()
  const { tasks: agentTasks } = useAgentStore()
  const { runs: automationRuns } = useAutomationStore()
  const daemonStatus = useDaemonStore(state => state.status)
  const { xp, relayStreak, actionCounts } = useProgressionStore()
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(1)
  const [scanMode, setScanMode] = useState(false)
  const [pulse, setPulse] = useState(0)

  const activeModule = useMemo(() => getGameModuleForPath(pathname), [pathname])
  const rank = getRankProgress(xp)

  useEffect(() => {
    if (activeModule.id !== 'automations') {
      setActiveView(activeModule.id as Parameters<typeof setActiveView>[0])
    }
  }, [activeModule.id, setActiveView])

  useEffect(() => {
    let cancelled = false

    async function loadProviders() {
      try {
        const data = await fetchBrowserAwareProviderStatus()
        if (!cancelled) setProviders(data.providers ?? [])
      } catch {
        if (!cancelled) setProviders([])
      }
    }

    loadProviders()
    const interval = window.setInterval(loadProviders, 30000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const metrics: GameMetrics = useMemo(() => {
    const userSessions = sessions.filter(session => session.messages.some(message => message.role === 'user')).length
    return {
      xp,
      rank: rank.current.title,
      relayStreak,
      providersOnline: providers.filter(provider => provider.status === 'online').length,
      providersTotal: providers.length,
      chatSessions: userSessions,
      streaming: isStreaming,
      agentRunning: agentTasks.filter(task => task.status === 'running').length,
      agentDone: agentTasks.filter(task => task.status === 'done').length,
      automationRunning: automationRuns.filter(run => run.status === 'running').length,
      automationApprovals: automationRuns.filter(run => run.status === 'needs-approval').length,
      daemonOnline: daemonStatus === 'connected' || daemonStatus === 'degraded',
    }
  }, [agentTasks, automationRuns, daemonStatus, isStreaming, providers, rank.current.title, relayStreak, sessions, xp])

  const intensity = useMemo(() => {
    const providerRatio = metrics.providersTotal ? metrics.providersOnline / metrics.providersTotal : 0
    return Math.min(
      1,
      0.16 +
        providerRatio * 0.22 +
        (metrics.daemonOnline ? 0.16 : 0) +
        (metrics.streaming ? 0.16 : 0) +
        Math.min(0.20, metrics.agentRunning * 0.08) +
        Math.min(0.16, metrics.automationRunning * 0.06) +
        Math.min(0.10, metrics.automationApprovals * 0.04),
    )
  }, [metrics])

  const navigateToModule = (module: GameModule) => {
    if (module.id !== 'automations') setActiveView(module.id as Parameters<typeof setActiveView>[0])
    router.push(module.href)
  }

  const triggerPulse = (amount: number) => {
    setPulse(value => value + amount)
    setScore(value => value + Math.round((24 + amount * 12) * combo))
    setCombo(value => Math.min(9, value + 1))
    window.setTimeout(() => setCombo(value => Math.max(1, value - 1)), 2200)
  }

  const previous = getPreviousGameModule(activeModule.id)
  const next = getNextGameModule(activeModule.id)
  const Icon = moduleIcons[activeModule.id]
  const status = metrics.automationApprovals > 0
    ? `${metrics.automationApprovals} approvals`
    : metrics.streaming
      ? 'oracle streaming'
      : metrics.agentRunning > 0
        ? `${metrics.agentRunning} agents active`
        : metrics.daemonOnline
          ? 'daemon linked'
          : 'standby'

  const gameQuests: GameQuest[] = useMemo(() => {
    const moduleById = new Map(GAME_MODULES.map(gameModule => [gameModule.id, gameModule]))
    const quest = (
      id: string,
      title: string,
      objective: string,
      progress: number,
      target: number,
      reward: string,
      moduleId: GameModuleId,
      tone: string,
    ): GameQuest => ({
      id,
      title,
      objective,
      progress: Math.min(progress, target),
      target,
      reward,
      module: moduleById.get(moduleId) ?? GAME_MODULES[0],
      tone,
    })

    return [
      quest('oracle-signal', 'Oracle Signal', 'Send a real chat message', actionCounts['chat-message'] ?? 0, 1, '+20 XP', 'chat', '#7ABCD6'),
      quest('forge-proof', 'Forge Proof', 'Pass a validation run', actionCounts['validation-passed'] ?? 0, 1, '+45 XP', 'coding', '#F6C453'),
      quest('agent-bounty', 'Agent Bounty', 'Complete an agent task', actionCounts['agent-completed'] ?? 0, 1, '+35 XP', 'agents', '#86C9A0'),
      quest('daemon-link', 'Daemon Link', 'Connect the local daemon', metrics.daemonOnline ? 1 : 0, 1, '+15 XP', 'settings', '#2DD4BF'),
    ]
  }, [actionCounts, metrics.daemonOnline])

  return (
    <section className="relative z-20 shrink-0 overflow-hidden border-b border-[rgba(212,180,131,0.14)] bg-[#060403]/92">
      <GameScene module={activeModule} metrics={metrics} intensity={intensity} pulse={pulse} scanMode={scanMode} animationsEnabled={settings.animationsEnabled !== false} />
      <div className="pointer-events-none absolute inset-0 hermes-grid-fine opacity-20" />
      <div className="relative z-10 grid gap-3 px-3 py-2 md:grid-cols-[minmax(260px,0.34fr)_minmax(420px,0.66fr)] md:px-4">
        <div className="flex min-w-0 flex-col justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-[rgba(212,180,131,0.20)] bg-[rgba(212,180,131,0.07)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.24em] text-[#D4B483]">
                <Radio className="h-3 w-3" />
                bertos game layer
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-[rgba(122,188,214,0.20)] bg-[rgba(122,188,214,0.07)] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
                <ShieldCheck className="h-3 w-3" />
                {status}
              </span>
            </div>
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[rgba(212,180,131,0.24)] bg-black/30" style={{ color: activeModule.color }}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold text-[#F0E8D0] md:text-xl">{activeModule.title}</div>
                <div className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-[0.22em] text-[#6A5A3A]">{activeModule.callsign}</div>
                <p className="mt-1 hidden max-w-xl truncate text-xs leading-5 text-[#9A8A68] xl:block">{activeModule.objective}</p>
              </div>
            </div>
            <AppLogoDock activeIndex={getAppLogoIndex(activeModule)} />
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <HudStat label="Rank" value={metrics.rank} />
            <HudStat label="XP" value={metrics.xp.toLocaleString()} />
            <HudStat label="Score" value={score.toLocaleString()} />
            <HudStat label="Combo" value={`${combo}x`} />
          </div>
        </div>

        <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(220px,0.9fr)_minmax(200px,0.54fr)_minmax(300px,1fr)]">
          <div className="min-w-0 rounded-lg border border-[rgba(212,180,131,0.14)] bg-[rgba(7,5,3,0.58)] p-2.5 backdrop-blur-md">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#6A5A3A]">module map</div>
                <div className="text-sm font-semibold text-[#F0E8D0]">{GAME_MODULES.length} playable systems</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => navigateToModule(previous)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[rgba(212,180,131,0.16)] bg-black/30 text-[#D4B483] transition hover:border-[rgba(212,180,131,0.34)]"
                  aria-label="Previous game module"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigateToModule(next)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[rgba(212,180,131,0.16)] bg-black/30 text-[#D4B483] transition hover:border-[rgba(212,180,131,0.34)]"
                  aria-label="Next game module"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {GAME_MODULES.map(module => {
                const ModuleIcon = moduleIcons[module.id]
                const active = module.id === activeModule.id
                return (
                  <button
                    key={module.id}
                    onClick={() => navigateToModule(module)}
                    title={`${module.title}: ${module.objective}`}
                    className={cn(
                      'group flex min-w-[68px] flex-col items-center gap-1 rounded-md border px-2 py-1.5 transition',
                      active
                        ? 'border-[rgba(240,232,208,0.34)] bg-[rgba(212,180,131,0.12)]'
                        : 'border-[rgba(212,180,131,0.10)] bg-black/25 hover:border-[rgba(212,180,131,0.28)] hover:bg-[rgba(212,180,131,0.06)]',
                    )}
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-black/25" style={{ color: module.color }}>
                      <ModuleIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className={cn('max-w-full truncate text-[10px] font-semibold', active ? 'text-[#F0E8D0]' : 'text-[#6A5A3A] group-hover:text-[#D4B483]')}>{module.navLabel}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-lg border border-[rgba(212,180,131,0.14)] bg-[rgba(7,5,3,0.58)] p-2.5 backdrop-blur-md">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#6A5A3A]">mission controls</div>
                <div className="text-sm font-semibold text-[#F0E8D0]">{activeModule.reward}</div>
              </div>
              <Sparkles className="h-4 w-4 text-[#D4B483]" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => triggerPulse(1)} className="rounded-md border border-[rgba(122,188,214,0.18)] bg-[rgba(122,188,214,0.08)] px-2 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-[rgba(122,188,214,0.34)]">
                Pulse
              </button>
              <button onClick={() => { setScanMode(value => !value); triggerPulse(0.5) }} className={cn('rounded-md border px-2 py-1.5 text-xs font-semibold transition', scanMode ? 'border-[rgba(246,196,83,0.38)] bg-[rgba(246,196,83,0.14)] text-amber-100' : 'border-[rgba(246,196,83,0.18)] bg-[rgba(246,196,83,0.08)] text-amber-100 hover:border-[rgba(246,196,83,0.34)]')}>
                Scan
              </button>
              <button onClick={() => navigateToModule(next)} className="rounded-md border border-[rgba(134,201,160,0.18)] bg-[rgba(134,201,160,0.08)] px-2 py-1.5 text-xs font-semibold text-emerald-100 transition hover:border-[rgba(134,201,160,0.34)]">
                Jump
              </button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
              <TinyMetric label="Providers" value={`${metrics.providersOnline}/${metrics.providersTotal || 0}`} />
              <TinyMetric label="Agents" value={`${metrics.agentRunning}/${metrics.agentDone}`} />
              <TinyMetric label="Relay" value={`${metrics.relayStreak}d`} />
            </div>
          </div>

          <QuestRail
            quests={gameQuests}
            activeModuleId={activeModule.id}
            onOpenQuest={(quest) => {
              triggerPulse(1.25)
              navigateToModule(quest.module)
            }}
          />
        </div>
      </div>
    </section>
  )
}

function AppLogoDock({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="mt-2 flex min-w-0 gap-1.5 overflow-hidden">
      {APP_LOGO_VISUALS.map((visual, index) => {
        const active = index === activeIndex
        return (
          <div
            key={visual.id}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-1.5 rounded-md border bg-black/30 px-1.5 py-1 transition',
              active ? 'border-white/25' : 'border-white/10 opacity-72',
            )}
            style={{
              boxShadow: active ? `0 0 18px ${visual.color}26` : undefined,
              color: active ? visual.color : '#8A7860',
            }}
            title={visual.label}
          >
            <img src={visual.asset} alt="" className="h-5 w-5 shrink-0 rounded-[5px]" />
            <span className="truncate text-[9px] font-semibold">{visual.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function HudStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[rgba(212,180,131,0.12)] bg-black/30 px-2 py-1.5">
      <div className="truncate text-[8px] font-semibold uppercase tracking-[0.18em] text-[#6A5A3A]">{label}</div>
      <div className="mt-0.5 truncate text-xs font-semibold text-[#F0E8D0]">{value}</div>
    </div>
  )
}

function TinyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[rgba(212,180,131,0.10)] bg-black/25 px-2 py-1">
      <div className="uppercase tracking-[0.18em] text-[#5A4A2A]">{label}</div>
      <div className="mt-0.5 font-semibold text-[#D4B483]">{value}</div>
    </div>
  )
}

function QuestRail({
  quests,
  activeModuleId,
  onOpenQuest,
}: {
  quests: GameQuest[]
  activeModuleId: GameModuleId
  onOpenQuest: (quest: GameQuest) => void
}) {
  const completed = quests.filter(quest => quest.progress >= quest.target).length

  return (
    <div className="min-w-0 rounded-lg border border-[rgba(240,232,208,0.18)] bg-[linear-gradient(135deg,rgba(240,232,208,0.08),rgba(7,5,3,0.70)_42%,rgba(122,188,214,0.08))] p-2.5 shadow-[0_0_30px_rgba(122,188,214,0.06)] backdrop-blur-md">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[rgba(240,232,208,0.18)] bg-black/30 text-[#F0E8D0]">
            <Trophy className="h-4 w-4" />
          </span>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#D4B483]">active quest board</div>
            <div className="text-sm font-semibold text-[#F0E8D0]">{completed}/{quests.length} objectives cleared</div>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 rounded-md border border-[rgba(134,201,160,0.18)] bg-[rgba(134,201,160,0.08)] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100 2xl:flex">
          <Flag className="h-3.5 w-3.5" />
          playable loop
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {quests.map(quest => {
          const complete = quest.progress >= quest.target
          const selected = quest.module.id === activeModuleId
          const percent = Math.min(100, Math.round((quest.progress / Math.max(1, quest.target)) * 100))
          const Icon = moduleIcons[quest.module.id]

          return (
            <button
              key={quest.id}
              onClick={() => onOpenQuest(quest)}
              className={cn(
                'group min-w-[176px] max-w-[208px] flex-1 rounded-md border bg-black/30 p-2.5 text-left transition hover:-translate-y-0.5',
                selected
                  ? 'border-[rgba(240,232,208,0.34)] shadow-[0_0_24px_rgba(240,232,208,0.08)]'
                  : 'border-[rgba(212,180,131,0.12)] hover:border-[rgba(240,232,208,0.28)]',
              )}
              style={{ boxShadow: selected ? `0 0 24px ${quest.tone}22` : undefined }}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/30" style={{ color: quest.tone }}>
                  {complete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="flex items-center gap-1 rounded-sm border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#D4B483]">
                  <Crosshair className="h-3 w-3" />
                  {quest.reward}
                </span>
              </div>
              <div className="truncate text-xs font-semibold text-[#F0E8D0]">{quest.title}</div>
              <div className="mt-1 truncate text-[11px] leading-4 text-[#8A7860]">{quest.objective}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percent}%`,
                    background: complete ? '#86C9A0' : `linear-gradient(90deg, ${quest.tone}, #F0E8D0)`,
                  }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[9px]">
                <span className="font-semibold text-[#6A5A3A]">{quest.progress}/{quest.target}</span>
                <span className={cn('font-semibold uppercase tracking-[0.16em]', complete ? 'text-emerald-200' : 'text-[#D4B483]')}>
                  {complete ? 'cleared' : 'play'}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GameScene({
  module,
  metrics,
  intensity,
  pulse,
  scanMode,
  animationsEnabled,
}: {
  module: GameModule
  metrics: GameMetrics
  intensity: number
  pulse: number
  scanMode: boolean
  animationsEnabled: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const moduleRef = useRef(module)
  const metricsRef = useRef(metrics)
  const intensityRef = useRef(intensity)
  const pulseRef = useRef(0)
  const scanRef = useRef(scanMode)

  useEffect(() => { moduleRef.current = module }, [module])
  useEffect(() => { metricsRef.current = metrics }, [metrics])
  useEffect(() => { intensityRef.current = intensity }, [intensity])
  useEffect(() => { pulseRef.current = Math.min(3, pulseRef.current + 0.9) }, [pulse])
  useEffect(() => { scanRef.current = scanMode }, [scanMode])

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !animationsEnabled
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.set(0, 2.1, 9.2)

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    scene.add(new THREE.AmbientLight(0xf0e8d0, 0.68))
    const key = new THREE.PointLight(0xd4b483, 3.5, 22)
    key.position.set(-3.2, 4.4, 5)
    scene.add(key)
    const rim = new THREE.PointLight(0x7abcd6, 2.2, 18)
    rim.position.set(4.2, 2, 3.5)
    scene.add(rim)

    const root = new THREE.Group()
    scene.add(root)

    const textureLoader = new THREE.TextureLoader()
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()
    const logoBackGeometry = new THREE.BoxGeometry(1.34, 1.34, 0.09, 1, 1, 1)
    const logoFaceGeometry = new THREE.PlaneGeometry(1.17, 1.17)
    const logoHaloGeometry = new THREE.PlaneGeometry(1.72, 1.72)
    const logoCards = APP_LOGO_VISUALS.map((visual, index) => {
      const group = new THREE.Group()
      const color = new THREE.Color(visual.color)
      const secondary = new THREE.Color(visual.secondaryColor)
      const backMaterial = new THREE.MeshPhysicalMaterial({
        color,
        emissive: color.clone().multiplyScalar(0.18),
        metalness: 0.42,
        roughness: 0.24,
        clearcoat: 0.74,
        transparent: true,
        opacity: 0.9,
      })
      const back = new THREE.Mesh(logoBackGeometry, backMaterial)
      group.add(back)

      const texture = textureLoader.load(visual.asset)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = maxAnisotropy
      const faceMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.98,
      })
      const face = new THREE.Mesh(logoFaceGeometry, faceMaterial)
      face.position.z = 0.055
      group.add(face)

      const haloMaterial = new THREE.MeshBasicMaterial({
        color: secondary,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const halo = new THREE.Mesh(logoHaloGeometry, haloMaterial)
      halo.position.z = -0.06
      group.add(halo)

      group.position.x = (index - 2) * 1.08
      root.add(group)
      return { group, backMaterial, faceMaterial, haloMaterial, texture, visual }
    })

    const ringMaterials = [0xd4b483, 0x7abcd6, 0x86c9a0].map(color => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32 }))
    const rings = ringMaterials.map((material, index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.95 + index * 0.42, 0.012, 10, 140), material)
      ring.rotation.set(index * 0.64, index * 0.52, index * 0.34)
      root.add(ring)
      return ring
    })

    const grid = new THREE.GridHelper(10, 20, 0xd4b483, 0x2c2418)
    grid.position.y = -2.25
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.transparent = true
    gridMaterial.opacity = 0.16
    scene.add(grid)

    const packetGeometry = new THREE.SphereGeometry(0.045, 10, 10)
    const packets = Array.from({ length: 72 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 3 === 0 ? 0xd4b483 : index % 3 === 1 ? 0x7abcd6 : 0x86c9a0,
        transparent: true,
        opacity: 0.42,
      })
      const packet = new THREE.Mesh(packetGeometry, material)
      scene.add(packet)
      return packet
    })

    const beaconGeometry = new THREE.OctahedronGeometry(0.12, 0)
    const beacons = Array.from({ length: GAME_MODULES.length }, (_, index) => {
      const gameModule = GAME_MODULES[index]
      const material = new THREE.MeshBasicMaterial({ color: gameModule.color, transparent: true, opacity: 0.66 })
      const beacon = new THREE.Mesh(beaconGeometry, material)
      root.add(beacon)
      return beacon
    })

    const beamMaterial = new THREE.MeshBasicMaterial({ color: 0x7abcd6, transparent: true, opacity: 0.18 })
    const beams = Array.from({ length: 6 }, (_, index) => {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.6, 6), beamMaterial.clone())
      beam.rotation.z = Math.PI / 2
      beam.rotation.y = index * Math.PI / 6
      scene.add(beam)
      return beam
    })

    const resize = () => {
      const rect = parent.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(parent)

    let frame = 0
    let stopped = false
    let currentId = moduleRef.current.id
    const startedAt = performance.now()

    const render = () => {
      if (stopped) return
      const elapsed = (performance.now() - startedAt) / 1000
      const active = moduleRef.current
      const currentMetrics = metricsRef.current
      const activeIntensity = intensityRef.current
      const activePulse = pulseRef.current
      const activeLogoIndex = getAppLogoIndex(active)
      const activeLogo = APP_LOGO_VISUALS[activeLogoIndex]
      const moduleColor = new THREE.Color(activeLogo.color)
      const secondary = new THREE.Color(activeLogo.secondaryColor)
      pulseRef.current = Math.max(0, activePulse - 0.018)

      if (active.id !== currentId) {
        currentId = active.id
        pulseRef.current = 1.8
      }

      const speed = 0.22 + activeIntensity * 0.5 + activePulse * 0.16
      root.rotation.y = Math.sin(elapsed * 0.2) * 0.06

      logoCards.forEach((card, index) => {
        const relative = normalizeLogoOffset(index - activeLogoIndex, APP_LOGO_VISUALS.length)
        const focused = relative === 0
        const logoColor = new THREE.Color(card.visual.color)
        const logoSecondary = new THREE.Color(card.visual.secondaryColor)
        const float = Math.sin(elapsed * 1.4 + index * 0.8)
        card.group.position.set(relative * 1.18, -0.05 + float * 0.035, -Math.abs(relative) * 0.38)
        card.group.rotation.x = -0.08 + Math.sin(elapsed * 0.7 + index) * 0.025
        card.group.rotation.y = -relative * 0.28 + Math.sin(elapsed * 0.56 + index) * 0.045
        card.group.rotation.z = Math.sin(elapsed * 0.5 + index) * 0.018
        card.group.scale.setScalar((focused ? 1.22 : 0.78) + (focused ? activePulse * 0.06 : 0) + float * 0.012)
        card.backMaterial.color.lerp(logoColor, 0.08)
        card.backMaterial.emissive.copy(logoColor).multiplyScalar(focused ? 0.28 + activeIntensity * 0.24 + activePulse * 0.20 : 0.08 + activeIntensity * 0.08)
        card.backMaterial.opacity = focused ? 0.94 : 0.52
        card.faceMaterial.opacity = focused ? 1 : 0.58
        card.haloMaterial.color.lerp(focused ? logoColor : logoSecondary, 0.08)
        card.haloMaterial.opacity = focused ? 0.18 + activeIntensity * 0.18 + activePulse * 0.12 : 0.055
      })

      rings.forEach((ring, index) => {
        ring.rotation.x += (0.0018 + index * 0.0013) * (1 + speed)
        ring.rotation.y += (0.0024 + index * 0.0011) * (1 + speed)
        ring.material.color.lerp(index === 1 ? secondary : moduleColor, 0.045)
        ring.material.opacity = 0.20 + activeIntensity * 0.18 + activePulse * 0.12 - index * 0.035
      })

      beacons.forEach((beacon, index) => {
        const phase = index / GAME_MODULES.length
        const radius = 3.35 + Math.sin(elapsed + index) * 0.08
        const angle = phase * Math.PI * 2 + elapsed * 0.035
        beacon.position.set(Math.cos(angle) * radius, Math.sin(angle * 2) * 0.42, Math.sin(angle) * radius * 0.52)
        const isActive = GAME_MODULES[index]?.id === active.id
        beacon.scale.setScalar(isActive ? 1.7 + activePulse * 0.8 : 0.78 + activeIntensity * 0.38)
        ;(beacon.material as THREE.MeshBasicMaterial).opacity = isActive ? 0.96 : 0.36
      })

      packets.forEach((packet, index) => {
        const laneOffset = (index % 6) - 2.5
        const phase = (elapsed * (0.075 + speed * 0.13) + index / packets.length) % 1
        const arc = Math.sin(phase * Math.PI)
        packet.position.set(
          THREE.MathUtils.lerp(-5.2, 5.2, phase),
          -1.36 + arc * (1.25 + activeIntensity * 0.8) + laneOffset * 0.055,
          Math.sin(phase * Math.PI * 2 + index * 0.7) * (0.48 + activeIntensity * 0.28),
        )
        packet.scale.setScalar(0.76 + arc * 1.45 + activePulse * 0.7)
        const material = packet.material as THREE.MeshBasicMaterial
        material.color.lerp(index % 2 === 0 ? moduleColor : secondary, 0.04)
        material.opacity = 0.18 + arc * 0.42 + activeIntensity * 0.10 + activePulse * 0.08
      })

      beams.forEach((beam, index) => {
        beam.rotation.z = Math.PI / 2 + Math.sin(elapsed * 0.3 + index) * 0.12
        beam.rotation.y = elapsed * 0.08 + index * Math.PI / 6
        beam.scale.set(1, 0.65 + activeIntensity + activePulse * 0.25, 1)
        const material = beam.material as THREE.MeshBasicMaterial
        material.color.lerp(scanRef.current ? moduleColor : secondary, 0.05)
        material.opacity = scanRef.current ? 0.22 + Math.sin(elapsed * 6 + index) * 0.08 : 0.08 + activeIntensity * 0.08
      })

      const providerRatio = currentMetrics.providersTotal ? currentMetrics.providersOnline / currentMetrics.providersTotal : 0
      key.color.lerp(moduleColor, 0.04)
      rim.color.lerp(secondary, 0.04)
      key.intensity = 2.4 + activeIntensity * 2.4 + providerRatio * 0.8
      rim.intensity = 1.3 + activeIntensity * 2.1 + activePulse
      grid.rotation.y = elapsed * 0.018
      renderer.render(scene, camera)
      frame = window.requestAnimationFrame(render)
    }

    if (reducedMotion) renderer.render(scene, camera)
    else frame = window.requestAnimationFrame(render)

    return () => {
      stopped = true
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.dispose()
      logoBackGeometry.dispose()
      logoFaceGeometry.dispose()
      logoHaloGeometry.dispose()
      rings.forEach(ring => ring.geometry.dispose())
      packetGeometry.dispose()
      beaconGeometry.dispose()
      beams.forEach(beam => beam.geometry.dispose())
      grid.geometry.dispose()
      ;[
        ...logoCards.flatMap(card => [card.backMaterial, card.faceMaterial, card.haloMaterial]),
        ...ringMaterials,
        ...packets.map(packet => packet.material),
        ...beacons.map(beacon => beacon.material),
        ...beams.map(beam => beam.material),
        gridMaterial,
      ].forEach(material => {
        if (Array.isArray(material)) material.forEach(item => item.dispose())
        else material.dispose()
      })
      logoCards.forEach(card => card.texture.dispose())
    }
  }, [animationsEnabled])

  return (
    <canvas
      ref={canvasRef}
      aria-label={`${module.title} 3D game module`}
      className="absolute inset-0 h-full w-full opacity-95"
    />
  )
}

function getAppLogoIndex(module: GameModule) {
  if (module.id === 'hermes') return 4
  if (module.id === 'chat' || module.id === 'compare' || module.id === 'migrations' || module.id === 'brief') return 2
  if (module.id === 'agents' || module.id === 'autopilot') return 1
  if (module.id === 'memory' || module.id === 'tasks' || module.id === 'settings') return 3
  return 0
}

function normalizeLogoOffset(offset: number, total: number) {
  const half = Math.floor(total / 2)
  if (offset > half) return offset - total
  if (offset < -half) return offset + total
  return offset
}
