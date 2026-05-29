'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Download,
  ExternalLink,
  Gauge,
  Laptop,
  Layers3,
  Loader2,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Smartphone,
  Target,
  Wifi,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, RouteHero, StatusOrb } from '@/components/bertos/hermes'
import { useDaemonHealth } from '@/hooks/useDaemonHealth'
import type { PublishReadinessCheck, PublishReadinessReport, PublishReadinessStatus } from '@/lib/bertos/readiness-types'
import type { HermesTone } from '@/lib/bertos/hermes-theme'
import type { AiOsBenchmarkFeature, AiOsBenchmarkReport, AiOsFeatureStatus } from '@/lib/bertos/ai-os-benchmark'

type PwaState = {
  standalone: boolean
  installable: boolean
  installedAt: string | null
  serviceWorker: 'unsupported' | 'unregistered' | 'registered'
}

function statusVariant(status: PublishReadinessStatus) {
  if (status === 'ready') return 'success'
  if (status === 'blocked') return 'error'
  if (status === 'warning') return 'warning'
  return 'default'
}

function statusTone(status: PublishReadinessStatus): HermesTone {
  if (status === 'ready') return 'emerald'
  if (status === 'blocked') return 'red'
  if (status === 'warning') return 'amber'
  return 'cyan'
}

function statusIcon(status: PublishReadinessStatus) {
  if (status === 'ready') return <CheckCircle2 className="h-4 w-4 text-emerald-300" />
  if (status === 'blocked') return <XCircle className="h-4 w-4 text-red-300" />
  if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-300" />
  return <ShieldCheck className="h-4 w-4 text-cyan-300" />
}

function initialPwaState(): PwaState {
  if (typeof window === 'undefined') {
    return { standalone: false, installable: false, installedAt: null, serviceWorker: 'unregistered' }
  }
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
  return {
    standalone,
    installable: Boolean(window.__bertosInstallPrompt),
    installedAt: window.localStorage.getItem('bertos-pwa-installed-at'),
    serviceWorker: 'serviceWorker' in navigator
      ? navigator.serviceWorker.controller ? 'registered' : 'unregistered'
      : 'unsupported',
  }
}

