import { cn } from '@/lib/bertos/cn'

export function RomanDivider({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-2', className)}>
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-300/35 to-cyan-300/20" />
      {label && (
        <div className="rounded-full border border-amber-300/25 bg-amber-300/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-100/75">
          {label}
        </div>
      )}
      <div className="h-px flex-1 bg-gradient-to-r from-cyan-300/20 via-amber-300/35 to-transparent" />
    </div>
  )
}
