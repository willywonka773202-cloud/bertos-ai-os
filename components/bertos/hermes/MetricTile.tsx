'use client'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'

export type MetricTone = 'cyan' | 'bronze' | 'emerald' | 'amber' | 'red' | 'zinc' | 'violet'

const TONES: Record<MetricTone, { border: string; bg: string; text: string; iconBg: string; accent: string }> = {
  cyan:    { border: 'border-cyan-500/25',  bg: 'bg-cyan-500/[0.04]',  text: 'text-cyan-200',    iconBg: 'bg-cyan-500/15 text-cyan-300',     accent: 'after:bg-cyan-400'    },
  bronze:  { border: 'border-amber-600/35', bg: 'bg-amber-600/[0.04]', text: 'text-amber-200',   iconBg: 'bg-amber-600/15 text-amber-300',   accent: 'after:bg-amber-500'   },
  emerald: { border: 'border-emerald-500/25', bg: 'bg-emerald-500/[0.04]', text: 'text-emerald-200', iconBg: 'bg-emerald-500/15 text-emerald-300', accent: 'after:bg-emerald-400' },
  amber:   { border: 'border-amber-500/25', bg: 'bg-amber-500/[0.04]', text: 'text-amber-200',   iconBg: 'bg-amber-500/15 text-amber-300',   accent: 'after:bg-amber-400'   },
  red:     { border: 'border-red-500/25',   bg: 'bg-red-500/[0.04]',   text: 'text-red-200',     iconBg: 'bg-red-500/15 text-red-300',       accent: 'after:bg-red-400'     },
  zinc:    { border: 'border-zinc-700/60',  bg: 'bg-zinc-900/30',      text: 'text-zinc-200',    iconBg: 'bg-zinc-800/60 text-zinc-400',     accent: 'after:bg-zinc-600'    },
  violet:  { border: 'border-violet-500/25', bg: 'bg-violet-500/[0.04]', text: 'text-violet-200', iconBg: 'bg-violet-500/15 text-violet-300', accent: 'after:bg-violet-400'  },
}

interface MetricTileProps {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: LucideIcon
  tone?: MetricTone
  pulse?: boolean
  className?: string
}

export function MetricTile({ label, value, sub, icon: Icon, tone = 'cyan', pulse = false, className }: MetricTileProps) {
  const t = TONES[tone]
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border px-4 py-3 backdrop-blur-md transition-all',
        // tactical corner brackets via after pseudo
        'after:absolute after:left-3 after:bottom-2 after:h-0.5 after:w-6 after:opacity-70',
        t.border, t.bg, t.accent, className
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {Icon && (
          <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', t.iconBg)}>
            <Icon className="w-3 h-3" />
          </div>
        )}
        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-semibold">{label}</p>
        {pulse && (
          <span className="ml-auto relative inline-flex w-1.5 h-1.5 flex-shrink-0">
            <span className="absolute inset-0 rounded-full bg-cyan-400" />
            <span className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-60" />
          </span>
        )}
      </div>
      <div className={cn('text-base font-bold font-mono tabular-nums truncate', t.text)} title={typeof value === 'string' ? value : undefined}>
        {value}
      </div>
      {sub && <p className="text-[10px] text-zinc-500 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}
