'use client'
import { cn } from '@/lib/bertos/cn'

interface RomanDividerProps {
  label?: string
  className?: string
}

export function RomanDivider({ label, className }: RomanDividerProps) {
  if (!label) {
    return <div className={cn('hermes-divider', className)} />
  }
  return (
    <div className={cn('relative flex items-center gap-3', className)}>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-600/50 to-transparent" />
      <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300/80 px-2 flex items-center gap-1.5">
        <span className="inline-block w-1 h-1 rotate-45 bg-amber-500" />
        {label}
        <span className="inline-block w-1 h-1 rotate-45 bg-amber-500" />
      </span>
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-600/50 to-transparent" />
    </div>
  )
}
