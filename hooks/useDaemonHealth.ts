'use client'

import { useDaemonStore } from '@/store/bertos/daemon'
import type { DaemonHealth } from '@/lib/bertos/daemon-health'

interface DaemonHealthState {
  health: DaemonHealth | null
  loading: boolean
  lastCheckedAt: number | null
  error: string | null
  refresh: () => Promise<DaemonHealth | null>
}

/**
 * Hook to access daemon health state.
 * Polling is managed globally in AppShell.
 */
export function useDaemonHealth(_autoRefreshMs = 30000): DaemonHealthState {
  const { health, loading, lastCheckedAt, error, refresh } = useDaemonStore()
  return { health, loading, lastCheckedAt, error, refresh }
}
