'use client'
import { useCallback, useEffect, useState } from 'react'
import { Activity, Bot, Brain, Check, CircleSlash, Cloud, FlaskConical, HardDrive, Hexagon, ShieldAlert, ShieldQuestion, Sparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChamberCard, EmptyChamber } from '@/components/bertos/hermes'
import { type CockpitHealth, getJson, postJson, statusBadge } from './types'

// ── Attention strip — the glanceable "what needs me?" bar at the top of the cockpit ──

export function AttentionStrip({ health }: { health?: CockpitHealth | null }) {
  const [anyOnline, setAnyOnline] = useState<boolean | null>(null)
  const [providerName, setProviderName] = useState<string | undefined>()
  useEffect(() => {
    void getJson<{ providers: { online: boolean; providerName: string }[]; anyOnline: boolean }>('/api/bertos/coding/assistant')
      .then(d => { setAnyOnline(Boolean(d.anyOnline)); setProviderName(d.providers?.find(p => p.online)?.providerName) })
  }, [])

  type Item = { tone: 'red' | 'amber' | 'emerald' | 'cyan'; icon: typeof Bot; text: string; href?: string; cta?: string }
  const items: Item[] = []
  if (anyOnline === false) items.push({ tone: 'amber', icon: CircleSlash, text: 'AI in local mode — no provider online', href: '/onboarding', cta: 'Connect' })
  if (anyOnline === true) items.push({ tone: 'emerald', icon: Bot, text: `AI ready · ${providerName ?? 'provider online'}` })
  if ((health?.pendingApprovals ?? 0) > 0) items.push({ tone: 'red', icon: ShieldAlert, text: `${health!.pendingApprovals} action(s) need approval`, href: '/approvals', cta: 'Review' })
  if (health?.lastValidationStatus === 'failed') items.push({ tone: 'red', icon: FlaskConical, text: 'Validation failing' })
  if ((health?.pendingPatches ?? 0) > 0) items.push({ tone: 'amber', icon: Sparkles, text: `${health!.pendingPatches} patch(es) awaiting review` })
  if ((health?.openTasks ?? 0) > 0) items.push({ tone: 'cyan', icon: Activity, text: `${health!.openTasks} open task(s)` })
  if (items.length === 0 || (items.length === 1 && items[0].tone === 'emerald')) {
    items.push({ tone: 'emerald', icon: Check, text: 'All clear — nothing needs your attention' })
  }

  const toneClass: Record<Item['tone'], string> = {
    red: 'border-red-500/30 bg-red-500/5 text-red-200',
    amber: 'border-amber-500/30 bg-amber-500/5 text-amber-200',
    emerald: 'border-emerald-500/25 bg-emerald-500/5 text-emerald-200',
    cyan: 'border-cyan-500/25 bg-cyan-500/5 text-cyan-100',
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((item, i) => (
        <div key={i} className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${toneClass[item.tone]}`}>
          <item.icon className="h-3.5 w-3.5" />
          <span>{item.text}</span>
          {item.href && <a href={item.href} className="font-semibold underline underline-offset-2">{item.cta}</a>}
        </div>
      ))}
    </div>
  )
}

// ── Memory Chapel (embedded) ──────────────────────────────────────────────────

interface MemoryProposal {
  proposalId: string
  kind: string
  title: string
  content?: string
  proposedContent?: string
  scope: string
  project?: string
  confidence: string
  reason: string
  riskFlags: string[]
  targetFile: string
  status: string
}

export function MemoryChapel({ onActivity }: { onActivity?: () => void }) {
  const [proposals, setProposals] = useState<MemoryProposal[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const load = useCallback(async () => {
    const data = await getJson<{ proposals: MemoryProposal[] }>('/api/bertos/memory/proposals?status=pending')
    setProposals(data.proposals ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  const decide = async (id: string, verb: 'approve' | 'reject') => {
    setBusy(id)
    await postJson(`/api/bertos/memory/proposals/${id}/${verb}`, {})
    setBusy(null)
    await load()
    onActivity?.()
  }

  return (
    <ChamberCard
      tone="violet"
      eyebrow="memory chapel"
      title="Memory Chapel"
      description="Review-only memory proposals. Nothing is written to memory without your approval; secrets are blocked."
      status={proposals.length ? 'warning' : 'nominal'}
      action={<Badge variant={proposals.length ? 'warning' : 'default'}>{proposals.length} pending</Badge>}
    >
      {proposals.length === 0 ? (
        <EmptyChamber tone="violet" title="No memory proposals" description="Workflows and the AI assistant propose durable lessons here for your review." />
      ) : (
        <div className="space-y-2">
          {proposals.slice(0, 6).map(p => (
            <div key={p.proposalId} className="rounded-lg border border-violet-500/20 bg-black/20 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-violet-300" />
                    <span className="truncate text-sm font-medium text-zinc-100">{p.title}</span>
                    <Badge variant="default">{p.kind}</Badge>
                    <Badge variant="default">{p.scope}</Badge>
                    {p.riskFlags?.length > 0 && <Badge variant="warning">{p.riskFlags.length} risk</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{p.proposedContent || p.content}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">→ {p.targetFile}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" disabled={busy === p.proposalId} onClick={() => decide(p.proposalId, 'approve')}><Check className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" disabled={busy === p.proposalId} onClick={() => decide(p.proposalId, 'reject')}><X className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
          <a href="/memory-review" className="block text-center text-xs text-violet-300 hover:underline">Open full Memory Review →</a>
        </div>
      )}
    </ChamberCard>
  )
}

// ── Recent Runs ─────────────────────────────────────────────────────────────

interface AgentRunLite { agentRunId: string; title: string; status: string; lanes: { length: number }[] | unknown[]; createdAt: string; outputIds: string[] }

export function RecentRuns({ refreshKey }: { refreshKey?: number }) {
  const [runs, setRuns] = useState<AgentRunLite[]>([])
  const load = useCallback(async () => {
    const data = await getJson<{ agentRuns: AgentRunLite[] }>('/api/bertos/runs')
    setRuns(data.agentRuns ?? [])
  }, [])
  useEffect(() => { void load() }, [load, refreshKey])

  return (
    <ChamberCard tone="emerald" eyebrow="celestial ledger" title="Recent Runs" description="Every workflow, chat, and patch action recorded as a run with lane logs." action={<a href="/runs" className="text-xs text-emerald-300 hover:underline">All runs →</a>}>
      {runs.length === 0 ? (
        <EmptyChamber tone="emerald" title="No runs yet" description="Use the AI Command Center or a workflow — each creates a run here." />
      ) : (
        <div className="space-y-1.5">
          {runs.slice(0, 6).map(run => (
            <a key={run.agentRunId} href="/runs" className="flex items-center gap-2 rounded-md border border-zinc-800 bg-black/20 px-2.5 py-1.5 text-sm transition hover:border-emerald-500/30">
              <Activity className="h-3.5 w-3.5 text-emerald-300/70" />
              <span className="flex-1 truncate text-zinc-300">{run.title}</span>
              <span className="text-[10px] text-zinc-600">{Array.isArray(run.lanes) ? run.lanes.length : 0} lanes</span>
              <Badge variant={statusBadge(run.status)}>{run.status}</Badge>
            </a>
          ))}
        </div>
      )}
    </ChamberCard>
  )
}

// ── Public Readiness ──────────────────────────────────────────────────────────

interface Readiness {
  storage: { mode: string; durable: boolean; ephemeral: boolean; warning?: string; durableAdapter: string; notes: string }
  auth: { mode: string; userIsolation: boolean; hostedMode: boolean; note: string }
  providers: { total: number; online: number; anyOnline: boolean }
  localUseReady: boolean
  publicDemoReady: boolean
  publicMultiUserReady: boolean
  blockers: string[]
  summary: string
}

export function ReadinessCard() {
  const [r, setR] = useState<Readiness | null>(null)
  useEffect(() => { void getJson<{ readiness: Readiness }>('/api/bertos/coding/readiness').then(d => setR(d.readiness ?? null)) }, [])
  if (!r) return null

  const Row = ({ icon: Icon, label, value, ok }: { icon: typeof Cloud; label: string; value: string; ok: boolean | null }) => (
    <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-black/20 px-2.5 py-1.5 text-xs">
      <Icon className="h-3.5 w-3.5 text-zinc-500" />
      <span className="text-zinc-500">{label}</span>
      <span className="ml-auto font-medium text-zinc-200">{value}</span>
      {ok !== null && <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />}
    </div>
  )

  return (
    <ChamberCard tone="bronze" eyebrow="public readiness" title="Readiness & Storage" description="Honest status of storage durability, user isolation, and public readiness." status={r.publicMultiUserReady ? 'nominal' : 'warning'}>
      <div className="space-y-1.5">
        <Row icon={r.storage.durable ? HardDrive : Cloud} label="Storage" value={`${r.storage.mode}${r.storage.durable ? ' · durable' : ' · ephemeral'}`} ok={r.storage.durable} />
        <Row icon={ShieldQuestion} label="Auth / isolation" value={r.auth.mode} ok={r.auth.userIsolation} />
        <Row icon={Hexagon} label="AI providers" value={`${r.providers.online}/${r.providers.total} online`} ok={r.providers.anyOnline} />
        <Row icon={Check} label="Local single-user" value={r.localUseReady ? 'ready' : 'no'} ok={r.localUseReady} />
        <Row icon={Check} label="Public multi-user" value={r.publicMultiUserReady ? 'ready' : 'not ready'} ok={r.publicMultiUserReady} />
      </div>
      {r.storage.warning && <p className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-2 text-[11px] text-amber-200">{r.storage.warning}</p>}
      <p className="mt-2 text-[11px] text-zinc-500">{r.summary}</p>
      {r.blockers.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[11px] text-zinc-600">
          {r.blockers.map(b => <li key={b}>• {b}</li>)}
        </ul>
      )}
    </ChamberCard>
  )
}
