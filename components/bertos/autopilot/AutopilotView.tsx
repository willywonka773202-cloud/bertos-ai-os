'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, AlertTriangle, Bot, Bug, CheckCircle2, ChevronRight,
  Clock, Code2, FileSearch, GitBranch, GitCommit, Hammer,
  History, Loader2, Lock, Pause, Play, Power, RefreshCw,
  Server, Shield, ShieldCheck, Sparkles, TestTube, Trash2, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/bertos/cn'
import {
  useAutomationsStore,
  type AutomationAction,
  type AutomationRule,
  type AutomationRun,
  type AutomationRunAction,
} from '@/store/bertos/automations'

const ACTION_META: Record<AutomationAction, { label: string; icon: typeof Activity; tone: string }> = {
  'check-provider-health':       { label: 'Provider Health',   icon: Server,          tone: 'text-blue-400'    },
  'run-typecheck':               { label: 'TypeScript Check',  icon: Code2,           tone: 'text-violet-400'  },
  'run-build':                   { label: 'Production Build',  icon: Hammer,          tone: 'text-amber-400'   },
  'run-lint':                    { label: 'Lint',              icon: AlertTriangle,   tone: 'text-orange-400'  },
  'run-tests':                   { label: 'Test Suite',        icon: TestTube,        tone: 'text-emerald-400' },
  'git-status':                  { label: 'Git Status',        icon: GitBranch,       tone: 'text-emerald-400' },
  'git-diff-stat':               { label: 'Git Diff Stat',     icon: GitCommit,       tone: 'text-blue-400'    },
  'create-agent-plan':           { label: 'Plan with AI',      icon: Bot,             tone: 'text-violet-400'  },
  'create-workspace-debug-task': { label: 'Debug Task',        icon: Bug,             tone: 'text-red-400'     },
  'create-project-health-report':{ label: 'Health Report',     icon: FileSearch,      tone: 'text-emerald-400' },
}

