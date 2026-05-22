import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AutomationTrigger =
  | 'manual'
  | 'app-start'
  | 'interval'
  | 'repo-changed'
  | 'build-failed'
  | 'provider-offline'
  | 'daily-review'

export type AutomationAction =
  | 'check-provider-health'
  | 'run-typecheck'
  | 'run-build'
  | 'run-lint'
  | 'run-tests'
  | 'git-status'
  | 'git-diff-stat'
  | 'create-agent-plan'
  | 'create-workspace-debug-task'
  | 'create-project-health-report'

export type AutomationRisk = 'safe' | 'approval-required' | 'blocked'

export interface AutomationRule {
  id: string
  name: string
  description: string
  enabled: boolean
  trigger: AutomationTrigger
  actions: AutomationAction[]
  risk: AutomationRisk
  schedule?: {
    intervalMinutes?: number
    timeOfDay?: string
    nextRunAt?: string
  }
  createdAt: string
  updatedAt: string
  lastRunAt?: string
}

export interface AutomationRunAction {
  id: string
  action: AutomationAction
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  startedAt?: string
  finishedAt?: string
  durationMs?: number
  output?: string
  error?: string
}

export interface AutomationRun {
  id: string
  ruleId?: string
  title: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'needs-approval'
  trigger: AutomationTrigger
  actions: AutomationRunAction[]
  summary?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  logs: string[]
  approvalRequired?: boolean
  risk: AutomationRisk
}

interface AutomationsStore {
  rules: AutomationRule[]
  runs: AutomationRun[]
  activeRunId: string | null

  addRule: (rule: AutomationRule) => void
  updateRule: (id: string, patch: Partial<AutomationRule>) => void
  deleteRule: (id: string) => void
  toggleRule: (id: string) => void

  addRun: (run: AutomationRun) => void
  updateRun: (id: string, patch: Partial<AutomationRun>) => void
  updateRunAction: (runId: string, actionId: string, patch: Partial<AutomationRunAction>) => void
  setActiveRun: (id: string | null) => void
  appendLog: (runId: string, message: string) => void

  getActiveRun: () => AutomationRun | null
  getRunsByRule: (ruleId: string) => AutomationRun[]
}

const SEED_DATE = '2026-01-01T00:00:00.000Z'

const DEFAULT_RULES: AutomationRule[] = [
  {
    id: 'rule-health-check',
    name: 'Provider Health Check',
    description: 'Ping all AI providers and report which are reachable.',
    enabled: true,
    trigger: 'manual',
    actions: ['check-provider-health'],
    risk: 'safe',
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: 'rule-project-health',
    name: 'Project Health Report',
    description: 'TypeScript check + git status + diff stat. Safe, read-only.',
    enabled: true,
    trigger: 'manual',
    actions: ['run-typecheck', 'git-status', 'git-diff-stat'],
    risk: 'safe',
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: 'rule-full-ci',
    name: 'Full CI Check',
    description: 'Typecheck + build + lint. Requires daemon online.',
    enabled: true,
    trigger: 'manual',
    actions: ['run-typecheck', 'run-build', 'run-lint'],
    risk: 'safe',
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: 'rule-daily-review',
    name: 'Daily Review',
    description: 'Provider health + git status + AI-generated health report. Enable to run on app start.',
    enabled: false,
    trigger: 'daily-review',
    actions: ['check-provider-health', 'git-status', 'create-project-health-report'],
    risk: 'safe',
    schedule: { timeOfDay: '09:00' },
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
  {
    id: 'rule-agent-plan',
    name: 'Create Agent Plan',
    description: 'Ask AI to plan next steps for the project. Requires your approval before any action.',
    enabled: true,
    trigger: 'manual',
    actions: ['git-status', 'create-agent-plan'],
    risk: 'approval-required',
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
  },
]

export const useAutomationsStore = create<AutomationsStore>()(
  persist(
    (set, get) => ({
      rules: DEFAULT_RULES,
      runs: [],
      activeRunId: null,

      addRule: (rule) => set(state => ({ rules: [...state.rules, rule] })),
      updateRule: (id, patch) =>
        set(state => ({
          rules: state.rules.map(r =>
            r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
          ),
        })),
      deleteRule: (id) => set(state => ({ rules: state.rules.filter(r => r.id !== id) })),
      toggleRule: (id) =>
        set(state => ({
          rules: state.rules.map(r =>
            r.id === id ? { ...r, enabled: !r.enabled, updatedAt: new Date().toISOString() } : r
          ),
        })),

      addRun: (run) => set(state => ({ runs: [run, ...state.runs].slice(0, 50) })),
      updateRun: (id, patch) =>
        set(state => ({
          runs: state.runs.map(r => (r.id === id ? { ...r, ...patch } : r)),
        })),
      updateRunAction: (runId, actionId, patch) =>
        set(state => ({
          runs: state.runs.map(r =>
            r.id === runId
              ? {
                  ...r,
                  actions: r.actions.map(a => (a.id === actionId ? { ...a, ...patch } : a)),
                }
              : r
          ),
        })),
      setActiveRun: (id) => set({ activeRunId: id }),
      appendLog: (runId, message) =>
        set(state => ({
          runs: state.runs.map(r =>
            r.id === runId
              ? {
                  ...r,
                  logs: [
                    ...r.logs,
                    `[${new Date().toLocaleTimeString()}] ${message}`,
                  ].slice(-200),
                }
              : r
          ),
        })),

      getActiveRun: () => {
        const { runs, activeRunId } = get()
        return runs.find(r => r.id === activeRunId) ?? null
      },
      getRunsByRule: (ruleId) => get().runs.filter(r => r.ruleId === ruleId),
    }),
    {
      name: 'bertos-automations',
      partialize: (state) => ({
        rules: state.rules,
        runs: state.runs.slice(0, 20),
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AutomationsStore>
        // Merge persisted rules with any new default rules that don't exist yet
        const persistedIds = new Set((p.rules ?? []).map(r => r.id))
        const newDefaults = DEFAULT_RULES.filter(r => !persistedIds.has(r.id))
        return {
          ...current,
          ...p,
          rules: [...(p.rules ?? []), ...newDefaults],
          runs: p.runs ?? [],
          activeRunId: null,
        }
      },
    }
  )
)
