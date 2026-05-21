'use client'

import { Copy, RefreshCw, Server } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/bertos/cn'
import { DAEMON_START_COMMAND } from '@/lib/bertos/daemon-health'
import type { DaemonHealth } from '@/lib/bertos/daemon-health'

interface DaemonHealthBannerProps {
  health: DaemonHealth | null
  loading?: boolean
  compact?: boolean
  onRefresh?: () => void | Promise<unknown>
  className?: string
}

export function DaemonHealthBanner({ health, loading, compact, onRefresh, className }: DaemonHealthBannerProps) {
  const online = Boolean(health?.daemonOnline)
  const command = health?.fixCommand || DAEMON_START_COMMAND

  const copyCommand = async () => {
    await navigator.clipboard.writeText(command)
    toast.success('Daemon start command copied.')
  }

  if (online && compact) {
    return (
      <div className={cn('rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200', className)}>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Local daemon online
          {health?.workspaceRoot && <span className="truncate text-emerald-200/60">{health.workspaceRoot}</span>}
        </div>
      </div>
    )
  }

  if (online) return null

  return (
    <div className={cn('rounded-xl border border-amber-500/25 bg-amber-500/10 p-3', className)}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10">
          <Server className="h-4 w-4 text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-amber-100">Local daemon offline</h3>
            <Badge variant="warning" className="text-[10px]">{loading ? 'checking' : 'action needed'}</Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/70">
            Repo commands, workspace file actions, agent runs, and Autopilot checks need <code>{command}</code>.
          </p>
          <p className="mt-1 text-[11px] text-amber-100/50">
            Run commands from repo root: C:\Users\owner\bertos-ai-os
          </p>
          {health?.error && <p className="mt-1 text-[11px] text-amber-100/60">{health.error}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="outline" onClick={() => void copyCommand()}>
            <Copy className="h-3.5 w-3.5" />
            Copy command
          </Button>
          {onRefresh && (
            <Button size="sm" variant="ghost" onClick={() => void onRefresh()}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
