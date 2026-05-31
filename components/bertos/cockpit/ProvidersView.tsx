'use client'
import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Cpu, Plug, RefreshCw, X, Zap } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChamberCard, EmptyChamber, RouteHero } from '@/components/bertos/hermes'
import { getJson, postJson } from './types'

interface Capability { canGenerate: boolean; canEditCode: boolean; canRunTools: boolean; longContext: boolean; costMode: string; safeToAuto: boolean; bestFor: string[] }
interface Provider {
  providerId: string; name: string; status: string; online: boolean; modelOrTool: string; models: string[]
  capability: Capability; description: string; billingWarning?: string; setupCommand: string; docsUrl: string; error?: string
  lastTest?: { ranLiveGeneration: boolean; latencyMs?: number; replyPreview?: string; errorSummary?: string; lastTestedAt: string }
}
interface SetupGuide { whatItIs: string; installCommand?: string; startCommand?: string; envVars: string[]; howBertosDetects: string; testHint: string; commonErrors: string[]; doNotCommit: string[]; docsUrl: string }

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  online: 'success', offline: 'error', missing_credentials: 'warning', setup_required: 'warning',
}
const COST_LABEL: Record<string, string> = { 'free-local': 'free · local', subscription: 'subscription', paid: 'PAID API', unknown: 'cost: depends' }
const COST_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'default'> = { 'free-local': 'success', subscription: 'default', paid: 'error', unknown: 'default' }

