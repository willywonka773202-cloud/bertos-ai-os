'use client'
import { useState, useCallback, useRef } from 'react'
import {
  Rocket, Brain, Users, Zap, Shield, Clock, Play, Pause, Square,
  CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  Moon, Sparkles, Target, Code2, Search, FileText, Bot, Globe,
  Activity, RefreshCw, Copy, FlaskConical, Layers, TrendingUp,
  BookOpen, Terminal, GitBranch, Star,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/bertos/cn'
import { ScrollArea } from '@/components/ui/scroll-area'
import { HologramPanel, RomanDivider, StatusOrb, RouteHero, MetricTile } from '@/components/bertos/hermes'
import {
  useMaxStore,
  type MaxMission, type MaxAutonomy, type MaxDuration,
  type MaxAgentMode, type MaxOutputGoal, type MaxTask,
} from '@/store/bertos/max'

// ─── Agent roles ────────────────────────────────────────────────────────────
const AGENT_ROLES: Array<{ id: string; label: string; icon: React.ReactNode; color: string; desc: string }> = [
  { id: 'product-architect',   label: 'Product Architect',   icon: <Target    className="w-4 h-4" />, color: '#8B5CF6', desc: 'Defines product concept, scope, and roadmap' },
  { id: 'research-analyst',    label: 'Research Analyst',    icon: <Search    className="w-4 h-4" />, color: '#3B82F6', desc: 'Gathers market and technical context' },
  { id: 'ux-designer',         label: 'UX Designer',         icon: <Layers    className="w-4 h-4" />, color: '#EC4899', desc: 'Designs user flows and page structure' },
  { id: 'frontend-engineer',   label: 'Frontend Engineer',   icon: <Code2     className="w-4 h-4" />, color: '#10B981', desc: 'Builds React components and UI' },
  { id: 'backend-engineer',    label: 'Backend Engineer',    icon: <Terminal  className="w-4 h-4" />, color: '#F97316', desc: 'Data models, API routes, logic' },
  { id: 'integration-engineer',label: 'Integration Engineer',icon: <GitBranch className="w-4 h-4" />, color: '#06B6D4', desc: 'Wires providers, tools, and APIs' },
  { id: 'qa-verifier',         label: 'QA Verifier',         icon: <Shield    className="w-4 h-4" />, color: '#EAB308', desc: 'Runs checks, validates outputs' },
  { id: 'memory-curator',      label: 'Memory Curator',      icon: <BookOpen  className="w-4 h-4" />, color: '#A855F7', desc: 'Logs decisions, saves session notes' },
]

// ─── Duration options ────────────────────────────────────────────────────────
const DURATION_OPTIONS: Array<{ value: MaxDuration; label: string; desc: string; minutes: number }> = [
  { value: '30min',    label: '30 min',    desc: 'Quick sprint',        minutes: 30 },
  { value: '2hours',   label: '2 hours',   desc: 'Deep dive',           minutes: 120 },
  { value: 'overnight',label: 'Overnight', desc: '~8 hrs (server on)',  minutes: 480 },
  { value: 'custom',   label: 'Custom',    desc: 'Set your own',        minutes: 0 },
]

// ─── Autonomy options ────────────────────────────────────────────────────────
const AUTONOMY_OPTIONS: Array<{ value: MaxAutonomy; label: string; desc: string; safe: boolean }> = [
  { value: 'plan-only',       label: 'Plan only',         desc: 'Generate research, spec, and task queue. No code changes.', safe: true },
  { value: 'propose-patch',   label: 'Propose patches',   desc: 'Generate reviewable code proposals. Approval required before apply.', safe: true },
  { value: 'research-only',   label: 'Research only',     desc: 'Deep research and product brief. No code at all.', safe: true },
  { value: 'apply-approved',  label: 'Apply approved',    desc: 'Apply patches after explicit per-patch approval gates.', safe: true },
]

// ─── Agent mode options ──────────────────────────────────────────────────────
const AGENT_MODE_OPTIONS: Array<{ value: MaxAgentMode; label: string; desc: string }> = [
  { value: 'solo-planner',     label: 'Solo Planner',         desc: 'One model plans and researches' },
  { value: 'research-builder', label: 'Research + Builder',   desc: 'Research phase then build phase' },
  { value: 'multi-agent',      label: 'Multi-Agent Team',     desc: 'Assign roles to different models' },
  { value: 'max-swarm',        label: 'Max Swarm',            desc: 'All roles active, parallel execution' },
]

// ─── Output goal options ─────────────────────────────────────────────────────
const OUTPUT_GOAL_OPTIONS: Array<{ value: MaxOutputGoal; label: string }> = [
  { value: 'plan-only',           label: 'Plan only' },
  { value: 'research-pack',       label: 'Research pack' },
  { value: 'prototype',           label: 'Working prototype' },
  { value: 'app-scaffold',        label: 'App scaffold' },
  { value: 'code-with-approval',  label: 'Code changes (approval-gated)' },
]

const APP_CATEGORIES = [
  'SaaS tool', 'E-commerce', 'Content/media', 'Social', 'Productivity',
  'Health/fitness', 'Finance', 'Education', 'Gaming', 'Marketplace',
  'AI/ML tool', 'Developer tool', 'Mobile app', 'Data dashboard', 'Other',
]

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ state }: { state: string }) {
  const cfg: Record<string, { color: string; bg: string }> = {
    idle:      { color: 'text-zinc-400',    bg: 'bg-zinc-900' },
    composing: { color: 'text-amber-300',   bg: 'bg-amber-900/30' },
    planning:  { color: 'text-violet-300',  bg: 'bg-violet-900/30' },
    running:   { color: 'text-emerald-300', bg: 'bg-emerald-900/30' },
    paused:    { color: 'text-amber-400',   bg: 'bg-amber-900/30' },
    stopped:   { color: 'text-zinc-400',    bg: 'bg-zinc-800' },
    complete:  { color: 'text-[#D4B483]',   bg: 'bg-[rgba(212,180,131,0.12)]' },
    pending:   { color: 'text-zinc-400',    bg: 'bg-zinc-900' },
    active:    { color: 'text-emerald-300', bg: 'bg-emerald-900/30' },
    blocked:   { color: 'text-red-300',     bg: 'bg-red-900/30' },
    done:      { color: 'text-emerald-300', bg: 'bg-emerald-900/30' },
    skipped:   { color: 'text-zinc-500',    bg: 'bg-zinc-800' },
  }
  const c = cfg[state] ?? cfg.idle
  return (
    <span className={cn('text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full', c.color, c.bg)}>
      {state}
    </span>
  )
}

