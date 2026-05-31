import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type {
  AutomationRule,
  AutomationRun,
  AutomationRunAction,
  AutomationTrigger,
  AutomationAction,
  AutomationRisk,
} from '@/lib/bertos/types'
import { STARTER_AUTOMATION_RULE_TEMPLATES } from '@/lib/bertos/automation/starters'

// ─── Default rules ─────────────────────────────────────────────────────────

const DEFAULT_RULE_TEMPLATES: Array<Omit<AutomationRule, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'rule-provider-health',
    name: 'Provider Health Check',
    description: 'Ping all configured providers when Autopilot starts and surface any that are offline.',
    enabled: true,
    trigger: 'app-start',
    actions: ['check-provider-health'],
    risk: 'safe',
  },
  {
    id: 'rule-project-build',
    name: 'Project Build Check',
    description: 'Run typecheck and build in sequence using the safe daemon command bridge.',
    enabled: true,
    trigger: 'manual',
    actions: ['run-typecheck', 'run-build'],
    risk: 'safe',
  },
  {
    id: 'rule-git-status',
    name: 'Git Status Report',
    description: 'Run git status and git diff --stat to summarise pending changes.',
    enabled: true,
    trigger: 'manual',
    actions: ['git-status', 'git-diff-stat'],
    risk: 'safe',
  },
  {
    id: 'rule-repo-watch',
    name: 'Repo Change Watch',
    description: 'Every 30 minutes, capture git status and diff stats through the daemon. It does not modify files.',
    enabled: true,
    trigger: 'interval',
    actions: ['git-status', 'git-diff-stat'],
    risk: 'safe',
    schedule: { intervalMinutes: 30 },
  },
  {
    id: 'rule-visual-evolution-loop',
    name: 'Visual Evolution Loop',
    description: 'Every 20 minutes, queue an approval-gated 3D/UI build mission for BertOS. It creates a scoped task and never applies code silently.',
    enabled: true,
    trigger: 'interval',
    actions: ['create-visual-evolution-task'],
    risk: 'approval-required',
    schedule: { intervalMinutes: 20 },
  },
  {
    id: 'rule-daily-review',
    name: 'Daily Project Review',
    description: 'Create a safe project health snapshot for review. It does not modify files.',
    enabled: true,
    trigger: 'daily-review',
    actions: ['check-provider-health', 'git-status', 'create-project-health-report'],
    risk: 'safe',
    schedule: { timeOfDay: '09:00' },
  },
  {
    id: 'rule-build-failure-debug',
    name: 'Build Failure Debug Plan',
    description: 'Run typecheck and prepare an agent debug plan. It pauses for approval.',
    enabled: true,
    trigger: 'build-failed',
    actions: ['run-typecheck', 'create-agent-plan'],
    risk: 'approval-required',
  },
  ...STARTER_AUTOMATION_RULE_TEMPLATES,
]

function buildDefaultRules(): AutomationRule[] {
  const now = new Date().toISOString()
  return DEFAULT_RULE_TEMPLATES.map(rule => ({
    ...rule,
    createdAt: now,
    updatedAt: now,
  }))
}

// ─── Store interface ────────────────────────────────────────────────────────

interface AutomationStore {
  rules: AutomationRule[]
  runs: AutomationRun[]
  autopilotEnabled: boolean

  // Rule management
  createRule: (data: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>) => AutomationRule
  addRule: (data: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>) => AutomationRule
  updateRule: (id: string, updates: Partial<AutomationRule>) => void
  deleteRule: (id: string) => void
  toggleRule: (id: string) => void
  ensureDefaultRules: () => void

  // Run management
  enqueueRun: (opts: {
    ruleId?: string
    title: string
    trigger: AutomationTrigger
    actions: AutomationAction[]
    risk: AutomationRisk
  }) => AutomationRun
  queueRun: (opts: {
    ruleId?: string
    title: string
    trigger: AutomationTrigger
    actions: AutomationAction[]
    risk: AutomationRisk
  }) => AutomationRun
  updateRun: (id: string, updates: Partial<AutomationRun>) => void
  startRun: (id: string) => void
  updateRunAction: (runId: string, actionId: string, updates: Partial<AutomationRunAction>) => void
  completeRun: (id: string, summary?: string) => void
  failRun: (id: string, summary?: string) => void
  blockRun: (id: string, summary?: string) => void
  approveRun: (id: string) => void
  rejectRun: (id: string) => void
  appendRunLog: (runId: string, line: string) => void
  addLog: (runId: string, line: string) => void
  clearRuns: () => void
  clearCompletedRuns: () => void
  getRecentRuns: () => AutomationRun[]
  getEnabledRules: () => AutomationRule[]
  getRunsNeedingApproval: () => AutomationRun[]

