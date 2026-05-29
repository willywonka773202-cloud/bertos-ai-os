'use client'
import { useState } from 'react'
import { ShieldCheck, ShieldX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChamberCard, EmptyChamber } from '@/components/bertos/hermes'
import { type CockpitApproval, postJson, statusBadge } from './types'

export function GuardianGates({ approvals, onRefresh, onNotice }: {
  approvals: CockpitApproval[]
  onRefresh: () => Promise<void> | void
  onNotice: (message: string) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const pending = approvals.filter(approval => approval.status === 'pending')
  const recent = approvals.filter(approval => approval.status !== 'pending').slice(0, 4)

  const decide = async (approval: CockpitApproval, verb: 'approve' | 'reject') => {
    setBusy(approval.approvalId)
    const result = await postJson(`/api/bertos/approvals/${approval.approvalId}/${verb}`, {})
    setBusy(null)
    onNotice(result.ok ? `Approval ${verb === 'approve' ? 'granted' : 'rejected'}.` : (result.error ?? 'Could not update approval.'))
    await onRefresh()
  }

  return (
    <ChamberCard
      tone={pending.length ? 'red' : 'emerald'}
      eyebrow="guardian gates"
      title="Guardian Gates"
      description="Risky actions wait here. Nothing destructive, external, or paid runs without your explicit approval."
      status={pending.length ? 'warning' : 'nominal'}
    >
      {pending.length === 0 ? (
        <EmptyChamber tone="emerald" title="No pending approvals" description="Patch applies, pushes, deploys, paid APIs and deletions will surface here for review." />
      ) : (
        <div className="space-y-2">
          {pending.map(approval => (
            <div key={approval.approvalId} className="rounded-lg border border-red-500/25 bg-red-500/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-zinc-100">{approval.title}</span>
                    <Badge variant="error">{approval.riskLevel}</Badge>
                    <Badge variant="default">{approval.actionType}</Badge>
                  </div>
                  {approval.consequences && <p className="mt-1 text-xs text-zinc-400">{approval.consequences}</p>}
                  {approval.payloadSummary && <p className="mt-1 truncate font-mono text-[11px] text-zinc-500">{approval.payloadSummary}</p>}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" disabled={busy === approval.approvalId} onClick={() => decide(approval, 'approve')}><ShieldCheck className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" disabled={busy === approval.approvalId} onClick={() => decide(approval, 'reject')}><ShieldX className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {recent.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-zinc-800 pt-2">
          {recent.map(approval => (
            <div key={approval.approvalId} className="flex items-center justify-between gap-2 text-xs text-zinc-500">
              <span className="truncate">{approval.title}</span>
              <Badge variant={statusBadge(approval.status)}>{approval.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </ChamberCard>
  )
}
