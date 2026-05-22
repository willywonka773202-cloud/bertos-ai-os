'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Copy,
  Loader2,
  Play,
  RefreshCw,
  Shield,
  Terminal,
  ToggleLeft,
  ToggleRight,
  XCircle,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DaemonHealthBanner } from '@/components/bertos/shell/DaemonHealthBanner'
import { cn } from '@/lib/bertos/cn'
import { executeRun } from '@/lib/bertos/autopilot'
import { useDaemonHealth } from '@/hooks/useDaemonHealth'
import { useAgentStore } from '@/store/bertos/agents'
import { useAutomationStore } from '@/store/bertos/automations'
import { useUIStore } from '@/store/bertos/ui'
import type { AutomationAction, AutomationRisk, AutomationRule, AutomationRun } from '@/lib/bertos/types'
import { useRouter } from 'next/navigation'
import { RouteHero } from '@/components/bertos/hermes'

type AutopilotTab = 'overview' | 'rules' | 'queue' | 'logs' | 'safety'

const TAB_LABELS: Record<AutopilotTab, string> = {
  overview: 'Overview',
  rules: 'Rules',
  queue: 'Queue',
  logs: 'Logs',
  safety: 'Safety',
}

const ACTION_LABELS: Record<AutomationAction, string> = {
  'check-provider-health': 'Provider health',
  'run-typecheck': 'Typecheck',
  'run-build': 'Build',
  'run-lint': 'Lint',
  'run-tests': 'Tests',
  'git-status': 'Git status',
  'git-diff-stat': 'Git diff stat',
  'create-agent-plan': 'Create agent plan',
  'create-workspace-debug-task': 'Create workspace debug task',
  'create-project-health-report': 'Project health report',
}

const DAEMON_DEPENDENT_ACTIONS = new Set<AutomationAction>([
  'run-typecheck',
  'run-build',
  'run-lint',
  'run-tests',
  'git-status',
  'git-diff-stat',
  'create-project-health-report',
])

function riskVariant(risk: AutomationRisk) {
  if (risk === 'safe') return 'success'
  if (risk === 'approval-required') return 'warning'
  return 'error'
}

function statusVariant(status: AutomationRun['status']) {
  if (status === 'completed') return 'success'
  if (status === 'failed' || status === 'blocked') return 'error'
  if (status === 'needs-approval') return 'warning'
  return 'default'
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString() : 'Never'
}

