'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/bertos/cn'
import { HologramPanel } from './HologramPanel'
import { MetricTile } from './MetricTile'
import { RomanDivider } from './RomanDivider'
import { StatusOrb } from './StatusOrb'

type RouteHeroMetric = {
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: 'cyan' | 'bronze' | 'emerald' | 'amber' | 'red' | 'violet' | 'zinc'
}

type RouteHeroProps = {
  eyebrow: string
  title: string
  subtitle: string
  status?: 'nominal' | 'active' | 'warning' | 'danger' | 'idle' | 'loading'
  seal?: ReactNode
  metrics?: RouteHeroMetric[]
  children?: ReactNode
  compact?: boolean
}

export function RouteHero({ eyebrow, title, subtitle, status = 'active', seal, metrics = [], children, compact = false }: RouteHeroProps) {
  return (
    <HologramPanel tone="bronze" className={cn('overflow-hidden', compact ? 'mb-3 p-4' : 'mb-5 p-5 md:p-6')}>
      {/* Imperial stone grid overlay */}
      <div className="pointer-events-none absolute inset-0 hermes-grid opacity-30" />
      {/* Monumental arch-light at top center */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(212,180,131,0.10),transparent)]" />
      {/* Gilded column lines at sides */}
      <div className="pointer-events-none absolute left-0 inset-y-0 w-px bg-gradient-to-b from-[rgba(212,180,131,0.40)] via-[rgba(212,180,131,0.12)] to-transparent" />
      <div className="pointer-events-none absolute right-0 inset-y-0 w-px bg-gradient-to-b from-[rgba(212,180,131,0.35)] via-[rgba(212,180,131,0.10)] to-transparent" />

      <div className={cn('relative flex flex-col lg:flex-row lg:items-start lg:justify-between', compact ? 'gap-3' : 'gap-5')}>
        <div className={cn('flex min-w-0', compact ? 'gap-3' : 'gap-4 lg:gap-5')}>
          {/* Celestial seal — imperial medallion */}
          <div className={cn('relative flex shrink-0 items-center justify-center', compact ? 'h-12 w-12' : 'h-14 w-14')}>
            {/* Outer medallion ring */}
            <div className="absolute inset-0 rounded-full border border-[rgba(212,180,131,0.30)] bg-[rgba(212,180,131,0.05)]" />
            <StatusOrb state={status} size="lg" />
            {seal && (
              <div className="absolute inset-0 flex items-center justify-center text-[rgba(240,232,208,0.90)]">
                {seal}
              </div>
            )}
          </div>

          <div className="min-w-0 pt-0.5">
            {/* Imperial eyebrow — diamond-flanked register label */}
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.38em] text-[rgba(212,180,131,0.80)]">
              <span className="block h-1 w-1 rotate-45 bg-[rgba(212,180,131,0.55)]" />
              {eyebrow}
            </div>
            {/* Monumental title */}
            <h1 className={cn('mt-1 font-semibold tracking-tight text-hermes-gradient', compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl')}>
              {title}
            </h1>
            {/* Subtitle — parchment tone */}
            <p className={cn('max-w-3xl leading-relaxed text-[#8A7860]', compact ? 'mt-1 text-xs' : 'mt-2 text-sm')}>{subtitle}</p>
          </div>
        </div>
        {children && <div className="relative shrink-0">{children}</div>}
      </div>

      {metrics.length > 0 && (
        <>
          <RomanDivider label="telemetry" className={compact ? 'mt-3' : 'mt-5'} />
          <div className={cn('grid sm:grid-cols-2 xl:grid-cols-4', compact ? 'gap-2' : 'gap-3')}>
            {metrics.map((metric) => (
              <MetricTile
                key={metric.label}
                label={metric.label}
                value={metric.value}
                detail={metric.detail}
                tone={metric.tone ?? 'bronze'}
                className={compact ? 'p-2.5' : undefined}
              />
            ))}
          </div>
        </>
      )}
    </HologramPanel>
  )
}