  // Autopilot toggle
  setAutopilotEnabled: (enabled: boolean) => void
}

export const useAutomationStore = create<AutomationStore>()(
  persist(
    (set, get): AutomationStore => ({
      rules: buildDefaultRules(),
      runs: [],
      autopilotEnabled: false,

      createRule: (data) => {
        const rule: AutomationRule = {
          ...data,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set(state => ({ rules: [...state.rules, rule] }))
        return rule
      },
      addRule: (data) => get().createRule(data),

      updateRule: (id, updates) =>
        set(state => ({
          rules: state.rules.map(r =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
          ),
        })),

      deleteRule: (id) =>
        set(state => ({ rules: state.rules.filter(r => r.id !== id) })),

      toggleRule: (id) =>
        set(state => ({
          rules: state.rules.map(r =>
            r.id === id ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() } : r
          ),
        })),

      ensureDefaultRules: () =>
        set(state => {
          const existingIds = new Set(state.rules.map(rule => rule.id))
          const missing = buildDefaultRules().filter(rule => !existingIds.has(rule.id))
          return missing.length ? { rules: [...state.rules, ...missing] } : {}
        }),

      enqueueRun: ({ ruleId, title, trigger, actions, risk }) => {
        const runActions: AutomationRunAction[] = actions.map(a => ({
          id: uuidv4(),
          action: a,
          status: 'pending',
        }))
        const run: AutomationRun = {
          id: uuidv4(),
          ruleId,
          title,
          status: risk === 'approval-required' ? 'needs-approval' : 'queued',
          trigger,
          actions: runActions,
          createdAt: new Date().toISOString(),
          logs: [],
          approvalRequired: risk === 'approval-required',
          risk,
        }
        set(state => ({ runs: [run, ...state.runs] }))
        return run
      },
      queueRun: (opts) => get().enqueueRun(opts),

      updateRun: (id, updates) =>
        set(state => ({
          runs: state.runs.map(r => r.id === id ? { ...r, ...updates } : r),
        })),
      startRun: (id) =>
        set(state => ({
          runs: state.runs.map(r => r.id === id ? { ...r, status: 'running', startedAt: new Date().toISOString() } : r),
        })),

      updateRunAction: (runId, actionId, updates) =>
        set(state => ({
          runs: state.runs.map(r =>
            r.id === runId
              ? {
                  ...r,
                  actions: r.actions.map(a =>
                    a.id === actionId ? { ...a, ...updates } : a
                  ),
                }
              : r
          ),
        })),

      appendRunLog: (runId, line) =>
        set(state => ({
          runs: state.runs.map(r =>
            r.id === runId ? { ...r, logs: [...r.logs, line] } : r
          ),
        })),
      addLog: (runId, line) => get().appendRunLog(runId, line),

      completeRun: (id, summary) =>
        set(state => ({
          runs: state.runs.map(r => r.id === id ? { ...r, status: 'completed', finishedAt: new Date().toISOString(), summary } : r),
        })),

      failRun: (id, summary) =>
        set(state => ({
          runs: state.runs.map(r => r.id === id ? { ...r, status: 'failed', finishedAt: new Date().toISOString(), summary } : r),
        })),

      blockRun: (id, summary) =>
        set(state => ({
          runs: state.runs.map(r => r.id === id ? { ...r, status: 'blocked', finishedAt: new Date().toISOString(), summary } : r),
        })),

      approveRun: (id) =>
        set(state => ({
          runs: state.runs.map(r => r.id === id ? { ...r, status: 'queued', approvalRequired: false } : r),
        })),

      rejectRun: (id) =>
        set(state => ({
          runs: state.runs.map(r => r.id === id ? { ...r, status: 'blocked', finishedAt: new Date().toISOString(), summary: 'Rejected by user.' } : r),
        })),

      clearRuns: () => set({ runs: [] }),
      clearCompletedRuns: () =>
        set(state => ({ runs: state.runs.filter(r => !['completed', 'failed', 'blocked'].includes(r.status)) })),

      getRecentRuns: () => get().runs.slice(0, 10),
      getEnabledRules: () => get().rules.filter(rule => rule.enabled),
      getRunsNeedingApproval: () => get().runs.filter(run => run.status === 'needs-approval'),

      setAutopilotEnabled: (enabled) => set({ autopilotEnabled: enabled }),
    }),
    {
      name: 'bertos-automations',
      partialize: (state) => ({
        rules: state.rules,
        runs: state.runs.slice(0, 50), // cap history
        autopilotEnabled: state.autopilotEnabled,
      }),
    }
  )
)
