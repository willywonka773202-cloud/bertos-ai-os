'use client'
import { useEffect, useState } from 'react'
import { Brain, Check, Pencil, RefreshCw, ShieldAlert, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'

type Proposal = {
  proposalId: string
  kind: string
  title: string
  content: string
  status: string
  confidence: string
  sensitivity: string
  tags: string[]
  reason: string
  createdAt: string
}

export function MemoryReviewView() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const load = async () => {
    const data = await fetch('/api/bertos/memory/proposals', { cache: 'no-store' }).then(res => res.json())
    setProposals(data.proposals ?? [])
  }
  useEffect(() => { void load() }, [])
  const decide = async (id: string, action: 'approve' | 'reject') => {
    await fetch(`/api/bertos/memory/proposals/${id}/${action}`, { method: 'POST' })
    await load()
  }
  const editProposal = async (proposal: Proposal) => {
    const content = window.prompt(`Edit memory proposal: ${proposal.title}`, proposal.content)
    if (!content?.trim() || content === proposal.content) return
    await fetch(`/api/bertos/memory/proposals/${proposal.proposalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposedContent: content, reason: `${proposal.reason} Edited during memory review.` }),
    })
    await load()
  }
  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-5xl px-6 py-4">
        <RouteHero
          eyebrow="memory safety"
          title="Memory Review"
          subtitle="Agent and workflow memory writes land here as proposals. Approval writes reviewed markdown records into the local BertOS memory vault."
          seal={<Brain className="h-5 w-5" />}
          status="nominal"
          metrics={[
            { label: 'Pending', value: proposals.filter(item => item.status === 'pending').length, detail: 'needs review', tone: 'amber' },
            { label: 'Approved', value: proposals.filter(item => item.status === 'approved').length, detail: 'stored', tone: 'emerald' },
            { label: 'Rejected', value: proposals.filter(item => item.status === 'rejected').length, detail: 'blocked', tone: 'zinc' },
            { label: 'Secret Guard', value: 'on', detail: 'proposal blocking', tone: 'red' },
          ]}
        />
        <div className="mb-4 flex justify-end"><Button size="sm" variant="secondary" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button></div>
        <div className="space-y-3">
          {proposals.map(proposal => (
            <ChamberCard key={proposal.proposalId} tone={proposal.status === 'pending' ? 'amber' : proposal.status === 'approved' ? 'emerald' : 'zinc'} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-zinc-100">{proposal.title}</h2>
                    <Badge>{proposal.kind}</Badge>
                    <Badge variant={proposal.status === 'pending' ? 'warning' : proposal.status === 'approved' ? 'success' : 'default'}>{proposal.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{proposal.proposalId} · {proposal.confidence} · {proposal.sensitivity}</p>
                </div>
                {proposal.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => editProposal(proposal)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button size="sm" onClick={() => decide(proposal.proposalId, 'approve')}><Check className="h-3.5 w-3.5" /> Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => decide(proposal.proposalId, 'reject')}><X className="h-3.5 w-3.5" /> Reject</Button>
                  </div>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-400">{proposal.content}</p>
              <p className="mt-3 text-xs text-amber-200"><ShieldAlert className="mr-1 inline h-3 w-3" /> {proposal.reason}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{proposal.tags.map(tag => <Badge key={tag} variant="default">{tag}</Badge>)}</div>
            </ChamberCard>
          ))}
          {!proposals.length && <ChamberCard tone="zinc" className="p-6 text-sm text-zinc-500">No memory proposals yet.</ChamberCard>}
        </div>
      </div>
    </ScrollArea>
  )
}
