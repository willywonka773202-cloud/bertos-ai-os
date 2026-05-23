import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ProgressionAction =
  | 'chat-message'
  | 'project-created'
  | 'task-created'
  | 'task-completed'
  | 'agent-completed'
  | 'validation-passed'
  | 'daemon-online'

export interface PraetoriumMission {
  id: string
  title: string
  description: string
  action: ProgressionAction
  target: number
  xp: number
}

export interface PraetoriumAchievement {
  id: string
  title: string
  description: string
  action: ProgressionAction
  threshold: number
}

interface ProgressionState {
  operatorName: string
  xp: number
  relayStreak: number
  lastRelayDay: string | null
  actionCounts: Record<ProgressionAction, number>
  unlockedAchievements: string[]
  setOperatorName: (name: string) => void
  recordAction: (action: ProgressionAction, amount?: number) => void
}

export const RANKS = [
  { title: 'Cadet', minXp: 0 },
  { title: 'Acolyte', minXp: 120 },
  { title: 'Centurion', minXp: 360 },
  { title: 'Legate', minXp: 720 },
  { title: 'Praetor', minXp: 1200 },
  { title: 'Consul', minXp: 1800 },
  { title: 'Imperator', minXp: 2600 },
] as const

export const PRAETORIUM_MISSIONS: PraetoriumMission[] = [
  {
    id: 'relay-first-signal',
    title: 'Open the Oracle Channel',
    description: 'Send Hermes a real message from Chat or a routed prompt.',
    action: 'chat-message',
    target: 1,
    xp: 20,
  },
  {
    id: 'vault-first-project',
    title: 'Consecrate a Vault',
    description: 'Create a project or memory chamber for focused work.',
    action: 'project-created',
    target: 1,
    xp: 35,
  },
  {
    id: 'mission-first-complete',
    title: 'Close an Operation',
    description: 'Move a task to Complete after real review or validation.',
    action: 'task-completed',
    target: 1,
    xp: 30,
  },
  {
    id: 'forge-validation',
    title: 'Temper the Forge',
    description: 'Run a successful validation check from BertOS.',
    action: 'validation-passed',
    target: 1,
    xp: 45,
  },
]

export const PRAETORIUM_ACHIEVEMENTS: PraetoriumAchievement[] = [
  {
    id: 'first-light',
    title: 'First Light',
    description: 'Local daemon came online.',
    action: 'daemon-online',
    threshold: 1,
  },
  {
    id: 'hermes-relay',
    title: 'Hermes Relay',
    description: 'First Oracle dispatch sent.',
    action: 'chat-message',
    threshold: 1,
  },
  {
    id: 'vault-keeper',
    title: 'Vault Keeper',
    description: 'First project archive created.',
    action: 'project-created',
    threshold: 1,
  },
  {
    id: 'proven-forge',
    title: 'Proven Forge',
    description: 'Validation passed inside BertOS.',
    action: 'validation-passed',
    threshold: 1,
  },
]

const XP_BY_ACTION: Record<ProgressionAction, number> = {
  'chat-message': 8,
  'project-created': 25,
  'task-created': 10,
  'task-completed': 20,
  'agent-completed': 35,
  'validation-passed': 30,
  'daemon-online': 15,
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function daysBetween(prev: string, next: string) {
  const prevTime = new Date(`${prev}T00:00:00`).getTime()
  const nextTime = new Date(`${next}T00:00:00`).getTime()
  return Math.round((nextTime - prevTime) / 86_400_000)
}

function unlocksForCounts(counts: Record<ProgressionAction, number>) {
  return PRAETORIUM_ACHIEVEMENTS
    .filter(achievement => (counts[achievement.action] ?? 0) >= achievement.threshold)
    .map(achievement => achievement.id)
}

export function getRankProgress(xp: number) {
  const currentIndex = RANKS.reduce((idx, rank, index) => (xp >= rank.minXp ? index : idx), 0)
  const current = RANKS[currentIndex]
  const next = RANKS[currentIndex + 1] ?? current
  const span = Math.max(1, next.minXp - current.minXp)
  const progress = current === next ? 100 : Math.min(100, Math.round(((xp - current.minXp) / span) * 100))
  return { current, next, progress }
}

const emptyCounts: Record<ProgressionAction, number> = {
  'chat-message': 0,
  'project-created': 0,
  'task-created': 0,
  'task-completed': 0,
  'agent-completed': 0,
  'validation-passed': 0,
  'daemon-online': 0,
}

export const useProgressionStore = create<ProgressionState>()(
  persist(
    (set, get) => ({
      operatorName: 'Will Lambert',
      xp: 0,
      relayStreak: 0,
      lastRelayDay: null,
      actionCounts: emptyCounts,
      unlockedAchievements: [],
      setOperatorName: (operatorName) => set({ operatorName: operatorName.trim() || 'Operator' }),
      recordAction: (action, amount) => {
        const state = get()
        const counts = {
          ...emptyCounts,
          ...state.actionCounts,
          [action]: (state.actionCounts[action] ?? 0) + 1,
        }
        const today = todayKey()
        const shouldUpdateStreak = action === 'chat-message'
        const relayStreak = shouldUpdateStreak
          ? state.lastRelayDay === today
            ? state.relayStreak
            : state.lastRelayDay && daysBetween(state.lastRelayDay, today) === 1
              ? state.relayStreak + 1
              : 1
          : state.relayStreak
        set({
          actionCounts: counts,
          xp: state.xp + (amount ?? XP_BY_ACTION[action]),
          relayStreak,
          lastRelayDay: shouldUpdateStreak ? today : state.lastRelayDay,
          unlockedAchievements: unlocksForCounts(counts),
        })
      },
    }),
    { name: 'bertos-praetorium-progression' },
  ),
)