function AgentCard({ role, task }: { role: typeof AGENT_ROLES[number]; task?: MaxTask }) {
  return (
    <div className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <span style={{ color: role.color }}>{role.icon}</span>
        <span className="text-xs font-semibold text-zinc-200">{role.label}</span>
        {task && <StatusBadge state={task.status} />}
      </div>
      <p className="text-[11px] text-zinc-500">{task?.description ?? role.desc}</p>
      {task?.output && (
        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1">{task.output}</p>
      )}
    </div>
  )
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function MaxModeView() {
  const {
    missions, activeMissionId, createMission, updateMission, deleteMission,
    setActiveMission, addUpdate, addTask, updateTask, resolveApprovalGate, getActiveMission,
  } = useMaxStore()

  const [tab, setTab] = useState<'compose' | 'plan' | 'agents' | 'tasks' | 'updates' | 'gates' | 'report'>('compose')
  const [generating, setGenerating] = useState(false)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  // Composer form state
  const [idea, setIdea] = useState('')
  const [appCategory, setAppCategory] = useState('SaaS tool')
  const [targetUser, setTargetUser] = useState('')
  const [duration, setDuration] = useState<MaxDuration>('2hours')
  const [customMinutes, setCustomMinutes] = useState(60)
  const [autonomy, setAutonomy] = useState<MaxAutonomy>('plan-only')
  const [agentMode, setAgentMode] = useState<MaxAgentMode>('research-builder')
  const [outputGoal, setOutputGoal] = useState<MaxOutputGoal>('plan-only')
  const [safeMode, setSafeMode] = useState(true)
  const [maxIterations, setMaxIterations] = useState(20)

  const abortRef = useRef<AbortController | null>(null)
  const mission = getActiveMission()

  const handleGeneratePlan = useCallback(async () => {
    if (!idea.trim()) { toast.error('Enter an app idea first'); return }
    setGenerating(true)

    const m = createMission({
      idea: idea.trim(),
      appCategory, targetUser: targetUser || 'general users',
      autonomy, duration, customDurationMinutes: customMinutes,
      agentMode, outputGoal, safeMode, maxIterations,
      taskBudget: maxIterations * 3,
    })

    addUpdate(m.id, { message: `Max Mission created: "${idea.trim()}"`, type: 'milestone' })
    setTab('plan')

    try {
      abortRef.current = new AbortController()
      const res = await fetch('/api/max/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: idea.trim(), appCategory,
          targetUser: targetUser || 'general users',
          duration, outputGoal,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`Plan API ${res.status}`)
      const { plan, source } = await res.json() as {
        ok: boolean
        plan: {
          productConcept: string
          assumptions: string[]
          clarifyingQuestions: string[]
          marketInsights: string
          featureRoadmap: string[]
          technicalArchitecture: string
          dataModel: string
          uiRouteMap: string[]
          agentAssignments: Record<string, string>
          riskRegister: string[]
          validationPlan: string[]
          taskBreakdown: Array<{
            title: string; description: string; agentRole: string
            model: string; priority: number; estimatedMinutes: number
          }>
          researchSummary: string
        }
        source: string
      }

      updateMission(m.id, {
        status: 'planning',
        productConcept:       plan.productConcept,
        assumptions:          plan.assumptions,
        clarifyingQuestions:  plan.clarifyingQuestions,
        marketInsights:       plan.marketInsights,
        featureRoadmap:       plan.featureRoadmap,
        technicalArchitecture:plan.technicalArchitecture,
        dataModel:            plan.dataModel,
        uiRouteMap:           plan.uiRouteMap,
        agentAssignments:     plan.agentAssignments,
        riskRegister:         plan.riskRegister,
        validationPlan:       plan.validationPlan,
        researchSummary:      plan.researchSummary,
      })

      // Create tasks from plan
      plan.taskBreakdown.forEach((t, i) => {
        addTask(m.id, {
          title: t.title,
          description: t.description,
          agentRole: t.agentRole,
          model: t.model,
          status: 'pending',
          proofState: 'planned',
          iterationIndex: i,
        })
      })

      addUpdate(m.id, {
        message: `Plan generated via ${source}. ${plan.taskBreakdown.length} tasks queued.`,
        type: 'success',
        nextStep: 'Review the plan and tasks, then start the mission.',
      })

      toast.success(`Max Mission plan ready (${source})`)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      addUpdate(m.id, { message: `Plan generation error: ${(err as Error).message}`, type: 'error' })
      toast.error('Plan generation failed — fallback plan used')
    } finally {
      setGenerating(false)
    }
  }, [idea, appCategory, targetUser, autonomy, duration, customMinutes, agentMode, outputGoal, safeMode, maxIterations, createMission, addUpdate, updateMission, addTask])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    if (mission) {
      updateMission(mission.id, { status: 'stopped', stoppedAt: Date.now() })
      addUpdate(mission.id, { message: 'Mission stopped by user.', type: 'warning' })
    }
    setGenerating(false)
    toast.info('Mission stopped')
  }, [mission, updateMission, addUpdate])

  const handlePause = useCallback(() => {
    if (!mission) return
    const next = mission.status === 'paused' ? 'running' : 'paused'
    updateMission(mission.id, { status: next })
    addUpdate(mission.id, { message: `Mission ${next}.`, type: 'info' })
    toast.info(`Mission ${next}`)
  }, [mission, updateMission, addUpdate])

  const handleNewMission = useCallback(() => {
    setIdea(''); setTargetUser(''); setTab('compose')
    setActiveMission(null)
  }, [setActiveMission])

  const pendingGates = mission?.approvalGates.filter(g => g.status === 'pending') ?? []
  const activeTasks = mission?.tasks.filter(t => t.status === 'active') ?? []
  const doneTasks = mission?.tasks.filter(t => t.status === 'done') ?? []
  const pendingTasks = mission?.tasks.filter(t => t.status === 'pending') ?? []

  const TABS = [
    { id: 'compose', label: 'Compose',  badge: null },
    { id: 'plan',    label: 'Plan',     badge: null },
    { id: 'agents',  label: 'Agents',   badge: null },
    { id: 'tasks',   label: 'Tasks',    badge: mission?.tasks.length ?? null },
    { id: 'updates', label: 'Updates',  badge: mission?.updates.length ?? null },
    { id: 'gates',   label: 'Gates',    badge: pendingGates.length || null },
    { id: 'report',  label: 'Report',   badge: null },
  ] as const

  return (
    <ScrollArea className="h-full">
      <div className="px-4 py-4 max-w-5xl mx-auto">
        <RouteHero
          eyebrow="BertOS Max"
          title="Max Mode"
          subtitle="Overnight Forge — one idea becomes a full research, spec, and code plan"
          seal={<Moon className="w-6 h-6 text-[#D4B483]" />}
        >
          {mission && <StatusBadge state={mission.status} />}
        </RouteHero>

        {/* Safety notice */}
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/6 px-3 py-2.5">
          <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-200/80 leading-relaxed">
            <span className="font-semibold text-amber-300">Max Mode runs while BertOS local server is running.</span>
            {' '}No code is applied without your explicit approval. No paid APIs used unless configured.
            No secrets accessed. All iterations are logged and capped.
          </div>
        </div>

        {/* Mission control bar when mission active */}
        {mission && (
          <HologramPanel tone="violet" className="mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <StatusOrb state={mission.status === 'running' ? 'active' : mission.status === 'paused' ? 'warning' : 'idle'} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-zinc-100 truncate">{mission.idea}</p>
                  <p className="text-[10px] text-zinc-500">
                    Iteration {mission.iterationIndex}/{mission.maxIterations} · {doneTasks.length}/{mission.tasks.length} tasks done
                    {activeTasks.length > 0 && ` · ${activeTasks.length} active`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {mission.status === 'running' && (
                  <button onClick={handlePause} className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-500/20 transition">
                    <Pause className="w-3 h-3" /><span>Pause</span>
                  </button>
                )}
                {mission.status === 'paused' && (
                  <button onClick={handlePause} className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 transition">
                    <Play className="w-3 h-3" /><span>Resume</span>
                  </button>
                )}
                <button onClick={handleStop} className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 transition">
                  <Square className="w-3 h-3" /><span>Stop</span>
                </button>
                <button onClick={handleNewMission} className="flex items-center gap-1.5 rounded-lg border border-[rgba(212,180,131,0.25)] bg-[rgba(212,180,131,0.06)] px-3 py-1.5 text-xs text-[#D4B483] hover:bg-[rgba(212,180,131,0.12)] transition">
                  <Sparkles className="w-3 h-3" /><span>New</span>
                </button>
              </div>
            </div>
          </HologramPanel>
        )}

        {/* Metrics row */}
        {mission && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <MetricTile label="Status" value={mission.status} />
            <MetricTile label="Tasks" value={`${doneTasks.length}/${mission.tasks.length}`} />
            <MetricTile label="Pending gates" value={String(pendingGates.length)} />
            <MetricTile label="Updates" value={String(mission.updates.length)} />
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-[rgba(212,180,131,0.12)] overflow-x-auto pb-0.5">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition flex-shrink-0',
                tab === t.id
                  ? 'border border-b-0 border-[rgba(212,180,131,0.25)] bg-[rgba(212,180,131,0.06)] text-[#D4B483]'
                  : 'text-[#5A4A2A] hover:text-[#C8B080]',
              )}
            >
              {t.label}
              {t.badge !== null && t.badge !== undefined && t.badge > 0 && (
                <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                  t.id === 'gates' ? 'bg-amber-500/30 text-amber-300' : 'bg-zinc-800 text-zinc-400'
                )}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── COMPOSE TAB ── */}
        {tab === 'compose' && (
          <div className="space-y-4">
            <HologramPanel tone="bronze">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-amber-200/60 mb-2">App idea *</label>
                  <textarea
                    value={idea}
                    onChange={e => setIdea(e.target.value)}
                    placeholder="e.g. Build a gym product recommendation app that could become a TikTok affiliate business"
                    rows={3}
                    className="w-full rounded-xl border border-[rgba(212,180,131,0.15)] bg-[rgba(10,8,6,0.60)] px-3 py-2.5 text-sm text-[#E8DDB8] placeholder:text-[#3A2E1A] outline-none resize-none focus:border-[rgba(212,180,131,0.35)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-widest text-amber-200/60 mb-1.5">App category</label>
                    <select value={appCategory} onChange={e => setAppCategory(e.target.value)}
                      className="w-full rounded-xl border border-[rgba(212,180,131,0.15)] bg-[rgba(10,8,6,0.60)] px-3 py-2 text-sm text-[#E8DDB8] outline-none focus:border-[rgba(212,180,131,0.35)]">
                      {APP_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-widest text-amber-200/60 mb-1.5">Target user</label>
                    <input value={targetUser} onChange={e => setTargetUser(e.target.value)}
                      placeholder="e.g. gym-goers aged 18-35"
                      className="w-full rounded-xl border border-[rgba(212,180,131,0.15)] bg-[rgba(10,8,6,0.60)] px-3 py-2 text-sm text-[#E8DDB8] placeholder:text-[#3A2E1A] outline-none focus:border-[rgba(212,180,131,0.35)]" />
                  </div>
                </div>
              </div>
            </HologramPanel>

            <div className="grid grid-cols-2 gap-3">
              {/* Duration */}
              <div className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/55 mb-2.5">Duration</p>
                <div className="space-y-1.5">
                  {DURATION_OPTIONS.map(d => (
                    <button key={d.value} onClick={() => setDuration(d.value)}
                      className={cn('w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition',
                        duration === d.value ? 'bg-[rgba(212,180,131,0.12)] border border-[rgba(212,180,131,0.30)] text-[#D4B483]' : 'border border-transparent text-zinc-500 hover:bg-white/4 hover:text-zinc-300')}>
                      <span className="font-medium">{d.label}</span>
                      <span className="text-[10px] opacity-60">{d.desc}</span>
                    </button>
                  ))}
                  {duration === 'custom' && (
                    <div className="flex items-center gap-2 pt-1">
                      <input type="number" value={customMinutes} onChange={e => setCustomMinutes(+e.target.value)}
                        min={10} max={600}
                        className="w-20 rounded-lg border border-cyan-300/15 bg-slate-900/60 px-2 py-1.5 text-xs text-zinc-100 outline-none" />
                      <span className="text-xs text-zinc-500">minutes</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Autonomy */}
              <div className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/55 mb-2.5">Autonomy level</p>
                <div className="space-y-1.5">
                  {AUTONOMY_OPTIONS.map(a => (
                    <button key={a.value} onClick={() => setAutonomy(a.value)}
                      className={cn('w-full flex items-start gap-2 rounded-lg px-2.5 py-2 text-xs transition',
                        autonomy === a.value ? 'bg-[rgba(212,180,131,0.12)] border border-[rgba(212,180,131,0.30)] text-[#D4B483]' : 'border border-transparent text-zinc-500 hover:bg-white/4 hover:text-zinc-300')}>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{a.label}</div>
                        <div className="text-[10px] opacity-70 leading-snug mt-0.5">{a.desc}</div>
                      </div>
                      {a.safe && <Shield className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Agent mode */}
              <div className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/55 mb-2.5">Agent mode</p>
                <div className="space-y-1.5">
                  {AGENT_MODE_OPTIONS.map(m => (
                    <button key={m.value} onClick={() => setAgentMode(m.value)}
                      className={cn('w-full flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-xs transition',
                        agentMode === m.value ? 'bg-[rgba(212,180,131,0.12)] border border-[rgba(212,180,131,0.30)] text-[#D4B483]' : 'border border-transparent text-zinc-500 hover:bg-white/4 hover:text-zinc-300')}>
                      <div className="text-left">
                        <div className="font-medium">{m.label}</div>
                        <div className="text-[10px] opacity-70">{m.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Output goal + budget */}
              <div className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/55 mb-2">Output goal</p>
                  <div className="space-y-1">
                    {OUTPUT_GOAL_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setOutputGoal(o.value)}
                        className={cn('w-full text-left rounded-lg px-2.5 py-1.5 text-xs transition',
                          outputGoal === o.value ? 'bg-[rgba(212,180,131,0.12)] border border-[rgba(212,180,131,0.30)] text-[#D4B483]' : 'border border-transparent text-zinc-500 hover:bg-white/4 hover:text-zinc-300')}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/55 mb-1.5">Max iterations</p>
                  <div className="flex items-center gap-2">
                    <input type="range" min={5} max={100} value={maxIterations}
                      onChange={e => setMaxIterations(+e.target.value)}
                      className="flex-1 accent-amber-500" />
                    <span className="text-xs text-zinc-300 w-6 text-right">{maxIterations}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => setSafeMode(!safeMode)}
                    className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border transition',
                      safeMode ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300')}>
                    <Shield className="w-3 h-3" />
                    {safeMode ? 'Safe mode ON' : 'Safe mode OFF'}
                  </button>
                </div>
              </div>
            </div>

            <RomanDivider label="launch max mission" />

            <button
              onClick={handleGeneratePlan}
              disabled={generating || !idea.trim()}
              className={cn(
                'w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-sm font-semibold transition-all duration-200',
                idea.trim() && !generating
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:shadow-[0_0_50px_rgba(139,92,246,0.6)]'
                  : 'bg-zinc-800 text-zinc-600 cursor-not-allowed',
              )}
            >
              {generating ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating plan...</> : <><Rocket className="w-4 h-4" />Launch Max Mission</>}
            </button>

            {/* Previous missions */}
            {missions.length > 0 && (
              <div className="mt-6">
                <RomanDivider label="previous missions" />
                <div className="mt-3 space-y-2">
                  {missions.slice(0, 5).map(m => (
                    <button key={m.id} onClick={() => { setActiveMission(m.id); setTab('plan') }}
                      className={cn('w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-xs transition text-left',
                        activeMissionId === m.id ? 'border-violet-500/30 bg-violet-500/10 text-violet-200' : 'border-cyan-300/10 bg-slate-950/50 text-zinc-400 hover:border-cyan-300/20 hover:text-zinc-300')}>
                      <Moon className="w-3.5 h-3.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{m.idea}</p>
                        <p className="text-[10px] opacity-60">{m.appCategory} · {new Date(m.createdAt).toLocaleDateString()}</p>
                      </div>
                      <StatusBadge state={m.status} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PLAN TAB ── */}
        {tab === 'plan' && (
          <div className="space-y-4">
            {!mission ? (
              <div className="text-center py-12 text-zinc-500 text-sm">No active mission — compose one first</div>
            ) : (
              <>
                {mission.clarifyingQuestions && mission.clarifyingQuestions.length > 0 && (
                  <HologramPanel tone="amber">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300/70 mb-2">Clarifying questions</p>
                    <ul className="space-y-1.5">
                      {mission.clarifyingQuestions.map((q, i) => (
                        <li key={i} className="flex gap-2 text-sm text-zinc-300">
                          <span className="text-amber-400 flex-shrink-0">{i + 1}.</span>{q}
                        </li>
                      ))}
                    </ul>
                  </HologramPanel>
                )}

                {mission.productConcept && (
                  <HologramPanel tone="cyan">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/60 mb-2">Product concept</p>
                    <p className="text-sm text-zinc-200 leading-relaxed">{mission.productConcept}</p>
                  </HologramPanel>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {mission.assumptions && mission.assumptions.length > 0 && (
                    <div className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/55 mb-2">Assumptions</p>
                      <ul className="space-y-1">
                        {mission.assumptions.map((a, i) => (
                          <li key={i} className="text-xs text-zinc-400 flex gap-2"><span className="text-cyan-400">·</span>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {mission.featureRoadmap && mission.featureRoadmap.length > 0 && (
                    <div className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/55 mb-2">Feature roadmap</p>
                      <ul className="space-y-1">
                        {mission.featureRoadmap.map((f, i) => (
                          <li key={i} className="text-xs text-zinc-400 flex gap-2"><Star className="w-2.5 h-2.5 text-amber-400 flex-shrink-0 mt-0.5" />{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {mission.technicalArchitecture && (
                  <div className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/55 mb-2">Technical architecture</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{mission.technicalArchitecture}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {mission.uiRouteMap && mission.uiRouteMap.length > 0 && (
                    <div className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/55 mb-2">UI route map</p>
                      <ul className="space-y-1">
                        {mission.uiRouteMap.map((r, i) => (
                          <li key={i} className="text-xs font-mono text-zinc-400">{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {mission.riskRegister && mission.riskRegister.length > 0 && (
                    <div className="rounded-xl border border-red-500/10 bg-red-950/20 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-red-300/60 mb-2">Risk register</p>
                      <ul className="space-y-1">
                        {mission.riskRegister.map((r, i) => (
                          <li key={i} className="text-xs text-zinc-400 flex gap-2"><AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {mission.researchSummary && (
                  <div className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/55 mb-2">Research summary</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{mission.researchSummary}</p>
                  </div>
                )}

                {!mission.productConcept && generating && (
                  <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/6 px-4 py-3">
                    <RefreshCw className="w-4 h-4 text-violet-400 animate-spin flex-shrink-0" />
                    <span className="text-sm text-violet-300">Generating plan via Ollama Pro...</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── AGENTS TAB ── */}
        {tab === 'agents' && (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              Agent roles are logical assignments within Max Mode. Each role uses an available model/provider.
              {mission?.agentAssignments && ' Current task assignments shown below.'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {AGENT_ROLES.map(role => {
                const assigned = mission?.agentAssignments?.[role.label]
                const task = mission?.tasks.find(t => t.agentRole === role.label && t.status !== 'done')
                return (
                  <div key={role.id} className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span style={{ color: role.color }}>{role.icon}</span>
                      <span className="text-xs font-semibold text-zinc-200">{role.label}</span>
                      {task && <StatusBadge state={task.status} />}
                    </div>
                    <p className="text-[11px] text-zinc-500">{assigned ?? role.desc}</p>
                    {task && <p className="text-[11px] text-zinc-400 line-clamp-2">{task.title}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── TASKS TAB ── */}
        {tab === 'tasks' && (
          <div className="space-y-2">
            {!mission || mission.tasks.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-sm">No tasks yet — generate a plan first</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="rounded-lg border border-cyan-300/10 bg-slate-950/50 p-2 text-center">
                    <p className="text-lg font-bold text-zinc-100">{pendingTasks.length}</p>
                    <p className="text-[10px] text-zinc-500">Pending</p>
                  </div>
                  <div className="rounded-lg border border-emerald-500/10 bg-emerald-950/20 p-2 text-center">
                    <p className="text-lg font-bold text-emerald-300">{activeTasks.length}</p>
                    <p className="text-[10px] text-zinc-500">Active</p>
                  </div>
                  <div className="rounded-lg border border-cyan-500/10 bg-cyan-950/20 p-2 text-center">
                    <p className="text-lg font-bold text-cyan-300">{doneTasks.length}</p>
                    <p className="text-[10px] text-zinc-500">Done</p>
                  </div>
                </div>
                {mission.tasks.map(task => (
                  <div key={task.id} className="rounded-xl border border-cyan-300/8 bg-slate-950/50 overflow-hidden">
                    <button
                      onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-left hover:bg-white/2 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-zinc-200">{task.title}</span>
                          <StatusBadge state={task.status} />
                          <span className="text-[10px] text-zinc-600">{task.agentRole}</span>
                        </div>
                      </div>
                      {expandedTask === task.id ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
                    </button>
                    {expandedTask === task.id && (
                      <div className="px-3 pb-3 border-t border-cyan-300/8 pt-2 space-y-1.5">
                        <p className="text-xs text-zinc-400">{task.description}</p>
                        {task.output && (
                          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2">
                            <p className="text-[10px] font-mono text-zinc-300 whitespace-pre-wrap">{task.output}</p>
                          </div>
                        )}
                        {task.blockedReason && (
                          <p className="text-xs text-red-400 flex gap-1"><AlertTriangle className="w-3 h-3 flex-shrink-0" />{task.blockedReason}</p>
                        )}
                        <div className="flex gap-2 pt-1">
                          {task.status === 'pending' && (
                            <button onClick={() => updateTask(mission.id, task.id, { status: 'active', startedAt: Date.now() })}
                              className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/20 transition">
                              <Play className="w-2.5 h-2.5" />Start
                            </button>
                          )}
                          {task.status === 'active' && (
                            <button onClick={() => updateTask(mission.id, task.id, { status: 'done', proofState: 'verified', completedAt: Date.now() })}
                              className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-300 hover:bg-cyan-500/20 transition">
                              <CheckCircle2 className="w-2.5 h-2.5" />Mark done
                            </button>
                          )}
                          {task.status !== 'done' && (
                            <button onClick={() => updateTask(mission.id, task.id, { status: 'skipped' })}
                              className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-700 transition">
                              Skip
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── UPDATES TAB ── */}
        {tab === 'updates' && (
          <div className="space-y-2">
            {!mission || mission.updates.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-sm">No updates yet</div>
            ) : (
              mission.updates.map(u => (
                <div key={u.id} className={cn(
                  'rounded-xl border px-3 py-2.5 space-y-1',
                  u.type === 'success'   && 'border-emerald-500/15 bg-emerald-950/20',
                  u.type === 'error'     && 'border-red-500/15 bg-red-950/20',
                  u.type === 'warning'   && 'border-amber-500/15 bg-amber-950/20',
                  u.type === 'milestone' && 'border-violet-500/15 bg-violet-950/20',
                  u.type === 'info'      && 'border-cyan-300/10 bg-slate-950/50',
                )}>
                  <div className="flex items-center gap-2">
                    {u.type === 'success'   && <CheckCircle2  className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                    {u.type === 'error'     && <XCircle       className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                    {u.type === 'warning'   && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                    {u.type === 'milestone' && <Rocket        className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
                    {u.type === 'info'      && <Activity      className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                    <p className="text-xs text-zinc-200 flex-1">{u.message}</p>
                    <span className="text-[10px] text-zinc-600 flex-shrink-0">{new Date(u.timestamp).toLocaleTimeString()}</span>
                  </div>
                  {u.nextStep && <p className="text-[11px] text-zinc-500 pl-5">Next: {u.nextStep}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── GATES TAB ── */}
        {tab === 'gates' && (
          <div className="space-y-3">
            {!mission || mission.approvalGates.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-sm">No approval gates yet</div>
            ) : (
              mission.approvalGates.map(gate => (
                <HologramPanel key={gate.id} tone={gate.status === 'pending' ? 'amber' : 'cyan'}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-semibold text-zinc-200">{gate.title}</span>
                        <StatusBadge state={gate.status} />
                      </div>
                      <p className="text-xs text-zinc-400">{gate.description}</p>
                    </div>
                    {gate.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => resolveApprovalGate(mission.id, gate.id, true)}
                          className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 transition">
                          <CheckCircle2 className="w-3 h-3" />Approve
                        </button>
                        <button onClick={() => resolveApprovalGate(mission.id, gate.id, false)}
                          className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/20 transition">
                          <XCircle className="w-3 h-3" />Reject
                        </button>
                      </div>
                    )}
                  </div>
                </HologramPanel>
              ))
            )}
          </div>
        )}

        {/* ── REPORT TAB ── */}
        {tab === 'report' && (
          <div className="space-y-4">
            {!mission ? (
              <div className="text-center py-12 text-zinc-500 text-sm">No active mission</div>
            ) : (
              <>
                <HologramPanel tone="cyan">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/60">Morning report</p>
                    {!mission.morningReport && (
                      <button onClick={() => {
                        const report = [
                          `# Max Mission Report\n\n**Idea:** ${mission.idea}`,
                          `**Status:** ${mission.status}`,
                          `**Tasks:** ${doneTasks.length}/${mission.tasks.length} complete`,
                          `**Updates:** ${mission.updates.length} logged`,
                          '\n## What was accomplished',
                          doneTasks.length > 0 ? doneTasks.map(t => `- ✅ ${t.title}`).join('\n') : '- No tasks completed yet',
                          '\n## Product concept',
                          mission.productConcept ?? 'Plan not generated yet',
                          '\n## Feature roadmap',
                          (mission.featureRoadmap ?? []).map(f => `- ${f}`).join('\n'),
                          '\n## Risk register',
                          (mission.riskRegister ?? []).map(r => `- ⚠️ ${r}`).join('\n'),
                          '\n## Next recommended step',
                          pendingTasks.length > 0 ? `Continue with: ${pendingTasks[0].title}` : 'Mission complete — review output and plan next phase.',
                        ].join('\n')
                        updateMission(mission.id, { morningReport: report })
                        toast.success('Report generated')
                      }}
                        className="flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/10 px-2.5 py-1.5 text-[11px] text-violet-300 hover:bg-violet-500/20 transition">
                        <FlaskConical className="w-3 h-3" />Generate
                      </button>
                    )}
                    {mission.morningReport && (
                      <button onClick={() => { navigator.clipboard.writeText(mission.morningReport!); toast.success('Copied') }}
                        className="flex items-center gap-1.5 rounded-lg border border-[rgba(212,180,131,0.25)] bg-[rgba(212,180,131,0.06)] px-2.5 py-1.5 text-[11px] text-[#D4B483] hover:bg-[rgba(212,180,131,0.12)] transition">
                        <Copy className="w-3 h-3" />Copy
                      </button>
                    )}
                  </div>
                  {mission.morningReport ? (
                    <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">{mission.morningReport}</pre>
                  ) : (
                    <p className="text-xs text-zinc-500">Click Generate to create a summary report of this mission.</p>
                  )}
                </HologramPanel>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/55 mb-2">Validation plan</p>
                    <ul className="space-y-1">
                      {(mission.validationPlan ?? ['npm run typecheck', 'npm run build']).map((v, i) => (
                        <li key={i} className="text-xs font-mono text-zinc-400">{v}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.50)] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/55 mb-2">Mission stats</p>
                    <div className="space-y-1 text-xs text-zinc-400">
                      <p>Created: {new Date(mission.createdAt).toLocaleString()}</p>
                      <p>Tasks: {doneTasks.length}/{mission.tasks.length}</p>
                      <p>Updates: {mission.updates.length}</p>
                      <p>Gates: {mission.approvalGates.filter(g => g.status === 'approved').length} approved</p>
                      <p>Autonomy: {mission.autonomy}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
