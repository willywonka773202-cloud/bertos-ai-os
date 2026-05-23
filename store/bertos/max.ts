import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'

export type MaxAutonomy = 'plan-only' | 'propose-patch' | 'apply-approved' | 'research-only'
export type MaxDuration = '30min' | '2hours' | 'overnight' | 'custom'
export type MaxAgentMode = 'solo-planner' | 'research-builder' | 'multi-agent' | 'max-swarm'
export type MaxUpdateInterval = 'every-task' | 'every-15min' | 'every-30min' | 'final-only'
export type MaxOutputGoal = 'plan-only' | 'prototype' | 'code-with-approval' | 'research-pack' | 'app-scaffold'
export type MaxMissionStatus = 'idle' | 'composing' | 'planning' | 'running' | 'paused' | 'stopped' | 'complete'
export type MaxTaskStatus = 'pending' | 'active' | 'blocked' | 'done' | 'skipped'
export type MaxProofState = 'claimed' | 'planned' | 'inspected' | 'proposed' | 'applied' | 'validating' | 'verified' | 'failed' | 'blocked'

export interface MaxTask {
  id: string
  title: string
  description: string
  agentRole: string
  status: MaxTaskStatus
  proofState: MaxProofState
  model: string
  output?: string
  filesAffected?: string[]
  commandsRun?: string[]
  startedAt?: number
  completedAt?: number
  blockedReason?: string
  iterationIndex: number
}

export interface MaxUpdate {
  id: string
  timestamp: number
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'milestone'
  taskId?: string
  filesChanged?: string[]
  checksRun?: string[]
  nextStep?: string
}

export interface MaxApprovalGate {
  id: string
  type: 'patch' | 'markdown-write' | 'run-check' | 'next-iteration' | 'stop'
  title: string
  description: string
  payload?: unknown
  status: 'pending' | 'approved' | 'rejected'
  requestedAt: number
  resolvedAt?: number
}

export interface MaxMission {
  id: string
  idea: string
  appCategory: string
  targetUser: string
  autonomy: MaxAutonomy
  duration: MaxDuration
  customDurationMinutes?: number
  agentMode: MaxAgentMode
  updateInterval: MaxUpdateInterval
  outputGoal: MaxOutputGoal
  safeMode: boolean
  status: MaxMissionStatus
  createdAt: number
  startedAt?: number
  stoppedAt?: number
  iterationIndex: number
  maxIterations: number
  taskBudget: number

  // Generated plan
  clarifyingQuestions?: string[]
  researchSummary?: string
  productConcept?: string
  assumptions?: string[]
  marketInsights?: string
  featureRoadmap?: string[]
  technicalArchitecture?: string
  dataModel?: string
  uiRouteMap?: string[]
  agentAssignments?: Record<string, string>
  riskRegister?: string[]
  validationPlan?: string[]

  tasks: MaxTask[]
  updates: MaxUpdate[]
  approvalGates: MaxApprovalGate[]
  morningReport?: string
}

interface MaxStore {
  missions: MaxMission[]
  activeMissionId: string | null

  createMission: (config: Partial<MaxMission> & { idea: string }) => MaxMission
  updateMission: (id: string, updates: Partial<MaxMission>) => void
  deleteMission: (id: string) => void
  setActiveMission: (id: string | null) => void

  addTask: (missionId: string, task: Omit<MaxTask, 'id'>) => MaxTask
  updateTask: (missionId: string, taskId: string, updates: Partial<MaxTask>) => void

  addUpdate: (missionId: string, update: Omit<MaxUpdate, 'id' | 'timestamp'>) => void
  addApprovalGate: (missionId: string, gate: Omit<MaxApprovalGate, 'id' | 'requestedAt'>) => MaxApprovalGate
  resolveApprovalGate: (missionId: string, gateId: string, approved: boolean) => void

  getActiveMission: () => MaxMission | null
}

export const useMaxStore = create<MaxStore>()(
  persist(
    (set, get) => ({
      missions: [],
      activeMissionId: null,

      createMission: (config) => {
        const mission: MaxMission = {
          id: uuidv4(),
          idea: config.idea,
          appCategory: config.appCategory ?? 'general',
          targetUser: config.targetUser ?? 'general users',
          autonomy: config.autonomy ?? 'plan-only',
          duration: config.duration ?? '2hours',
          agentMode: config.agentMode ?? 'research-builder',
          updateInterval: config.updateInterval ?? 'every-task',
          outputGoal: config.outputGoal ?? 'plan-only',
          safeMode: config.safeMode ?? true,
          status: 'composing',
          createdAt: Date.now(),
          iterationIndex: 0,
          maxIterations: config.maxIterations ?? 20,
          taskBudget: config.taskBudget ?? 50,
          tasks: [],
          updates: [],
          approvalGates: [],
        }
        set(state => ({ missions: [mission, ...state.missions], activeMissionId: mission.id }))
        return mission
      },

      updateMission: (id, updates) =>
        set(state => ({
          missions: state.missions.map(m => m.id === id ? { ...m, ...updates } : m),
        })),

      deleteMission: (id) =>
        set(state => ({
          missions: state.missions.filter(m => m.id !== id),
          activeMissionId: state.activeMissionId === id
            ? (state.missions.find(m => m.id !== id)?.id ?? null)
            : state.activeMissionId,
        })),

      setActiveMission: (id) => set({ activeMissionId: id }),

      addTask: (missionId, taskData) => {
        const task: MaxTask = { ...taskData, id: uuidv4() }
        set(state => ({
          missions: state.missions.map(m =>
            m.id === missionId ? { ...m, tasks: [...m.tasks, task] } : m
          ),
        }))
        return task
      },

      updateTask: (missionId, taskId, updates) =>
        set(state => ({
          missions: state.missions.map(m =>
            m.id === missionId
              ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t) }
              : m
          ),
        })),

      addUpdate: (missionId, updateData) => {
        const update: MaxUpdate = { ...updateData, id: uuidv4(), timestamp: Date.now() }
        set(state => ({
          missions: state.missions.map(m =>
            m.id === missionId ? { ...m, updates: [update, ...m.updates].slice(0, 200) } : m
          ),
        }))
      },

      addApprovalGate: (missionId, gateData) => {
        const gate: MaxApprovalGate = { ...gateData, id: uuidv4(), requestedAt: Date.now() }
        set(state => ({
          missions: state.missions.map(m =>
            m.id === missionId ? { ...m, approvalGates: [...m.approvalGates, gate] } : m
          ),
        }))
        return gate
      },

      resolveApprovalGate: (missionId, gateId, approved) =>
        set(state => ({
          missions: state.missions.map(m =>
            m.id === missionId
              ? {
                  ...m,
                  approvalGates: m.approvalGates.map(g =>
                    g.id === gateId
                      ? { ...g, status: approved ? 'approved' : 'rejected', resolvedAt: Date.now() }
                      : g
                  ),
                }
              : m
          ),
        })),

      getActiveMission: () => {
        const { missions, activeMissionId } = get()
        return missions.find(m => m.id === activeMissionId) ?? null
      },
    }),
    {
      name: 'bertos-max',
      partialize: (state) => ({
        missions: state.missions.slice(0, 20),
        activeMissionId: state.activeMissionId,
      }),
    }
  )
)
