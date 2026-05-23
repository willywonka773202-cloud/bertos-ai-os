'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ClipboardList, Server, Sparkles, Zap } from 'lucide-react'
import { useProjectStore } from '@/store/bertos/projects'
import { useAutomationStore } from '@/store/bertos/automations'
import { useDaemonHealth } from '@/hooks/useDaemonHealth'
import { DaemonHealthBanner } from '@/components/bertos/shell/DaemonHealthBanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, EmptyChamber, RouteHero } from '@/components/bertos/hermes'

interface ProviderStatus {
  id: string
  name: string
  status: 'online' | 'offline' | 'unknown'
  message?: string
}

export function BriefView() {
  const { projects, activeProjectId } = useProjectStore()
  const { runs } = useAutomationStore()
  const { health, loading, refresh } = useDaemonHealth()
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const activeProject = projects.find(project => project.id === activeProjectId)

  useEffect(() => {
    fetch('/api/providers/status', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => setProviders(data?.providers ?? []))
      .catch(() => setProviders([]))
  }, [])

  const onlineProviders = providers.filter(provider => provider.status === 'online')
  const missingProviders = providers.filter(provider => provider.status !== 'online')
  const recentRun = runs[0]
  const recommendedAction = useMemo(() => {
    if (!health?.daemonOnline) return 'Start npm run bertos:daemon so Builder, Workspace, Autopilot, and local CLI agents can run safely.'
    if (missingProviders.length > 0) return 'Open Settings and review missing provider setup before starting a broad mission.'
    return 'Open Builder, compile a scoped mission, then run validation before applying or committing changes.'
  }, [health?.daemonOnline, missingProviders.length])

  const priorities = [
    'Keep active work scoped to one mission at a time.',
    'Use Builder for implementation prompts and Playbooks for triage prompts.',
    'Run typecheck/build/safety before considering work done.',
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-cyan-300/10 px-6 py-4">
        <RouteHero
          eyebrow="daily oracle brief"
          title="Daily Brief"
          subtitle="A chief-of-staff command view for the active project, provider readiness, Autopilot status, and the safest next action. No calendar or email data is implied unless wired."
          status={loading ? 'loading' : health?.daemonOnline ? 'nominal' : 'warning'}
          seal={<CalendarDays className="h-5 w-5" />}
          metrics={[
            { label: 'Active Project', value: activeProject?.name ?? 'none', detail: activeProject?.description ?? 'select in Memory', tone: activeProject ? 'cyan' : 'zinc' },
            { label: 'Providers', value: `${onlineProviders.length}/${providers.length || 0}`, detail: missingProviders.length ? `${missingProviders.length} need setup` : 'available', tone: onlineProviders.length ? 'emerald' : 'amber' },
            { label: 'Daemon', value: health?.daemonOnline ? 'online' : 'offline', detail: health?.workspaceRoot ?? 'local bridge', tone: health?.daemonOnline ? 'cyan' : 'amber' },
            { label: 'Recent Autopilot', value: recentRun?.status ?? 'unknown', detail: recentRun?.title ?? 'no recent run', tone: recentRun ? 'bronze' : 'zinc' },
          ]}
        />
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
            <CalendarDays className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Daily Brief</h1>
            <p className="text-sm text-zinc-500">A local-first chief-of-staff view. Works without Gmail or Calendar access.</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-6">
          <DaemonHealthBanner health={health} loading={loading} onRefresh={refresh} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <ChamberCard tone="bronze" title="Today's priorities" eyebrow="intelligence dispatch">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-zinc-100">Today's priorities</h2>
              </div>
              <div className="space-y-2">
                {priorities.map(priority => (
                  <div key={priority} className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-400">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {priority}
                  </div>
                ))}
              </div>
            </ChamberCard>

            <ChamberCard tone="cyan" eyebrow="recommended next action" title="Chief-of-staff signal">
              <div className="mb-3 text-[10px] uppercase tracking-widest text-zinc-600">Recommended next action</div>
              <p className="text-sm leading-relaxed text-zinc-300">{recommendedAction}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => { window.location.href = '/builder' }}>
                  <Zap className="h-3.5 w-3.5" />Open Builder
                </Button>
                <Button size="sm" variant="outline" onClick={() => { window.location.href = '/playbooks' }}>
                  <ClipboardList className="h-3.5 w-3.5" />Open Playbooks
                </Button>
              </div>
            </ChamberCard>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <BriefCard title="Active project" value={activeProject?.name ?? 'None'} detail={activeProject?.description || 'Create or select a project in Memory.'} />
            <BriefCard title="Provider health" value={`${onlineProviders.length}/${providers.length || 0} online`} detail={missingProviders.length ? `${missingProviders.length} need setup or daemon access.` : 'Configured providers look available.'} />
            <BriefCard title="Recent build status" value={recentRun?.status ?? 'Unknown'} detail={recentRun ? recentRun.title : 'Run Autopilot Project Build Check for real status.'} />
            <BriefCard title="Missing integrations" value={missingProviders.length.toString()} detail="External tools stay optional until configured. No paid calls run from this page." />
          </div>

          <ChamberCard tone="cyan" eyebrow="source reports" title="Provider summary">
            <div className="mb-3 flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Provider summary</h2>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {providers.map(provider => (
                <div key={provider.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-zinc-300">{provider.name}</span>
                    <Badge variant={provider.status === 'online' ? 'success' : 'default'} className="text-[9px]">{provider.status}</Badge>
                  </div>
                  {provider.message && <p className="mt-1 text-[11px] text-zinc-600">{provider.message}</p>}
                </div>
              ))}
              {providers.length === 0 && (
                <div className="md:col-span-2 xl:col-span-3">
                  <EmptyChamber title="Dormant Source Relay" description="Provider status is unavailable from the local status endpoint." />
                </div>
              )}
            </div>
          </ChamberCard>

          <ChamberCard tone="zinc" eyebrow="future relay" title="Generate brief">
            <div className="mb-2 text-sm font-semibold text-zinc-100">Generate brief</div>
            <p className="text-sm text-zinc-500">
              Brief generation is intentionally not wired to paid models here. Future integrations can summarize calendar, email,
              GitHub, and daemon logs after you explicitly connect those sources.
            </p>
          </ChamberCard>
        </div>
      </ScrollArea>
    </div>
  )
}

function BriefCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <ChamberCard tone="zinc">
      <div className="text-[10px] uppercase tracking-widest text-zinc-600">{title}</div>
      <div className="mt-2 text-lg font-semibold text-zinc-100">{value}</div>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </ChamberCard>
  )
}