export function LaunchReadinessView() {
  const [report, setReport] = useState<PublishReadinessReport | null>(null)
  const [benchmark, setBenchmark] = useState<AiOsBenchmarkReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null)
  const [pwa, setPwa] = useState<PwaState>(() => initialPwaState())
  const [installing, setInstalling] = useState(false)
  const { health, loading: daemonLoading, refresh: refreshDaemon } = useDaemonHealth(30000)

  const load = async () => {
    setLoading(true)
    setError(null)
    setBenchmarkError(null)
    try {
      const [readinessResult, benchmarkResult] = await Promise.allSettled([
        fetch('/api/bertos/readiness', { cache: 'no-store' }).then(res => res.json()),
        fetch('/api/bertos/os-benchmark', { cache: 'no-store' }).then(res => res.json()),
      ])
      if (readinessResult.status === 'rejected' || !readinessResult.value.ok) {
        throw new Error(readinessResult.status === 'rejected' ? readinessResult.reason?.message ?? 'Readiness check failed.' : readinessResult.value.error ?? 'Readiness check failed.')
      }
      setReport(readinessResult.value)
      if (benchmarkResult.status === 'fulfilled' && benchmarkResult.value.ok) {
        setBenchmark(benchmarkResult.value)
      } else {
        setBenchmark(null)
        setBenchmarkError(benchmarkResult.status === 'rejected' ? benchmarkResult.reason?.message ?? 'Benchmark check failed.' : benchmarkResult.value?.error ?? 'Benchmark check failed.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Readiness check failed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  useEffect(() => {
    const refreshPwa = () => setPwa(initialPwaState())
    refreshPwa()
    window.addEventListener('bertos-pwa-installable', refreshPwa)
    window.addEventListener('bertos-pwa-installed', refreshPwa)
    navigator.serviceWorker?.ready.then(refreshPwa).catch(() => undefined)
    return () => {
      window.removeEventListener('bertos-pwa-installable', refreshPwa)
      window.removeEventListener('bertos-pwa-installed', refreshPwa)
    }
  }, [])

  const installBertOS = async () => {
    const prompt = window.__bertosInstallPrompt
    if (!prompt) return
    setInstalling(true)
    try {
      await prompt.prompt()
      await prompt.userChoice.catch(() => null)
      window.__bertosInstallPrompt = undefined
      setPwa(initialPwaState())
    } finally {
      setInstalling(false)
    }
  }

  const clientChecks = useMemo<PublishReadinessCheck[]>(() => [
    {
      id: 'client-daemon',
      title: 'Desktop coding bridge',
      description: 'The current browser can reach the local daemon for repo files, safe commands, and CLI agents.',
      status: health?.daemonOnline ? 'ready' : 'warning',
      detail: health?.daemonOnline
        ? `Connected to ${health.workspaceRoot ?? health.daemonUrl ?? 'local daemon'}.`
        : 'Start npm run bertos:daemon on the desktop, or configure an HTTPS tunnel/token for phone use.',
      actionHref: '/settings',
      actionLabel: 'Open bridge settings',
    },
    {
      id: 'pwa-install',
      title: 'Installable desktop/mobile app',
      description: 'BertOS can run as a standalone app when installed from a supported browser.',
      status: pwa.standalone || pwa.installedAt || pwa.installable ? 'ready' : 'info',
      detail: pwa.standalone
        ? 'BertOS is currently running in standalone app mode.'
        : pwa.installable
          ? 'Install prompt is available in this browser.'
          : pwa.installedAt
            ? `Install recorded at ${new Date(pwa.installedAt).toLocaleString()}.`
            : 'Use the browser install/share menu if the install prompt is not currently available.',
    },
    {
      id: 'service-worker-client',
      title: 'Production service worker',
      description: 'The installed shell can cache core routes without caching API secrets or local daemon requests.',
      status: pwa.serviceWorker === 'registered' ? 'ready' : pwa.serviceWorker === 'unsupported' ? 'warning' : 'info',
      detail: pwa.serviceWorker === 'registered'
        ? 'Service worker is active in this browser.'
        : pwa.serviceWorker === 'unsupported'
          ? 'This browser does not support service workers.'
          : 'Service worker will activate after production registration and reload.',
    },
  ], [health?.daemonOnline, health?.workspaceRoot, health?.daemonUrl, pwa.installable, pwa.installedAt, pwa.serviceWorker, pwa.standalone])

  const allClientReady = clientChecks.every(item => item.status === 'ready' || item.status === 'info')
  const score = report?.summary.score ?? 0

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <RouteHero
          eyebrow="publish control"
          title="Launch Readiness"
          subtitle="A working OS needs more than routes. This cockpit checks deployment, installability, local coding bridge, runtime safety, Creator OS modules, memory review, and public connector honesty."
          seal={<Rocket className="h-5 w-5" />}
          status={error ? 'danger' : score >= 85 && allClientReady ? 'nominal' : 'warning'}
          metrics={[
            { label: 'Server Score', value: loading ? 'checking' : `${score}%`, detail: report ? `${report.summary.ready}/${report.summary.total} ready` : 'readiness API', tone: score >= 85 ? 'emerald' : 'amber' },
            { label: 'Desktop Bridge', value: daemonLoading ? 'checking' : health?.daemonOnline ? 'online' : 'setup', detail: health?.workspaceRoot ?? 'local daemon / tunnel', tone: health?.daemonOnline ? 'emerald' : 'amber' },
            { label: 'Install Mode', value: pwa.standalone ? 'standalone' : pwa.installable ? 'installable' : 'browser', detail: pwa.serviceWorker, tone: pwa.standalone || pwa.installable ? 'cyan' : 'bronze' },
            { label: 'AI OS Score', value: benchmark ? `${benchmark.summary.score}%` : 'loading', detail: benchmark ? `${benchmark.summary.implemented}/${benchmark.summary.total} implemented` : 'feature benchmark', tone: benchmark && benchmark.summary.score >= 70 ? 'emerald' : 'violet' },
          ]}
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => { void load(); void refreshDaemon() }} disabled={loading || daemonLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading || daemonLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button size="sm" onClick={installBertOS} disabled={!pwa.installable || installing}>
              {installing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Install BertOS
            </Button>
          </div>
        </RouteHero>

        {error && (
          <ChamberCard tone="red" className="mb-4 p-4 text-sm text-red-100">
            {error}
          </ChamberCard>
        )}

        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <ClientStatusCard
            icon={<Laptop className="h-5 w-5" />}
            title="Desktop Coding"
            status={health?.daemonOnline ? 'ready' : 'warning'}
            detail={health?.daemonOnline ? 'Workspace, Builder, Agents, GitHub, and terminal checks can use this repo.' : 'Run npm run bertos:daemon on the desktop.'}
            actionHref="/workspace"
            actionLabel="Open workspace"
          />
          <ClientStatusCard
            icon={<Smartphone className="h-5 w-5" />}
            title="Phone Access"
            status="info"
            detail="Phone coding needs an HTTPS daemon tunnel plus BERTOS_DAEMON_TOKEN; dashboard and review routes work from the domain."
            actionHref="/settings"
            actionLabel="Bridge settings"
          />
          <ClientStatusCard
            icon={<Cloud className="h-5 w-5" />}
            title="Hosted Domain"
            status={report?.environment.deployment === 'vercel' ? 'ready' : 'info'}
            detail={report?.environment.appUrl ?? 'Checking canonical deployment URL.'}
            actionHref="/dashboard"
            actionLabel="Open dashboard"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <ChecklistSection
              title="Current Browser"
              description="These checks run in the user's browser, so they can see the desktop daemon and install state that Vercel cannot see."
              checks={clientChecks}
            />
            <AiOsBenchmarkSection benchmark={benchmark} error={benchmarkError} />
            {report?.sections.map(section => (
              <ChecklistSection key={section.id} title={section.title} description={section.description} checks={section.checks} />
            ))}
          </div>

          <div className="space-y-4">
            <ChamberCard
              tone="bronze"
              eyebrow="publish stance"
              title="What Is Publishable Now"
              description="BertOS is safe to publish as a local-first OS cockpit when these statements stay true."
              status={score >= 85 ? 'nominal' : 'warning'}
            >
              <div className="space-y-3 text-sm text-zinc-400">
                <ProofLine text="The public server never pretends it can access your Mac daemon." />
                <ProofLine text="Risky actions require explicit approval before writes, publishing, sending, scheduling, pushing, or paid calls." />
                <ProofLine text="External connectors show ready, planned, missing setup, or degraded states." />
                <ProofLine text="Generated memory, outputs, and logs stay in local runtime folders." />
                <ProofLine text="The app is installable and usable from desktop; phone coding requires a secure bridge." />
                <ProofLine text="The AI OS benchmark tracks publishable capabilities against current agent workspace patterns." />
              </div>
            </ChamberCard>

            <ChamberCard tone="cyan" eyebrow="phone mode" title="Phone Coding Path" status="active">
              <div className="space-y-3 text-xs leading-relaxed text-zinc-400">
                <p>Run this on the desktop that owns the repo:</p>
                <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-black/30 p-3 font-mono text-[11px] text-cyan-100">{`BERTOS_DAEMON_TOKEN=<strong-token> npm run bertos:daemon\ncloudflared tunnel --url http://127.0.0.1:8787`}</pre>
                <p>Then save the HTTPS tunnel URL and token in Settings from the phone.</p>
              </div>
            </ChamberCard>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}

function ClientStatusCard({
  icon,
  title,
  status,
  detail,
  actionHref,
  actionLabel,
}: {
  icon: ReactNode
  title: string
  status: PublishReadinessStatus
  detail: string
  actionHref: string
  actionLabel: string
}) {
  return (
    <ChamberCard tone={statusTone(status)} className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-current/20 bg-current/10 text-current">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
            <Badge variant={statusVariant(status)}>{status}</Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{detail}</p>
          <a href={actionHref} className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-200 hover:text-cyan-100">
            {actionLabel} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </ChamberCard>
  )
}

function ChecklistSection({
  title,
  description,
  checks,
}: {
  title: string
  description: string
  checks: PublishReadinessCheck[]
}) {
  const blocked = checks.filter(check => check.status === 'blocked').length
  const warnings = checks.filter(check => check.status === 'warning').length
  return (
    <ChamberCard
      tone={blocked ? 'red' : warnings ? 'amber' : 'emerald'}
      eyebrow="readiness"
      title={title}
      description={description}
      status={blocked ? 'danger' : warnings ? 'warning' : 'nominal'}
    >
      <div className="space-y-2">
        {checks.map(item => (
          <div key={item.id} className="flex gap-3 rounded-xl border border-zinc-800/80 bg-black/20 p-3">
            <div className="mt-0.5 shrink-0">{statusIcon(item.status)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-zinc-100">{item.title}</h4>
                <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.description}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{item.detail}</p>
              {item.actionHref && item.actionLabel && (
                <a href={item.actionHref} className="mt-2 inline-flex items-center gap-1.5 text-xs text-cyan-200 hover:text-cyan-100">
                  {item.actionLabel} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </ChamberCard>
  )
}

function aiFeatureVariant(status: AiOsFeatureStatus): NonNullable<ComponentProps<typeof Badge>['variant']> {
  if (status === 'implemented') return 'success'
  if (status === 'partial') return 'warning'
  if (status === 'setup-gated') return 'info'
  return 'default'
}

function AiOsBenchmarkSection({
  benchmark,
  error,
}: {
  benchmark: AiOsBenchmarkReport | null
  error: string | null
}) {
  if (error) {
    return (
      <ChamberCard tone="red" eyebrow="ai os benchmark" title="AI OS Benchmark" status="danger">
        <p className="text-sm text-red-100">{error}</p>
      </ChamberCard>
    )
  }

  if (!benchmark) {
    return (
      <ChamberCard tone="violet" eyebrow="ai os benchmark" title="AI OS Benchmark" status="loading">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Building source-backed feature coverage report...
        </div>
      </ChamberCard>
    )
  }

  const topGaps = benchmark.priorityGaps.slice(0, 6)
  const sourceNames = benchmark.sources.map(source => source.name).join(', ')

  return (
    <ChamberCard
      tone={benchmark.summary.score >= 75 ? 'emerald' : benchmark.summary.score >= 55 ? 'amber' : 'red'}
      eyebrow="ai os benchmark"
      title="40-Feature Publishable OS Matrix"
      description="A source-backed checklist for turning BertOS into a complete local-first AI operating system instead of a loose dashboard."
      status={benchmark.summary.score >= 75 ? 'nominal' : 'warning'}
    >
      <div className="grid gap-3 lg:grid-cols-4">
        <BenchmarkMetric icon={<Gauge className="h-4 w-4" />} label="Coverage" value={`${benchmark.summary.score}%`} detail={`${benchmark.summary.implemented}/${benchmark.summary.total} implemented`} />
        <BenchmarkMetric icon={<Target className="h-4 w-4" />} label="Critical Gaps" value={String(benchmark.summary.criticalGaps)} detail="non-implemented critical items" />
        <BenchmarkMetric icon={<Layers3 className="h-4 w-4" />} label="Runtime" value={`${benchmark.runtime.skills}/${benchmark.runtime.plugins}`} detail="skills / plugins" />
        <BenchmarkMetric icon={<ShieldCheck className="h-4 w-4" />} label="Readiness" value={`${benchmark.runtime.readinessScore}%`} detail="launch gate score" />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="rounded-xl border border-zinc-800/80 bg-black/20 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-zinc-100">Layer Coverage</h4>
              <p className="mt-1 text-xs text-zinc-500">Feature groups benchmarked against current AI OS patterns.</p>
            </div>
            <Badge variant="info">{benchmark.layers.length} layers</Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {benchmark.layers.map(layer => (
              <div key={layer.id} className="rounded-lg border border-zinc-800/70 bg-zinc-950/45 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-zinc-200">{layer.label}</span>
                  <span className="text-xs text-cyan-200">{layer.score}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300" style={{ width: `${layer.score}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-zinc-500">
                  <span>{layer.implemented} done</span>
                  <span>{layer.partial} partial</span>
                  <span>{layer.setupGated} gated</span>
                  <span>{layer.planned} planned</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800/80 bg-black/20 p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-zinc-100">Next Highest-Leverage Builds</h4>
              <p className="mt-1 text-xs text-zinc-500">Prioritized gaps that make the OS more seamless.</p>
            </div>
            <Badge variant="warning">{topGaps.length} gaps</Badge>
          </div>
          <div className="space-y-2">
            {topGaps.map(feature => (
              <AiOsFeatureGap key={feature.id} feature={feature} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-zinc-800/80 bg-black/20 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-zinc-100">Full Feature Matrix</h4>
            <p className="mt-1 text-xs text-zinc-500">All benchmarked capabilities stay visible so the roadmap does not drift into vague ambition.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="success">{benchmark.summary.implemented} implemented</Badge>
            <Badge variant="warning">{benchmark.summary.partial} partial</Badge>
            <Badge variant="info">{benchmark.summary.setupGated} setup-gated</Badge>
            <Badge variant="default">{benchmark.summary.planned} planned</Badge>
          </div>
        </div>
        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
          {benchmark.features.map(feature => (
            <div key={feature.id} className="grid gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/45 p-2.5 md:grid-cols-[minmax(190px,0.75fr)_minmax(0,1.25fr)_minmax(180px,0.8fr)]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant={aiFeatureVariant(feature.status)}>{feature.status}</Badge>
                  <span className="rounded border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">{feature.layer}</span>
                </div>
                <h5 className="mt-1.5 text-xs font-semibold text-zinc-100">{feature.title}</h5>
                <p className="mt-1 text-[10px] text-zinc-500">{feature.bertosSurface}</p>
              </div>
              <p className="text-xs leading-relaxed text-zinc-400">{feature.implementation}</p>
              <div className="text-xs leading-relaxed text-zinc-500">
                <p>{feature.nextStep}</p>
                <a href={feature.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-cyan-200 hover:text-cyan-100">
                  Source <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-zinc-800/80 bg-black/20 p-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="font-semibold uppercase tracking-[0.18em] text-zinc-400">Grounded In</span>
          {benchmark.sources.map(source => (
            <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-cyan-200 hover:text-cyan-100">
              {source.name}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">Sources: {sourceNames}. BertOS should keep implementing the useful patterns while preserving local-first storage, honest setup states, and approval gates.</p>
      </div>
    </ChamberCard>
  )
}

function BenchmarkMetric({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-black/20 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
        <span className="text-cyan-200">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-zinc-100">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{detail}</div>
    </div>
  )
}

function AiOsFeatureGap({ feature }: { feature: AiOsBenchmarkFeature }) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/45 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h5 className="min-w-0 flex-1 text-xs font-semibold text-zinc-100">{feature.title}</h5>
        <Badge variant={aiFeatureVariant(feature.status)}>{feature.status}</Badge>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{feature.nextStep}</p>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-zinc-500">
        <span className="rounded border border-zinc-800 px-1.5 py-0.5">{feature.layer}</span>
        <span className="rounded border border-zinc-800 px-1.5 py-0.5">{feature.priority}</span>
        <span className="rounded border border-zinc-800 px-1.5 py-0.5">{feature.difficulty}</span>
      </div>
    </div>
  )
}

function ProofLine({ text }: { text: string }) {
  return (
    <div className="flex gap-2">
      <span className="mt-1"><StatusOrb state="nominal" size="sm" /></span>
      <span>{text}</span>
    </div>
  )
}
