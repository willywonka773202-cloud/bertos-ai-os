'use client'

import type { ReactNode } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Code2,
  Command,
  Layers3,
  Monitor,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Workflow,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/bertos/cn'

interface VisionConceptPanelProps {
  providersOnline: number
  providersTotal: number
  daemonOnline: boolean
  activeAgents: number
  automationApprovals: number
  recentThreadTitle: string
  onOpenBuilder: () => void
  onOpenWorkspace: () => void
  onOpenEvolution: () => void
}

const atlasLanes = [
  { label: 'Intent', value: 'mission compiled', tone: 'text-cyan-200 border-cyan-300/24 bg-cyan-300/8' },
  { label: 'Route', value: 'provider chosen', tone: 'text-amber-200 border-amber-300/24 bg-amber-300/8' },
  { label: 'Patch', value: 'diff staged', tone: 'text-emerald-200 border-emerald-300/24 bg-emerald-300/8' },
  { label: 'Proof', value: 'checks pending', tone: 'text-rose-200 border-rose-300/24 bg-rose-300/8' },
]

const sellableFrames = [
  '16:9 product hero',
  'dashboard poster',
  'app-store feature art',
  'founder demo cover',
]

export function VisionConceptPanel({
  providersOnline,
  providersTotal,
  daemonOnline,
  activeAgents,
  automationApprovals,
  recentThreadTitle,
  onOpenBuilder,
  onOpenWorkspace,
  onOpenEvolution,
}: VisionConceptPanelProps) {
  const providerLabel = providersTotal > 0 ? `${providersOnline}/${providersTotal}` : 'pending'

  return (
    <section className="overflow-hidden rounded-lg border border-[rgba(122,188,214,0.18)] bg-[linear-gradient(145deg,rgba(8,12,14,0.86),rgba(17,13,8,0.82)_48%,rgba(8,7,6,0.92))] shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
      <div className="border-b border-white/8 px-4 py-4 md:px-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="info" className="rounded-md border-cyan-300/24 bg-cyan-300/10 text-cyan-100">
                <Monitor className="h-3 w-3" />
                Visual direction
              </Badge>
              <Badge variant="warning" className="rounded-md border-amber-300/24 bg-amber-300/10 text-amber-100">
                Sellable render candidate
              </Badge>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-[#F2EBD7] md:text-2xl">
              BertOS Atlas: current cockpit beside the future command image
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9A8A68]">
              One implemented concept: keep BertOS honest and operational, then make the system feel like a premium AI engineering desk that can be captured as a hero image.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onOpenBuilder}>
              <Zap className="h-3.5 w-3.5" />
              Forge mission
            </Button>
            <Button size="sm" variant="outline" onClick={onOpenEvolution}>
              <Workflow className="h-3.5 w-3.5" />
              Evolve surface
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="border-b border-white/8 p-4 md:p-5 xl:border-b-0 xl:border-r">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#7ABCD6]/80">what it is now</p>
              <h3 className="mt-1 text-base font-semibold text-[#F0E8D0]">Live operating dashboard</h3>
            </div>
            <Badge variant={daemonOnline ? 'success' : 'warning'} className="rounded-md">
              {daemonOnline ? 'daemon online' : 'daemon offline'}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricPlate icon={<ShieldCheck className="h-4 w-4" />} label="Provider pantheon" value={providerLabel} tone="cyan" />
            <MetricPlate icon={<Bot className="h-4 w-4" />} label="Active agents" value={String(activeAgents)} tone="emerald" />
            <MetricPlate icon={<Command className="h-4 w-4" />} label="Latest oracle" value={recentThreadTitle} tone="amber" wide />
            <MetricPlate icon={<BadgeCheck className="h-4 w-4" />} label="Approval gates" value={String(automationApprovals)} tone="rose" />
          </div>

          <div className="mt-4 rounded-lg border border-[rgba(212,180,131,0.14)] bg-[rgba(10,8,6,0.54)] p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#E8DDB8]">Current visual read</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#6A5A3A]">Hermes command</span>
            </div>
            <div className="space-y-2">
              {['Operational status cards', 'Provider and daemon truth states', 'Mission / proof / safety panels'].map((item, index) => (
                <div key={item} className="flex items-center gap-2 rounded-md border border-white/6 bg-white/[0.025] px-2 py-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded border border-[rgba(212,180,131,0.20)] text-[10px] text-[#D4B483]">
                    {index + 1}
                  </span>
                  <span className="text-xs text-[#B8A878]">{item}</span>
                  <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-300/80" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-amber-200/75">what it could become</p>
              <h3 className="mt-1 text-base font-semibold text-[#F0E8D0]">Atlas command render</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sellableFrames.map(frame => (
                <span key={frame} className="rounded-md border border-white/10 bg-white/[0.035] px-2 py-1 text-[10px] text-[#B8A878]">
                  {frame}
                </span>
              ))}
            </div>
          </div>

          <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-[rgba(122,188,214,0.18)] bg-[#080A0A]">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(122,188,214,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(122,188,214,0.035)_1px,transparent_1px)] bg-[size:34px_34px]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_52%_0%,rgba(122,188,214,0.13),transparent_58%),radial-gradient(ellipse_48%_34%_at_84%_22%,rgba(246,196,83,0.14),transparent_60%)]" />

            <div className="relative z-10 flex min-h-[420px] flex-col p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-200/28 bg-cyan-300/10 text-cyan-100 shadow-[0_0_22px_rgba(122,188,214,0.18)]">
                    <BrainCircuit className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#F4ECD8]">BertOS Atlas</div>
                    <div className="text-[10px] uppercase tracking-[0.24em] text-cyan-100/62">AI engineering operating system</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-emerald-100/70">
                  <span className="h-1.5 w-1.5 rounded-sm bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.6)]" />
                  Proof aware
                </div>
              </div>

              <div className="grid flex-1 gap-3 py-3 lg:grid-cols-[180px_minmax(0,1fr)_190px]">
                <div className="space-y-2">
                  {atlasLanes.map(lane => (
                    <div key={lane.label} className={cn('rounded-lg border p-2.5', lane.tone)}>
                      <div className="text-[10px] uppercase tracking-[0.22em] opacity-70">{lane.label}</div>
                      <div className="mt-1 text-xs font-semibold">{lane.value}</div>
                    </div>
                  ))}
                  <button
                    onClick={onOpenWorkspace}
                    className="mt-3 flex w-full items-center justify-between rounded-lg border border-amber-200/20 bg-amber-200/8 px-3 py-2 text-left text-xs font-semibold text-amber-100 transition hover:border-amber-200/34 hover:bg-amber-200/12"
                  >
                    Open workspace
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-lg border border-white/10 bg-black/28 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#F0E8D0]">Mission spine</span>
                      <Layers3 className="h-4 w-4 text-cyan-100/70" />
                    </div>
                    <div className="grid gap-2 md:grid-cols-3">
                      {['Research', 'Implement', 'Verify'].map((stage, index) => (
                        <div key={stage} className="rounded-md border border-white/8 bg-white/[0.035] p-2">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="grid h-5 w-5 place-items-center rounded border border-cyan-200/20 text-[10px] text-cyan-100">
                              {index + 1}
                            </span>
                            <span className="text-xs font-medium text-[#E8DDB8]">{stage}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded bg-white/8">
                            <div className={cn('h-full rounded', index === 0 ? 'w-full bg-cyan-300' : index === 1 ? 'w-3/4 bg-amber-300' : 'w-1/2 bg-emerald-300')} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/28 p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-emerald-200/80" />
                      <span className="text-xs font-semibold text-[#F0E8D0]">Patch preview</span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px] leading-5">
                      <div className="text-zinc-500">components/bertos/dashboard/VisionConceptPanel.tsx</div>
                      <div className="rounded bg-emerald-300/8 px-2 text-emerald-200">+ future surface maps onto current truth states</div>
                      <div className="rounded bg-cyan-300/8 px-2 text-cyan-100">+ one image-ready command deck, no fake providers</div>
                      <div className="rounded bg-amber-300/8 px-2 text-amber-100">+ proof gate remains visible before release</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#F0E8D0]">
                      <TerminalSquare className="h-4 w-4 text-amber-100/80" />
                      Proof stack
                    </div>
                    {['typecheck', 'build', 'safety', 'smoke'].map((check, index) => (
                      <div key={check} className="mb-2 flex items-center justify-between rounded-md border border-white/6 bg-black/20 px-2 py-1.5 last:mb-0">
                        <span className="text-xs text-[#B8A878]">{check}</span>
                        <span className={cn('h-2 w-2 rounded-sm', index < 2 ? 'bg-emerald-300' : 'bg-amber-300')} />
                      </div>
                    ))}
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#F0E8D0]">
                      <Sparkles className="h-4 w-4 text-cyan-100/80" />
                      Hero image prompt
                    </div>
                    <p className="text-[11px] leading-5 text-[#9A8A68]">
                      Premium AI engineering command deck, Atlas interface, honest status gates, code diffs, provider routing, cinematic product screenshot, sharp readable panels, dark graphite with gold, cyan, emerald, and restrained rose accents.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function MetricPlate({
  icon,
  label,
  value,
  tone,
  wide = false,
}: {
  icon: ReactNode
  label: string
  value: string
  tone: 'cyan' | 'emerald' | 'amber' | 'rose'
  wide?: boolean
}) {
  const toneClass = {
    cyan: 'border-cyan-300/16 bg-cyan-300/8 text-cyan-100',
    emerald: 'border-emerald-300/16 bg-emerald-300/8 text-emerald-100',
    amber: 'border-amber-300/18 bg-amber-300/8 text-amber-100',
    rose: 'border-rose-300/16 bg-rose-300/8 text-rose-100',
  }[tone]

  return (
    <div className={cn('rounded-lg border p-3', toneClass, wide && 'sm:col-span-2')}>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] opacity-75">
        {icon}
        {label}
      </div>
      <div className="truncate text-sm font-semibold text-[#F2EBD7]">{value}</div>
    </div>
  )
}
