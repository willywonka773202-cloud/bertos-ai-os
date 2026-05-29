'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { executeRun } from '@/lib/bertos/autopilot'
import type { AgentTask, AutomationAction, AutomationRule } from '@/lib/bertos/types'
import { useAgentStore } from '@/store/bertos/agents'
import { useAutomationStore } from '@/store/bertos/automations'
import { useDaemonStore } from '@/store/bertos/daemon'
import { useUIStore } from '@/store/bertos/ui'

const SCHEDULER_TICK_MS = 30000

const DAEMON_DEPENDENT_ACTIONS = new Set<AutomationAction>([
  'run-typecheck',
  'run-build',
  'run-lint',
  'run-tests',
  'git-status',
  'git-diff-stat',
  'create-project-health-report',
])

function parseDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function dailyRunTime(rule: AutomationRule, now: Date) {
  const [hour = 9, minute = 0] = (rule.schedule?.timeOfDay ?? '09:00')
    .split(':')
    .map(value => Number.parseInt(value, 10))
  const next = new Date(now)
  next.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0)
  return next
}

function getNextRunAt(rule: AutomationRule, from: Date) {
  if (rule.trigger === 'interval') {
    const minutes = Math.max(5, rule.schedule?.intervalMinutes ?? 60)
    return new Date(from.getTime() + minutes * 60_000)
  }

  if (rule.trigger === 'daily-review') {
    const next = dailyRunTime(rule, from)
    if (next <= from) next.setDate(next.getDate() + 1)
    return next
  }

  return null
}

function isRuleDue(rule: AutomationRule, now: Date, appStartRules: Set<string>) {
  if (!rule.enabled || rule.trigger === 'manual') return false

  if (rule.trigger === 'app-start') {
    return !appStartRules.has(rule.id)
  }

  if (rule.trigger === 'interval') {
    const nextRunAt = parseDate(rule.schedule?.nextRunAt)
    if (nextRunAt) return nextRunAt <= now

    const lastRunAt = parseDate(rule.lastRunAt)
    if (!lastRunAt) return true

    const intervalMinutes = Math.max(5, rule.schedule?.intervalMinutes ?? 60)
    return lastRunAt.getTime() + intervalMinutes * 60_000 <= now.getTime()
  }

  if (rule.trigger === 'daily-review') {
    const lastRunAt = parseDate(rule.lastRunAt)
    if (lastRunAt && sameLocalDay(lastRunAt, now)) return false
    return now >= dailyRunTime(rule, now)
  }

  return false
}

function hasDaemonDependentAction(rule: AutomationRule) {
  return rule.actions.some(action => DAEMON_DEPENDENT_ACTIONS.has(action))
}

function updateRuleSchedule(rule: AutomationRule, ranAt: Date) {
  const nextRunAt = getNextRunAt(rule, ranAt)?.toISOString()
  useAutomationStore.getState().updateRule(rule.id, {
    lastRunAt: ranAt.toISOString(),
    schedule: rule.schedule || nextRunAt ? { ...rule.schedule, nextRunAt } : rule.schedule,
  })
}

function blockRunForOfflineDaemon(rule: AutomationRule) {
  const store = useAutomationStore.getState()
  const message = 'Skipped because local daemon is offline. Start with npm run bertos:daemon.'
  const run = store.queueRun({
    ruleId: rule.id,
    title: rule.name,
    trigger: rule.trigger,
    actions: rule.actions,
    risk: rule.risk,
  })
  store.updateRun(run.id, {
    status: 'blocked',
    finishedAt: new Date().toISOString(),
    summary: message,
  })
  for (const action of run.actions) {
    store.updateRunAction(run.id, action.id, {
      status: DAEMON_DEPENDENT_ACTIONS.has(action.action) ? 'skipped' : 'pending',
      error: DAEMON_DEPENDENT_ACTIONS.has(action.action) ? message : undefined,
      finishedAt: new Date().toISOString(),
    })
  }
  store.appendRunLog(run.id, `[scheduler] ${message}`)
  updateRuleSchedule(rule, new Date())
  toast.warning(`${rule.name} blocked: daemon offline.`)
}

export function AutomationScheduler() {
  const autopilotEnabled = useAutomationStore(state => state.autopilotEnabled)
  const ensureDefaultRules = useAutomationStore(state => state.ensureDefaultRules)
  const createTask = useAgentStore(state => state.createTask)
  const setPendingAgentTask = useUIStore(state => state.setPendingAgentTask)
  const appStartRules = useRef(new Set<string>())
  const activeRuleIds = useRef(new Set<string>())
  const checking = useRef(false)

  useEffect(() => {
    ensureDefaultRules()
  }, [ensureDefaultRules])

  useEffect(() => {
    if (!autopilotEnabled) return

    let cancelled = false

    const runDueRules = async () => {
      if (cancelled || checking.current) return
      checking.current = true

      try {
        const store = useAutomationStore.getState()
        if (!store.autopilotEnabled) return

        const now = new Date()
        for (const rule of store.rules) {
          if (!isRuleDue(rule, now, appStartRules.current)) continue
          if (activeRuleIds.current.has(rule.id)) continue

          const openRunExists = store.runs.some(run =>
            run.ruleId === rule.id && ['queued', 'running', 'needs-approval'].includes(run.status)
          )
          if (openRunExists) continue

          if (rule.trigger === 'app-start') appStartRules.current.add(rule.id)

          if (hasDaemonDependentAction(rule)) {
            let daemon = useDaemonStore.getState()
            if (daemon.status !== 'connected' && daemon.status !== 'degraded') {
              await daemon.refresh()
              daemon = useDaemonStore.getState()
            }

            if (daemon.status !== 'connected' && daemon.status !== 'degraded') {
              blockRunForOfflineDaemon(rule)
              continue
            }
          }

          const run = store.queueRun({
            ruleId: rule.id,
            title: rule.name,
            trigger: rule.trigger,
            actions: rule.actions,
            risk: rule.risk,
          })

          if (rule.risk === 'approval-required') {
            store.appendRunLog(run.id, '[scheduler] Queued and waiting for approval.')
            updateRuleSchedule(rule, new Date())
            toast.warning(`${rule.name} queued for approval.`)
            continue
          }

          activeRuleIds.current.add(rule.id)
          try {
            await executeRun(run, {
              updateRun: store.updateRun,
              updateRunAction: store.updateRunAction,
              appendRunLog: store.appendRunLog,
              markRuleLastRun: () => updateRuleSchedule(rule, new Date()),
            }, {
              onAgentPlan: (title, description, mode: AgentTask['mode'] = 'plan') => {
                createTask({ title, description, model: 'auto', mode })
                setPendingAgentTask({ title, description })
                toast.success(mode === 'build' ? 'Autopilot visual build task queued.' : 'Autopilot agent plan queued.')
              },
            })
          } finally {
            activeRuleIds.current.delete(rule.id)
          }
        }
      } finally {
        checking.current = false
      }
    }

    void runDueRules()
    const interval = window.setInterval(() => void runDueRules(), SCHEDULER_TICK_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [autopilotEnabled, createTask, setPendingAgentTask])

  return null
}