export function ProvidersView() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<string | null>(null)
  const [testingAll, setTestingAll] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [guides, setGuides] = useState<Record<string, SetupGuide>>({})
  const [allowPaid, setAllowPaid] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    const d = await getJson<{ providers: Provider[] }>('/api/bertos/providers')
    setProviders(d.providers ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const flash = (m: string) => { setNotice(m); window.setTimeout(() => setNotice(null), 7000) }

  const test = async (id: string) => {
    setTesting(id)
    const d = await postJson<{ result?: any }>(`/api/bertos/providers/${id}/test`, { allowPaid })
    setTesting(null)
    const r = d.result
    flash(r?.ok ? `✓ ${r.name}: responded${r.latencyMs ? ` in ${r.latencyMs}ms` : ''}${r.replyPreview ? ` — "${r.replyPreview}"` : ''}` : `✗ ${r?.name ?? id}: ${r?.reason ?? 'failed'}${r?.setupHint ? ` — ${r.setupHint}` : ''}`)
    await load()
  }
  const testAll = async () => {
    setTestingAll(true)
    const d = await postJson<{ passed?: number; total?: number }>('/api/bertos/providers/test-all', { allowPaid })
    setTestingAll(false)
    flash(`Tested all providers: ${d.passed ?? 0}/${d.total ?? 0} responded.`)
    await load()
  }
  const toggleGuide = async (id: string) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    if (!guides[id]) {
      const d = await getJson<{ guide: SetupGuide }>(`/api/bertos/providers/${id}/setup`)
      if (d.guide) setGuides(prev => ({ ...prev, [id]: d.guide }))
    }
  }

  const online = providers.filter(p => p.online).length
  const free = providers.filter(p => p.capability.costMode === 'free-local' || p.capability.costMode === 'subscription').length

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
        <RouteHero
          eyebrow="provider hub"
          title="AI Provider Hub"
          subtitle="Every AI model BertOS can use, in one place. Status, capabilities, cost, setup, and live tests — so you can use Claude, Codex, Gemini, Ollama and Hermes without switching apps."
          seal={<Plug className="h-5 w-5" />}
          status={online ? 'active' : 'warning'}
          metrics={[
            { label: 'Online', value: `${online}/${providers.length}`, detail: 'reachable now', tone: online ? 'emerald' : 'amber' },
            { label: 'Free/sub', value: free, detail: 'no per-call API bill', tone: 'cyan' },
            { label: 'Paid gated', value: providers.filter(p => p.capability.costMode === 'paid').length, detail: 'needs allowPaid', tone: 'bronze' },
            { label: 'Test', value: allowPaid ? 'paid on' : 'free only', detail: 'safety toggle', tone: allowPaid ? 'red' : 'emerald' },
          ]}
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={testingAll} onClick={testAll}><RefreshCw className={`h-3.5 w-3.5 ${testingAll ? 'animate-spin' : ''}`} /> Test all providers</Button>
          <label className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-black/20 px-2.5 py-1.5 text-xs text-zinc-400">
            <input type="checkbox" checked={allowPaid} onChange={e => setAllowPaid(e.target.checked)} className="accent-red-400" />
            Allow paid-API live tests
          </label>
          <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
        </div>

        {notice && <ChamberCard tone="cyan" className="mb-4 p-3 text-sm text-cyan-100">{notice}</ChamberCard>}

        {loading ? (
          <p className="text-sm text-zinc-500">Loading providers…</p>
        ) : providers.length === 0 ? (
          <EmptyChamber tone="bronze" title="No providers" description="Provider registry unavailable." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {providers.map(p => (
              <ChamberCard key={p.providerId} tone={p.online ? 'emerald' : 'zinc'}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Cpu className="h-4 w-4" style={{ color: p.online ? '#86C9A0' : '#6A5A3A' }} />
                      <span className="truncate text-sm font-semibold text-zinc-100">{p.name}</span>
                      <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>{p.online ? 'online' : p.status}</Badge>
                      <Badge variant={COST_VARIANT[p.capability.costMode]}>{COST_LABEL[p.capability.costMode]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{p.description}</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {p.capability.canGenerate && <Cap label="text" on />}
                  <Cap label="edit code" on={p.capability.canEditCode} />
                  <Cap label="tools" on={p.capability.canRunTools} />
                  <Cap label="long ctx" on={p.capability.longContext} />
                  <Cap label="safe-auto" on={p.capability.safeToAuto} />
                </div>

                {p.capability.bestFor.length > 0 && (
                  <p className="mt-2 text-[11px] text-zinc-600"><span className="text-zinc-500">Best for:</span> {p.capability.bestFor.join(', ')}</p>
                )}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {p.models.slice(0, 4).map(m => <span key={m} className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">{m}</span>)}
                </div>

                {p.error && <p className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 p-1.5 text-[11px] text-amber-300">{p.error}</p>}
                {p.lastTest && (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Last test: {p.lastTest.ranLiveGeneration
                      ? (p.lastTest.replyPreview ? <span className="text-emerald-300">✓ {p.lastTest.latencyMs}ms “{p.lastTest.replyPreview}”</span> : <span className="text-amber-300">{p.lastTest.errorSummary ?? 'no reply'}</span>)
                      : 'connection only'}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" disabled={testing === p.providerId} onClick={() => test(p.providerId)}>
                    <Zap className="h-3.5 w-3.5" /> {testing === p.providerId ? 'Testing…' : 'Test'}
                  </Button>
                  <button onClick={() => toggleGuide(p.providerId)} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-cyan-200">
                    {expanded === p.providerId ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Setup
                  </button>
                  <a href={p.docsUrl} target="_blank" rel="noreferrer" className="ml-auto text-[11px] text-zinc-600 hover:text-cyan-300">docs ↗</a>
                </div>

                {expanded === p.providerId && guides[p.providerId] && (
                  <div className="mt-2 space-y-1.5 rounded-lg border border-zinc-800 bg-black/30 p-2.5 text-[11px] text-zinc-400">
                    <p>{guides[p.providerId].whatItIs}</p>
                    {guides[p.providerId].installCommand && <p><span className="text-zinc-500">Install:</span> <code className="text-amber-200">{guides[p.providerId].installCommand}</code></p>}
                    {guides[p.providerId].startCommand && <p><span className="text-zinc-500">Start:</span> <code className="text-amber-200">{guides[p.providerId].startCommand}</code></p>}
                    {guides[p.providerId].envVars.length > 0 && <p><span className="text-zinc-500">Env:</span> {guides[p.providerId].envVars.join(', ')}</p>}
                    <p><span className="text-zinc-500">Detection:</span> {guides[p.providerId].howBertosDetects}</p>
                    {guides[p.providerId].commonErrors.length > 0 && <ul className="ml-3 list-disc">{guides[p.providerId].commonErrors.map(e => <li key={e}>{e}</li>)}</ul>}
                    {guides[p.providerId].doNotCommit.length > 0 && <p className="text-red-300/80">Never commit: {guides[p.providerId].doNotCommit.join(', ')}</p>}
                  </div>
                )}
                {p.billingWarning && p.capability.costMode === 'paid' && (
                  <p className="mt-2 text-[10px] text-red-300/70">{p.billingWarning}</p>
                )}
              </ChamberCard>
            ))}
          </div>
        )}

        <p className="mt-4 text-center text-[11px] text-zinc-600">Secrets are never read or displayed — only presence/reachability is checked. Paid APIs require the toggle above.</p>
      </div>
    </ScrollArea>
  )
}

function Cap({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] ${on ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-800/50 text-zinc-600 line-through'}`}>
      {on ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}{label}
    </span>
  )
}
