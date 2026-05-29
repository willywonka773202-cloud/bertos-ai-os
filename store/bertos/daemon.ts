import { create } from 'zustand'
import { browserDaemonOfflineHealth, fetchBrowserDaemonHealth } from '@/lib/bertos/browser-daemon'
import type { DaemonHealth } from '@/lib/bertos/daemon-health'

export type DaemonStatus = 'connected' | 'disconnected' | 'checking' | 'degraded' | 'unknown'

// Show degraded after 1 failure, disconnected after this many consecutive failures
const DISCONNECT_THRESHOLD = 3

interface DaemonStore {
  health: DaemonHealth | null
  loading: boolean
  lastCheckedAt: number | null
  lastSeenAt: number | null
  error: string | null
  status: DaemonStatus
  failureCount: number

  setHealth: (health: DaemonHealth | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  refresh: () => Promise<DaemonHealth | null>
}

export const useDaemonStore = create<DaemonStore>((set, get) => ({
  health: null,
  loading: true,
  lastCheckedAt: null,
  lastSeenAt: null,
  error: null,
  status: 'unknown',
  failureCount: 0,

  setHealth: (health) => set({
    health,
    lastCheckedAt: Date.now(),
    lastSeenAt: health?.daemonOnline ? Date.now() : get().lastSeenAt,
    status: health?.daemonOnline ? 'connected' : 'disconnected',
    failureCount: 0,
  }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  refresh: async () => {
    // Don't flash 'checking' if we already have a confirmed connected status —
    // that would cause a visible flicker every 30-second poll cycle.
    const prevStatus = get().status
    const nextStatus = prevStatus === 'connected' ? 'connected' : 'checking'
    set({ loading: true, status: nextStatus })

    const browserHealth = await fetchBrowserDaemonHealth()
    if (browserHealth?.daemonOnline) {
      set({
        health: browserHealth,
        error: browserHealth.error ?? null,
        lastCheckedAt: Date.now(),
        lastSeenAt: Date.now(),
        loading: false,
        status: 'connected',
        failureCount: 0,
      })
      return browserHealth
    }

    try {
      const res = await fetch('/api/local-daemon/health', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as DaemonHealth
      const normalized = data.daemonOnline
        ? data
        : browserDaemonOfflineHealth(data.error ?? 'Hosted BertOS could not reach your Mac daemon from the server. The browser-local bridge is also offline.')
      set({
        health: normalized,
        error: normalized.error ?? null,
        lastCheckedAt: Date.now(),
        lastSeenAt: normalized.daemonOnline ? Date.now() : get().lastSeenAt,
        loading: false,
        status: normalized.daemonOnline ? 'connected' : 'disconnected',
        failureCount: 0,
      })
      return normalized
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not check local daemon health.'
      const prevFailures = get().failureCount + 1
      const prevHealth = get().health

      set({
        // Keep last known health for up to DISCONNECT_THRESHOLD failures
        health: prevFailures >= DISCONNECT_THRESHOLD ? null : prevHealth,
        error: message,
        lastCheckedAt: Date.now(),
        loading: false,
        failureCount: prevFailures,
        // degraded after 1 failure, disconnected only after threshold
        status: prevFailures >= DISCONNECT_THRESHOLD ? 'disconnected' : prevHealth?.daemonOnline ? 'degraded' : 'disconnected',
      })
      return null
    }
  },
}))