const RISK_META: Record<AutomationRule['risk'], { label: string; color: string; icon: typeof Shield }> = {
  'safe':              { label: 'Safe',              color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: ShieldCheck },
  'approval-required': { label: 'Approval required', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',       icon: Shield      },
  'blocked':           { label: 'Blocked',           color: 'text-red-400 bg-red-500/10 border-red-500/20',             icon: Lock        },
}

const STATUS_META: Record<AutomationRun['status'], { label: string; tone: string; pulse?: boolean }> = {
  'queued':         { label: 'Queued',           tone: 'text-zinc-400 bg-zinc-500/10 border-zinc-700' },
  'running':        { label: 'Running',          tone: 'text-violet-300 bg-violet-500/10 border-violet-500/30', pulse: true },
  'completed':      { label: 'Completed',        tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  'failed':         { label: 'Failed',           tone: 'text-red-300 bg-red-500/10 border-red-500/30' },
  'blocked':        { label: 'Blocked',          tone: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  'needs-approval': { label: 'Awaiting approval',tone: 'text-amber-300 bg-amber-500/10 border-amber-500/30', pulse: true },
}

function formatRelative(iso?: string): string {
  if (!iso) return 'never'
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`
  return `${Math.floor(ms / 86_400_000)}d ago`
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function StatusOrb({ status }: { status: AutomationRun['status'] }) {
  const meta = STATUS_META[status]
  return (
    <span className="relative inline-flex w-2 h-2">
      <span className={cn('absolute inset-0 rounded-full', meta.tone.split(' ')[1])} />
      {meta.pulse && (
        <span className={cn('absolute inset-0 rounded-full animate-ping opacity-60', meta.tone.split(' ')[1])} />
      )}
    </span>
  )
}

function ActionRow({ action, isLast }: { action: AutomationRunAction; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const meta = ACTION_META[action.action]
  const Icon = meta.icon

  const statusIcon = (() => {
    if (action.status === 'running')   return <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
    if (action.status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
    if (action.status === 'failed')    return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
    if (action.status === 'skipped')   return <Pause className="w-3.5 h-3.5 text-zinc-500" />
    return <span className="w-3.5 h-3.5 rounded-full border border-zinc-700" />
  })()

  const hasDetail = Boolean(action.output || action.error)

  return (
    <div className="relative">
      {!isLast && (
        <span className="absolute left-[1.0625rem] top-7 bottom-0 w-px bg-gradient-to-b from-zinc-800 to-transparent" />
      )}
      <div className="flex items-start gap-3 py-1.5">
        <div className={cn(
          'flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-lg border',
          action.status === 'running'   && 'border-violet-500/30 bg-violet-500/5',
          action.status === 'completed' && 'border-emerald-500/30 bg-emerald-500/5',
          action.status === 'failed'    && 'border-red-500/30 bg-red-500/5',
          action.status === 'pending'   && 'border-zinc-800 bg-zinc-950',
          action.status === 'skipped'   && 'border-zinc-800 bg-zinc-950 opacity-50',
        )}>
          <Icon className={cn('w-4 h-4', meta.tone)} />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <button
            onClick={() => hasDetail && setExpanded(v => !v)}
            disabled={!hasDetail}
            className={cn(
              'flex w-full items-center gap-2 text-left',
              hasDetail && 'cursor-pointer hover:text-zinc-200'
            )}
          >
            {statusIcon}
            <span className="text-sm font-medium text-zinc-200">{meta.label}</span>
            {action.durationMs !== undefined && (
              <span className="text-[11px] text-zinc-600 font-mono">{formatDuration(action.durationMs)}</span>
            )}
            {hasDetail && (
              <ChevronRight className={cn('ml-auto w-3.5 h-3.5 text-zinc-600 transition-transform', expanded && 'rotate-90')} />
            )}
          </button>
          <AnimatePresence>
            {expanded && hasDetail && (
              <motion.pre
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border p-3 font-mono text-[11px] leading-5',
                  action.error
                    ? 'border-red-500/30 bg-red-950/30 text-red-200'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                )}
              >
                {action.error || action.output || '(no output)'}
              </motion.pre>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function RuleCard({ rule, lastRun, onRun, onToggle, running }: {
  rule: AutomationRule
  lastRun?: AutomationRun
  onRun: () => void
  onToggle: () => void
  running: boolean
}) {
  const RiskIcon = RISK_META[rule.risk].icon
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-zinc-950/60 p-4 transition-all',
        rule.enabled ? 'border-zinc-800 hover:border-violet-500/30' : 'border-zinc-900 opacity-60'
      )}
    >
      {running && (
        <motion.span
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      )}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-zinc-100 truncate">{rule.name}</h3>
            <div className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium',
              RISK_META[rule.risk].color
            )}>
              <RiskIcon className="w-2.5 h-2.5" />
              {RISK_META[rule.risk].label}
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-zinc-500 mb-3">{rule.description}</p>

          <div className="flex flex-wrap gap-1 mb-3">
            {rule.actions.map(actionId => {
              const meta = ACTION_META[actionId]
              const Icon = meta.icon
              return (
                <div
                  key={actionId}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-900/60 border border-zinc-800 text-[10px] text-zinc-400"
                >
                  <Icon className={cn('w-2.5 h-2.5', meta.tone)} />
                  {meta.label}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-3 text-[10px] text-zinc-600">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> Last: {formatRelative(rule.lastRunAt)}
            </span>
            {lastRun && (
              <span className={cn(
                'inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md border text-[10px]',
                STATUS_META[lastRun.status].tone
              )}>
                <StatusOrb status={lastRun.status} />
                {STATUS_META[lastRun.status].label}
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> {rule.trigger}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggle}
                className={cn(
                  'relative w-9 h-5 rounded-full transition-colors',
                  rule.enabled ? 'bg-violet-500' : 'bg-zinc-800'
                )}
              >
                <motion.span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm"
                  animate={{ left: rule.enabled ? 18 : 2 }}
                  transition={{ duration: 0.15 }}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{rule.enabled ? 'Disable rule' : 'Enable rule'}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-zinc-800/50 flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={onRun}
          disabled={!rule.enabled || running}
          className="text-xs"
        >
          {running ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Running...</>
          ) : (
            <><Play className="w-3 h-3" /> Run now</>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

export function AutopilotView() {
  const {
    rules, runs, activeRunId,
    addRun, updateRun, updateRunAction, setActiveRun, appendLog,
    updateRule, toggleRule,
  } = useAutomationsStore()

  const [runningRuleIds, setRunningRuleIds] = useState<Set<string>>(new Set())
  const abortersRef = useRef<Map<string, AbortController>>(new Map())

  const activeRun = useMemo(() => runs.find(r => r.id === activeRunId) ?? null, [runs, activeRunId])
  const recentRuns = useMemo(() => runs.slice(0, 12), [runs])

  // Auto-select latest running run if none selected
  useEffect(() => {
    if (!activeRunId && runs.length > 0) {
      const running = runs.find(r => r.status === 'running' || r.status === 'needs-approval')
      if (running) setActiveRun(running.id)
    }
  }, [runs, activeRunId, setActiveRun])

  const lastRunPerRule = useMemo(() => {
    const map = new Map<string, AutomationRun>()
    for (const run of runs) {
      if (run.ruleId && !map.has(run.ruleId)) map.set(run.ruleId, run)
    }
    return map
  }, [runs])

  const executeRule = async (rule: AutomationRule) => {
    if (runningRuleIds.has(rule.id)) return

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const runActions: AutomationRunAction[] = rule.actions.map((action, i) => ({
      id: `${runId}-${i}`,
      action,
      status: 'pending',
    }))

    const run: AutomationRun = {
      id: runId,
      ruleId: rule.id,
      title: rule.name,
      status: 'running',
      trigger: 'manual',
      actions: runActions,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      logs: [],
      risk: rule.risk,
    }

    addRun(run)
    setActiveRun(runId)
    updateRule(rule.id, { lastRunAt: new Date().toISOString() })
    setRunningRuleIds(curr => new Set(curr).add(rule.id))

    const controller = new AbortController()
    abortersRef.current.set(runId, controller)

    try {
      const res = await fetch('/api/autopilot/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, ruleId: rule.id, actions: runActions.map(a => ({ id: a.id, action: a.action })) }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => 'Stream failed to start')
        updateRun(runId, { status: 'failed', finishedAt: new Date().toISOString(), summary: err.slice(0, 200) })
        appendLog(runId, `Failed to start: ${err.slice(0, 200)}`)
        toast.error('Autopilot run failed to start')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const rawLine of lines) {
          if (!rawLine.startsWith('data: ')) continue
          const payload = rawLine.slice(6).trim()
          if (!payload || payload === '[DONE]') continue

          try {
            const event = JSON.parse(payload) as Record<string, unknown>
            const type = event.type as string
            const actionId = event.actionId as string | undefined

            if (type === 'action-start' && actionId) {
              updateRunAction(runId, actionId, { status: 'running', startedAt: new Date().toISOString() })
            } else if (type === 'action-complete' && actionId) {
              updateRunAction(runId, actionId, {
                status: 'completed',
                finishedAt: new Date().toISOString(),
                durationMs: event.durationMs as number,
                output: event.output as string,
              })
            } else if (type === 'action-failed' && actionId) {
              updateRunAction(runId, actionId, {
                status: 'failed',
                finishedAt: new Date().toISOString(),
                durationMs: event.durationMs as number,
                error: event.error as string,
              })
            } else if (type === 'approval-required') {
              updateRun(runId, {
                status: 'needs-approval',
                approvalRequired: true,
                summary: event.message as string,
              })
              appendLog(runId, `Approval required: ${event.message}`)
              toast.warning('Autopilot needs approval', { description: event.message as string })
            } else if (type === 'run-blocked') {
              // Already handled by approval-required; nothing extra needed
            } else if (type === 'run-complete') {
              updateRun(runId, {
                status: 'completed',
                finishedAt: new Date().toISOString(),
                summary: event.summary as string,
              })
              toast.success(`${rule.name} complete`)
            } else if (type === 'run-failed') {
              updateRun(runId, {
                status: 'failed',
                finishedAt: new Date().toISOString(),
                summary: event.error as string,
              })
              toast.error(`${rule.name} failed`, { description: event.error as string })
            } else if (type === 'log') {
              appendLog(runId, event.message as string)
            }
          } catch { /* skip malformed event */ }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        updateRun(runId, { status: 'failed', finishedAt: new Date().toISOString(), summary: 'Aborted by user' })
        appendLog(runId, 'Run aborted by user.')
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        updateRun(runId, { status: 'failed', finishedAt: new Date().toISOString(), summary: msg })
        appendLog(runId, `Error: ${msg}`)
        toast.error('Autopilot error', { description: msg })
      }
    } finally {
      abortersRef.current.delete(runId)
      setRunningRuleIds(curr => {
        const next = new Set(curr)
        next.delete(rule.id)
        return next
      })
    }
  }

  const abortRun = (run: AutomationRun) => {
    const aborter = abortersRef.current.get(run.id)
    if (aborter) aborter.abort()
  }

  const enabledCount = rules.filter(r => r.enabled).length
  const activelyRunning = runs.filter(r => r.status === 'running').length
  const awaitingApproval = runs.filter(r => r.status === 'needs-approval').length

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#09090B]">
      {/* Hero header */}
      <header className="border-b border-zinc-800/50 px-6 py-5 flex-shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-blue-500/5 pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="relative">
            <motion.div
              animate={{
                boxShadow: activelyRunning > 0
                  ? ['0 0 0 0 rgba(139,92,246,0.4)', '0 0 0 12px rgba(139,92,246,0)', '0 0 0 0 rgba(139,92,246,0)']
                  : ['0 0 8px rgba(139,92,246,0.15)', '0 0 12px rgba(139,92,246,0.3)', '0 0 8px rgba(139,92,246,0.15)'],
              }}
              transition={{ duration: activelyRunning > 0 ? 1.5 : 3, repeat: Infinity }}
              className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600/80 to-blue-600/80 flex items-center justify-center border border-violet-500/30"
            >
              <Power className="w-5 h-5 text-white" />
            </motion.div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-50">BertOS Autopilot</h1>
              <Badge variant="info" className="text-[10px]">Mission Control</Badge>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Visible, permissioned automation. Every action is logged. Nothing applies without your approval.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-6">
            <Stat label="Rules enabled"        value={enabledCount} total={rules.length} />
            <Stat label="Running now"          value={activelyRunning} tone={activelyRunning > 0 ? 'violet' : 'zinc'} />
            <Stat label="Awaiting approval"   value={awaitingApproval} tone={awaitingApproval > 0 ? 'amber' : 'zinc'} />
          </div>
        </div>
      </header>

      {/* Main split */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_460px]">
        {/* Rules list */}
        <section className="border-r border-zinc-800/50 min-h-0">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-zinc-800/50">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Automation Rules</h2>
            <span className="text-[10px] text-zinc-600 ml-auto">{rules.length} total</span>
          </div>
          <ScrollArea className="h-[calc(100%-2.5rem)]">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 p-6">
              {rules.map(rule => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  lastRun={lastRunPerRule.get(rule.id)}
                  running={runningRuleIds.has(rule.id)}
                  onRun={() => executeRule(rule)}
                  onToggle={() => toggleRule(rule.id)}
                />
              ))}
            </div>

            {/* Recent runs history */}
            <div className="px-6 pb-6">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-3.5 h-3.5 text-zinc-500" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Recent Runs</h2>
                <span className="text-[10px] text-zinc-600 ml-auto">{recentRuns.length}</span>
              </div>
              {recentRuns.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-8 text-center">
                  <Activity className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-600">No runs yet. Trigger a rule above to start.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 divide-y divide-zinc-800/50 overflow-hidden">
                  {recentRuns.map(run => (
                    <button
                      key={run.id}
                      onClick={() => setActiveRun(run.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/4 transition-colors',
                        activeRunId === run.id && 'bg-violet-500/10'
                      )}
                    >
                      <StatusOrb status={run.status} />
                      <span className="text-xs text-zinc-300 truncate flex-1">{run.title}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md border', STATUS_META[run.status].tone)}>
                        {STATUS_META[run.status].label}
                      </span>
                      <span className="text-[10px] text-zinc-600 font-mono w-16 text-right">
                        {formatRelative(run.startedAt ?? run.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </section>

        {/* Active run detail */}
        <aside className="hidden lg:flex flex-col min-h-0 bg-gradient-to-b from-zinc-950/40 to-zinc-950/0">
          {activeRun ? (
            <>
              <div className="px-5 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                <StatusOrb status={activeRun.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{activeRun.title}</p>
                  <p className="text-[10px] text-zinc-600">
                    Started {formatRelative(activeRun.startedAt ?? activeRun.createdAt)}
                  </p>
                </div>
                <div className={cn('text-[10px] px-1.5 py-0.5 rounded-md border', STATUS_META[activeRun.status].tone)}>
                  {STATUS_META[activeRun.status].label}
                </div>
                {activeRun.status === 'running' && (
                  <Button size="sm" variant="ghost" onClick={() => abortRun(activeRun)} className="text-xs">
                    <Pause className="w-3 h-3" /> Abort
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="px-5 py-4 space-y-1">
                  {activeRun.actions.map((action, i) => (
                    <ActionRow
                      key={action.id}
                      action={action}
                      isLast={i === activeRun.actions.length - 1}
                    />
                  ))}
                </div>

                {activeRun.summary && (
                  <div className="px-5 pb-4">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Summary</p>
                      <p className="text-xs text-zinc-300">{activeRun.summary}</p>
                    </div>
                  </div>
                )}

                {activeRun.logs.length > 0 && (
                  <div className="px-5 pb-5">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Log</p>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 max-h-72 overflow-auto">
                      <pre className="text-[10px] font-mono leading-5 text-zinc-500">
                        {activeRun.logs.join('\n')}
                      </pre>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-300">No active run</p>
                <p className="text-[11px] text-zinc-600 mt-1 max-w-[260px] leading-relaxed">
                  Trigger a rule from the left to see a live timeline of every action here.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function Stat({ label, value, total, tone = 'zinc' }: { label: string; value: number; total?: number; tone?: 'violet' | 'amber' | 'zinc' }) {
  const colors: Record<string, string> = {
    violet: 'text-violet-300',
    amber:  'text-amber-300',
    zinc:   'text-zinc-300',
  }
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</p>
      <p className={cn('text-lg font-semibold leading-none mt-1 tabular-nums', colors[tone])}>
        {value}{total !== undefined && <span className="text-zinc-700 text-sm font-normal"> / {total}</span>}
      </p>
    </div>
  )
}
