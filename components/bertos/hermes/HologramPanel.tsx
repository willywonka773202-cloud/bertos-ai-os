'use client'
import { cn } from '@/lib/bertos/cn'
import type { LucideIcon } from 'lucide-react'

interface HologramPanelProps {
  children: React.ReactNode
  className?: string
  active?: boolean
  bronze?: boolean
  noScanlines?: boolean
}

// A glass command panel with optional cyan-holo or bronze accent border.
// Tactical corner brackets are rendered via inset pseudo elements.
export function HologramPanel({ children, className, active, bronze, noScanlines }: HologramPanelProps) {
  return (
    <div
      className={cn(
        'relative rounded-2xl backdrop-blur-xl overflow-hidden',
        bronze ? 'hermes-bronze' : 'hermes-holo',
        active && 'hermes-holo-active',
        !noScanlines && 'hermes-scanlines',
        className,
      )}
    >
      {/* Corner brackets — top-left & bottom-right cyan ticks */}
      <span className={cn(
        'absolute top-2 left-2 w-3 h-3 border-t border-l pointer-events-none',
        bronze ? 'border-amber-500/50' : 'border-cyan-400/40'
      )} />
      <span className={cn(
        'absolute bottom-2 right-2 w-3 h-3 border-b border-r pointer-events-none',
        bronze ? 'border-amber-500/50' : 'border-cyan-400/40'
      )} />
      <div className="relative z-[1]">{children}</div>
    </div>
  )
}

interface PanelHeaderProps {
  icon?: LucideIcon
  title: string
  subtitle?: string
  action?: React.ReactNode
  tone?: 'cyan' | 'bronze'
  className?: string
}

export function PanelHeader({ icon: Icon, title, subtitle, action, tone = 'cyan', className }: PanelHeaderProps) {
  const colors = tone === 'bronze'
    ? { iconBg: 'bg-amber-600/15 text-amber-300 border-amber-600/30', accent: 'text-amber-200' }
    : { iconBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', accent: 'text-cyan-100' }

  return (
    <div className={cn('flex items-center gap-3 px-5 py-3 border-b border-cyan-500/15', className)}>
      {Icon && (
        <div className={cn('w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0', colors.iconBg)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('text-[11px] font-bold uppercase tracking-[0.2em] truncate', colors.accent)}>{title}</p>
        {subtitle && <p className="text-[10px] text-zinc-500 truncate mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
