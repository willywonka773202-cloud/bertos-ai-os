'use client'

import type { ReactNode } from 'react'
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
}

export function RouteHero({ eyebrow, title, subtitle, status = 'active', seal, metrics = [], children }: RouteHeroProps) {
  return (
    <HologramPanel tone="cyan" className="mb-5 overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 hermes-grid opacity-35" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
            <StatusOrb state={status} size="lg" />
            <div className="absolute inset-0 flex items-center justify-center text-cyan-100">
              {seal}
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-200/75">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-hermes-gradient sm:text-3xl">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">{subtitle}</p>
          </div>
        </div>
        {children && <div className="relative shrink-0">{children}</div>}
      </div>
      {metrics.length > 0 && (
        <>
          <RomanDivider label="telemetry" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile
                key={metric.label}
                label={metric.label}
                value={metric.value}
                detail={metric.detail}
                tone={metric.tone ?? 'cyan'}
              />
            ))}
          </div>
        </>
      )}
    </HologramPanel>
  )
}
