'use client'
import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'
import { GuardianGates } from './GuardianGates'
import { type CockpitApproval, getJson } from './types'

export function ApprovalsView() {
  const [approvals, setApprovals] = useState<CockpitApproval[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const data = await getJson<{ approvals: CockpitApproval[] }>('/api/bertos/approvals')
    setApprovals(data.approvals ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const pending = approvals.filter(a => a.status === 'pending').length
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(null), 6000) }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
        <RouteHero
          eyebrow="guardian gates"
          title="Approval Center"
          subtitle="Every risky action — patch applies, pushes, deploys, deletions, paid APIs, durable memory writes — waits here for your explicit approval."
          seal={<ShieldCheck className="h-5 w-5" />}
          status={pending ? 'warning' : 'nominal'}
          metrics={[
            { label: 'Pending', value: pending, detail: 'awaiting decision', tone: pending ? 'red' : 'emerald' },
            { label: 'Total', value: approvals.length, detail: 'all requests', tone: 'bronze' },
            { label: 'Policy', value: 'explicit', detail: 'no silent actions', tone: 'cyan' },
            { label: 'Storage', value: 'local', detail: 'data/bertos', tone: 'emerald' },
          ]}
        />
        {notice && <ChamberCard tone="cyan" className="mb-4 p-3 text-sm text-cyan-100">{notice}</ChamberCard>}
        {loading ? (
          <p className="text-sm text-zinc-500">Loading guardian gates…</p>
        ) : (
          <GuardianGates approvals={approvals} onRefresh={load} onNotice={flash} />
        )}
      </div>
    </ScrollArea>
  )
}
