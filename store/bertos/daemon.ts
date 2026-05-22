import { create } from 'zustand'
import type { DaemonHealth } from '@/lib/bertos/daemon-health'

interface DaemonStore {
  health: DaemonHealth | null
  loading: boolean
  lastCheckedAt: number | null
  error: string | null
  
  setHealth: (health: DaemonHealth | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  refresh: () => Promise<DaemonHealth | null>
}

export const useDaemonStore = create<DaemonStore>((set, get) => ({
  health: null,
  loading: true,
  lastCheckedAt: null,
  error: null,

  setHealth: (health) => set({ health, lastCheckedAt: Date.now() }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  refresh: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/local-daemon/health', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as DaemonHealth
      set({ health: data, error: data.error ?? null, lastCheckedAt: Date.now(), loading: false })
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not check local daemon health.'
      set({ error: message, health: null, loading: false })
      return null
    }
  },
}))
