import { cn } from '@/lib/bertos/cn'

export function RomanDivider({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 py-2.5', className)}>
      {/* Left gilded rule */}
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[rgba(212,180,131,0.40)] to-[rgba(212,180,131,0.15)]" />

      {label ? (
        /* Labelled section — imperial register style */
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="block h-1 w-1 rotate-45 bg-[rgba(212,180,131,0.55)]" />
          <div className="border border-[rgba(212,180,131,0.28)] bg-[rgba(212,180,131,0.05)] px-3.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.36em] text-[rgba(212,180,131,0.80)]">
            {label}
          </div>
          <span className="block h-1 w-1 rotate-45 bg-[rgba(212,180,131,0.55)]" />
        </div>
      ) : (
        /* No label — medallion diamond ornament */
        <div className="shrink-0 flex items-center gap-1">
          <span className="block h-px w-2 bg-[rgba(212,180,131,0.35)]" />
          <span className="block h-1.5 w-1.5 rotate-45 border border-[rgba(212,180,131,0.50)] bg-[rgba(212,180,131,0.12)]" />
          <span className="block h-px w-2 bg-[rgba(212,180,131,0.35)]" />
        </div>
      )}

      {/* Right gilded rule */}
      <div className="h-px flex-1 bg-gradient-to-r from-[rgba(212,180,131,0.15)] via-[rgba(212,180,131,0.40)] to-transparent" />
    </div>
  )
}
