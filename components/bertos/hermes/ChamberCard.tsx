import type { ReactNode } from 'react'
import { cn } from '@/lib/bertos/cn'
import { toneClasses, type HermesTone } from '@/lib/bertos/hermes-theme'
import { StatusOrb } from './StatusOrb'

export function ChamberCard({
  children,
  className,
  eyebrow,
  title,
  description,
  meta,
  action,
  status,
  tone = 'zinc',
  interactive = false,
}: {
  children?: ReactNode
  className?: string
  eyebrow?: string
  title?: ReactNode
  description?: ReactNode
  meta?: ReactNode
  action?: ReactNode
  status?: 'nominal' | 'active' | 'warning' | 'danger' | 'idle' | 'loading'
  tone?: HermesTone
  interactive?: boolean
}) {
  return (
    <section
      className={cn(
        'imperium-corners group relative overflow-hidden rounded-xl border backdrop-blur-xl',
        'bg-[linear-gradient(160deg,rgba(16,13,9,0.82),rgba(7,5,3,0.72))]',
        'shadow-[inset_0_1px_0_rgba(240,232,208,0.04),0_16px_50px_rgba(0,0,0,0.24)]',
        toneClasses(tone),
        interactive && 'transition hover:-translate-y-0.5 hover:border-[rgba(212,180,131,0.34)] hover:shadow-[0_20px_70px_rgba(0,0,0,0.34),0_0_28px_rgba(212,180,131,0.08)]',
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(212,180,131,0.38)] to-transparent" />
      <span className="pointer-events-none absolute inset-0 hermes-grid-fine opacity-20" />
      <span className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(122,188,214,0.10),transparent_65%)]" />
      <div className="relative z-10 p-4">
        {(eyebrow || title || description || meta || action || status) && (
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {eyebrow && (
                <div className="mb-1 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-[rgba(212,180,131,0.62)]">
                  <span className="h-1 w-1 rotate-45 bg-current" />
                  {eyebrow}
                </div>
              )}
              {title && <h3 className="font-imperial text-sm font-semibold tracking-wide text-[#F0E8D0]">{title}</h3>}
              {description && <p className="mt-1 text-xs leading-relaxed text-[#8A7A5A]">{description}</p>}
              {meta && <div className="mt-2 text-[11px] text-[#6A5A3A]">{meta}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {status && <StatusOrb state={status} size="sm" />}
              {action}
            </div>
          </div>
        )}
        {children}
      </div>
    </section>
  )
}