function RunRow({
  run,
  running,
  onApprove,
  onReject,
  onOpenWorkspace,
}: {
  run: AutomationRun
  running: boolean
  onApprove: (run: AutomationRun) => void
  onReject: (run: AutomationRun) => void
  onOpenWorkspace: () => void
}) {
  const [expanded, setExpanded] = useState(run.status === 'running' || run.status === 'needs-approval')
  const failed = run.actions.some(action => action.status === 'failed')

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {running ? <Loader2 className="h-4 w-4 animate-spin text-violet-400" /> : run.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : failed ? <XCircle className="h-4 w-4 text-red-400" /> : <Zap className="h-4 w-4 text-zinc-500" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-sm font-semibold text-zinc-200">{run.title}</div>
            <Badge variant={statusVariant(run.status)} className="text-[10px]">{run.status}</Badge>
            <Badge variant={riskVariant(run.risk)} className="text-[10px]">{run.risk}</Badge>
          </div>
          <div className="mt-1 text-[11px] text-zinc-600">{formatTime(run.createdAt)} / {run.trigger}</div>
          {run.summary && <p className="mt-2 text-xs text-zinc-500">{run.summary}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {run.status === 'needs-approval' && (
            <>
              <Button size="sm" onClick={() => onApprove(run)}><Shield className="h-3.5 w-3.5" />Approve</Button>
              <Button size="sm" variant="outline" onClick={() => onReject(run)}>Reject</Button>
            </>
          )}
          {failed && (
            <Button size="sm" variant="outline" onClick={onOpenWorkspace}>Open Workspace</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setExpanded(value => !value)}>
            {expanded ? 'Hide' : 'Details'}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="space-y-2">
            {run.actions.map(action => (
              <div key={action.id} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-300">
                    <Badge variant={action.status === 'completed' ? 'success' : action.status === 'failed' ? 'error' : action.status === 'skipped' ? 'warning' : 'default'} className="text-[10px]">
                      {action.status}
                    </Badge>
                    <span>{ACTION_LABELS[action.action]}</span>
                  </div>
                  {typeof action.durationMs === 'number' && <span className="text-[10px] text-zinc-600">{action.durationMs}ms</span>}
                </div>
                {(action.output || action.error) && (
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-[10px] text-zinc-500">
                    {action.error ?? action.output}
                  </pre>
                )}
              </div>
            ))}
          </div>
          {run.logs.length > 0 && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black/40 p-3 font-mono text-[10px] text-zinc-500">
              {run.logs.join('\n')}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function RuleRow({
  rule,
  running,
  onRun,
}: {
  rule: AutomationRule
  running: boolean
  onRun: (rule: AutomationRule) => void
}) {
  const { toggleRule, deleteRule } = useAutomationStore()
  return (
    <div className={cn('rounded-xl border p-3', rule.enabled ? 'border-zinc-800 bg-zinc-950/80' : 'border-zinc-900 bg-zinc-950/40 opacity-70')}>
      <div className="flex items-start gap-3">
        <button
          onClick={() => toggleRule(rule.id)}
          className={cn('mt-0.5', rule.enabled ? 'text-emerald-400' : 'text-zinc-600')}
          title={rule.enabled ? 'Disable rule' : 'Enable rule'}
        >
          {rule.enabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">{rule.name}</h3>
            <Badge variant={riskVariant(rule.risk)} className="text-[10px]">{rule.risk}</Badge>
            <Badge variant="default" className="text-[10px]">{rule.trigger}</Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{rule.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {rule.actions.map(action => (
              <Badge key={action} variant="default" className="text-[10px]">{ACTION_LABELS[action]}</Badge>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-zinc-700">Last run: {formatTime(rule.lastRunAt)}</div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={() => onRun(rule)} disabled={!rule.enabled || running}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => deleteRule(rule.id)}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

export function AutopilotView() {
  const {
    rules,
    runs,
    autopilotEnabled,
    setAutopilotEnabled,
    queueRun,
    updateRun,
    updateRunAction,
    appendRunLog,
    updateRule,
    clearCompletedRuns,
    rejectRun,
  } = useAutomationStore()
  const { createTask } = useAgentStore()
  const { setPendingAgentTask, setActiveView } = useUIStore()
  const router = useRouter()
  const [tab, setTab] = useState<AutopilotTab>('overview')
  const [activeRunIds, setActiveRunIds] = useState<Set<string>>(new Set())
  const { health, loading: healthLoading, refresh: refreshHealth } = useDaemonHealth()

  const stats = useMemo(() => ({
    enabledRules: rules.filter(rule => rule.enabled).length,
    queued: runs.filter(run => run.status === 'queued').length,
    running: runs.filter(run => run.status === 'running' || activeRunIds.has(run.id)).length,
    completedToday: runs.filter(run => run.status === 'completed' && new Date(run.finishedAt ?? run.createdAt).toDateString() === new Date().toDateString()).length,
    needsApproval: runs.filter(run => run.status === 'needs-approval').length,
    failed: runs.filter(run => run.status === 'failed' || run.status === 'blocked').length,
  }), [rules, runs, activeRunIds])

  const daemonOnline = Boolean(health?.daemonOnline)

  const markRuleLastRun = useCallback((ruleId: string) => {
    updateRule(ruleId, { lastRunAt: new Date().toISOString() })
  }, [updateRule])

  const startRun = useCallback(async (run: AutomationRun) => {
    setActiveRunIds(current => new Set(current).add(run.id))
    setTab('queue')
    try {
      await executeRun(run, {
        updateRun,
        updateRunAction,
        appendRunLog,
        markRuleLastRun,
      }, {
        onAgentPlan: (title, description) => {
          createTask({ title, description, model: 'auto', mode: 'plan' })
          setPendingAgentTask({ title, description })
          toast.success('Agent debug plan queued.')
        },
      })
    } finally {
      setActiveRunIds(current => {
        const next = new Set(current)
        next.delete(run.id)
        return next
      })
    }
  }, [appendRunLog, createTask, markRuleLastRun, setPendingAgentTask, updateRun, updateRunAction])

  const runRule = useCallback((rule: AutomationRule) => {
    const run = queueRun({
      ruleId: rule.id,
      title: rule.name,
      trigger: rule.trigger,
      actions: rule.actions,
      risk: rule.risk,
    })
    const needsDaemon = rule.actions.some(action => DAEMON_DEPENDENT_ACTIONS.has(action))
    if (needsDaemon && !daemonOnline) {
      const message = 'Skipped because local daemon is offline. Start with npm run bertos:daemon.'
      updateRun(run.id, {
        status: 'blocked',
        finishedAt: new Date().toISOString(),
        summary: message,
      })
      for (const action of run.actions) {
        updateRunAction(run.id, action.id, {
          status: DAEMON_DEPENDENT_ACTIONS.has(action.action) ? 'skipped' : 'pending',
          error: DAEMON_DEPENDENT_ACTIONS.has(action.action) ? message : undefined,
          finishedAt: new Date().toISOString(),
        })
      }
      appendRunLog(run.id, message)
      toast.warning(message)
      setTab('queue')
      return
    }
    if (rule.risk === 'approval-required') {
      toast.warning('Run queued and waiting for approval.')
      setTab('queue')
      return
    }
    void startRun(run)
  }, [appendRunLog, daemonOnline, queueRun, startRun, updateRun, updateRunAction])

  const approveRun = useCallback((run: AutomationRun) => {
    updateRun(run.id, { status: 'queued', approvalRequired: false })
    void startRun({ ...run, status: 'queued', approvalRequired: false })
  }, [startRun, updateRun])

  const openWorkspace = useCallback(() => {
    setActiveView('workspace')
    router.push('/workspace')
  }, [router, setActiveView])

  const copyLogs = async () => {
    const text = runs.flatMap(run => [`# ${run.title}`, ...run.logs]).join('\n')
    await navigator.clipboard.writeText(text || 'No Autopilot logs yet.')
    toast.success('Autopilot logs copied.')
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-cyan-300/10 px-6 py-4">
        <RouteHero
          eyebrow="guarded automation oracle"
          title="Bert OS Autopilot"
          subtitle="Permissioned background automation with per-action timelines, approval pauses, daemon checks, and explicit logs. Risky actions surface as gates instead of silently running."
          status={stats.running > 0 ? 'active' : stats.needsApproval > 0 ? 'warning' : autopilotEnabled ? 'nominal' : 'idle'}
          seal={<Zap className="h-5 w-5" />}
          metrics={[
            { label: 'Rules Enabled', value: stats.enabledRules, detail: `${rules.length} total rules`, tone: 'cyan' },
            { label: 'Running', value: stats.running, detail: 'live automation runs', tone: stats.running ? 'cyan' : 'zinc' },
            { label: 'Pending Approval', value: stats.needsApproval, detail: 'human gate required', tone: stats.needsApproval ? 'amber' : 'emerald' },
            { label: 'Daemon', value: daemonOnline ? 'online' : 'offline', detail: health?.workspaceRoot ?? 'local bridge', tone: daemonOnline ? 'emerald' : 'amber' },
          ]}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
                <Zap className="h-4 w-4 text-violet-300" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-zinc-100">Bert OS Autopilot</h1>
                <p className="text-xs text-zinc-500">Controlled background automation for your projects.</p>
              </div>
            </div>
          </div>
          <Button
            variant={autopilotEnabled ? 'default' : 'outline'}
            onClick={() => {
              setAutopilotEnabled(!autopilotEnabled)
              toast(autopilotEnabled ? 'Autopilot paused.' : 'Autopilot ready for guarded triggers.')
            }}
          >
            {autopilotEnabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {autopilotEnabled ? 'Autopilot enabled' : 'Autopilot paused'}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as AutopilotTab[]).map(item => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs transition',
                tab === item ? 'border-violet-500/40 bg-violet-500/10 text-violet-200' : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300',
              )}
            >
              {TAB_LABELS[item]}
            </button>
          ))}
        </div>
      </header>

      <ScrollArea className="flex-1">
        <main className="mx-auto max-w-5xl space-y-4 p-6">
          <DaemonHealthBanner health={health} loading={healthLoading} onRefresh={refreshHealth} />

          {tab === 'overview' && (
            <>
              <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {[
                  ['Daemon', daemonOnline ? 'Online' : 'Offline', daemonOnline ? 'success' : 'warning'],
                  ['Enabled rules', stats.enabledRules, 'success'],
                  ['Queued', stats.queued, 'default'],
                  ['Running', stats.running, 'warning'],
                  ['Completed today', stats.completedToday, 'success'],
                  ['Needs approval', stats.needsApproval, 'warning'],
                  ['Failed/blocked', stats.failed, 'error'],
                ].map(([label, value, variant]) => (
                  <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-[11px] text-zinc-600">{label}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="text-2xl font-semibold text-zinc-100">{value}</div>
                      <Badge variant={variant as 'success' | 'default' | 'warning' | 'error'} className="text-[10px]">live</Badge>
                    </div>
                  </div>
                ))}
              </section>
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <h2 className="mb-3 text-sm font-semibold text-zinc-100">Quick runs</h2>
                  <div className="space-y-2">
                    {rules.slice(0, 4).map(rule => (
                      <RuleRow key={rule.id} rule={rule} running={activeRunIds.size > 0} onRun={runRule} />
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <h2 className="mb-3 text-sm font-semibold text-zinc-100">Latest runs</h2>
                  <div className="space-y-2">
                    {runs.length ? runs.slice(0, 4).map(run => (
                      <RunRow key={run.id} run={run} running={activeRunIds.has(run.id)} onApprove={approveRun} onReject={item => rejectRun(item.id)} onOpenWorkspace={openWorkspace} />
                    )) : <p className="text-sm text-zinc-600">No automation runs yet.</p>}
                  </div>
                </div>
              </section>
            </>
          )}

          {tab === 'rules' && (
            <section className="space-y-3">
              {rules.map(rule => <RuleRow key={rule.id} rule={rule} running={activeRunIds.size > 0} onRun={runRule} />)}
            </section>
          )}

          {tab === 'queue' && (
            <section className="space-y-3">
              {runs.length ? runs.map(run => (
                <RunRow key={run.id} run={run} running={activeRunIds.has(run.id)} onApprove={approveRun} onReject={item => rejectRun(item.id)} onOpenWorkspace={openWorkspace} />
              )) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-10 text-center text-sm text-zinc-600">No queued runs yet.</div>
              )}
            </section>
          )}

          {tab === 'logs' && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-100">Automation logs</h2>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void copyLogs()}><Copy className="h-3.5 w-3.5" />Copy logs</Button>
                  <Button size="sm" variant="ghost" onClick={() => clearCompletedRuns()}><RefreshCw className="h-3.5 w-3.5" />Clear completed</Button>
                </div>
              </div>
              <pre className="min-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black/40 p-3 font-mono text-xs text-zinc-500">
                {runs.length ? runs.flatMap(run => [`# ${run.title} (${run.status})`, ...run.logs, '']).join('\n') : 'No logs yet.'}
              </pre>
            </section>
          )}

          {tab === 'safety' && (
            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-400" />
                <h2 className="text-sm font-semibold text-emerald-100">Auto-allowed</h2>
                <ul className="mt-3 space-y-2 text-xs text-emerald-100/70">
                  <li>Provider health checks</li>
                  <li>Typecheck and build through the safe daemon</li>
                  <li>Git status and diff stat</li>
                  <li>Project health reports</li>
                </ul>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <Shield className="mb-3 h-5 w-5 text-amber-400" />
                <h2 className="text-sm font-semibold text-amber-100">Approval required</h2>
                <ul className="mt-3 space-y-2 text-xs text-amber-100/70">
                  <li>Create agent plans</li>
                  <li>Create Workspace debug tasks</li>
                  <li>Any future patch apply flow</li>
                </ul>
              </div>
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <XCircle className="mb-3 h-5 w-5 text-red-400" />
                <h2 className="text-sm font-semibold text-red-100">Blocked</h2>
                <ul className="mt-3 space-y-2 text-xs text-red-100/70">
                  <li>No git push</li>
                  <li>No package installs</li>
                  <li>No env or secret edits</li>
                  <li>No file deletes or patch applies without approval</li>
                </ul>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Terminal className="h-4 w-4 text-violet-400" />
              Runtime note
            </div>
            <p className="text-xs leading-relaxed text-zinc-500">
              Manual runs are active now. Interval and app-start triggers are intentionally guarded for a later worker/cron phase, so Autopilot assists continuously without becoming an uncontrolled background loop.
            </p>
          </section>
        </main>
      </ScrollArea>
    </div>
  )
}
