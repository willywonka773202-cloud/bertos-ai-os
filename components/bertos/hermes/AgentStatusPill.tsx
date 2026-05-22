import { cn } from '@/lib/bertos/cn'

const STATUS_STYLES: Record<string, string> = {
  running: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
  pending: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  paused: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  done: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
  failed: 'border-red-300/30 bg-red-300/10 text-red-100',
  blocked: 'border-red-300/30 bg-red-300/10 text-red-100',
  planned: 'border-zinc-600/60 bg-zinc-900/50 text-zinc-300',
  live: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
  experimental: 'border-violet-300/30 bg-violet-300/10 text-violet-100',
}

export function AgentStatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', STATUS_STYLES[status] ?? STATUS_STYLES.planned, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', status === 'running' ? 'animate-pulse bg-cyan-200' : status === 'done' || status === 'live' ? 'bg-emerald-200' : status === 'failed' || status === 'blocked' ? 'bg-red-200' : 'bg-amber-200')} />
      {status}
    </span>
  )
}
