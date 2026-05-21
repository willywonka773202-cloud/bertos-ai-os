'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DaemonHealth } from '@/lib/bertos/daemon-health'

interface DaemonHealthState {
  health: DaemonHealth | null
  loading: boolean
  lastCheckedAt: number | null
  error: string | null
  refresh: () => Promise<DaemonHealth | null>
}

export function useDaemonHealth(autoRefreshMs = 30000): DaemonHealthState {
  const [health, setHealth] = useState<DaemonHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/local-daemon/health', { cache: 'no-store' })
      const data = await res.json() as DaemonHealth
      setHealth(data)
      setError(data.error ?? null)
      setLastCheckedAt(Date.now())
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not check local daemon health.'
      setError(message)
      setHealth(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    if (autoRefreshMs <= 0) return
    const interval = window.setInterval(() => void refresh(), autoRefreshMs)
    return () => window.clearInterval(interval)
  }, [autoRefreshMs, refresh])

  return { health, loading, lastCheckedAt, error, refresh }
}
