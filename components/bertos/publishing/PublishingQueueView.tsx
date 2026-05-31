'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, Plus, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'

type QueueItem = {
  queueItemId: string
  idea: string
  caption: string
  platformVariants: Record<string, string>
  status: 'idea' | 'drafted' | 'reviewed' | 'scheduled' | 'published' | 'archived'
  approvalRequired: boolean
  sourceOutputIds: string[]
  createdAt: string
}

const NEXT_STATUS: Record<QueueItem['status'], QueueItem['status']> = {
  idea: 'drafted',
  drafted: 'reviewed',
  reviewed: 'reviewed',
  scheduled: 'scheduled',
  published: 'archived',
  archived: 'idea',
}

export function PublishingQueueView() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [idea, setIdea] = useState('Turn the BertOS Skills Registry into a weekly creator workflow system.')
  const [caption, setCaption] = useState('A local-first creator OS should make repeatable workflows reusable, reviewable, and safe by default.')
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const data = await fetch('/api/bertos/publishing/queue', { cache: 'no-store' }).then(res => res.json())
    setQueue(data.queue ?? [])
  }

  useEffect(() => { void load() }, [])

  const createItem = async () => {
    if (!idea.trim()) return
    setBusy(true)
    setNotice(null)
    try {
      const data = await fetch('/api/bertos/publishing/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea,
          caption,
          platformVariants: {
            linkedin: caption,
            x: caption.length > 260 ? `${caption.slice(0, 257)}...` : caption,
          },
          approvalRequired: true,
        }),
      }).then(res => res.json())
      if (!data.ok) throw new Error(data.error ?? 'Queue item creation failed.')
      setNotice(`Saved queue item ${data.item.queueItemId}. Publishing still requires approval.`)
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Queue item creation failed.')
    } finally {
      setBusy(false)
    }
  }

  const advance = async (item: QueueItem) => {
    if ((item.status === 'reviewed' || item.status === 'scheduled') && item.approvalRequired) {
      setNotice('Scheduling and publishing require an explicit approval flow. Local queue tracking stops at reviewed.')
      return
    }
    const status = NEXT_STATUS[item.status]
    const data = await fetch(`/api/bertos/publishing/queue/${item.queueItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(res => res.json())
    if (data.ok) {
      setNotice(`${item.queueItemId} moved to ${status}.`)
      await load()
    }
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <RouteHero
          eyebrow="creator distribution"
          title="Publishing Queue"
          subtitle="Local fallback queue for Buffer-style publishing. BertOS can draft and organize ideas, but scheduling and publishing remain approval-gated."
          seal={<Send className="h-5 w-5" />}
          status="nominal"
          metrics={[
            { label: 'Queue Items', value: queue.length, detail: 'local drafts', tone: 'cyan' },
            { label: 'Reviewed', value: queue.filter(item => item.status === 'reviewed').length, detail: 'ready to schedule', tone: 'emerald' },
            { label: 'Approval', value: 'required', detail: 'publish/schedule', tone: 'amber' },
            { label: 'Buffer', value: 'setup', detail: 'local fallback', tone: 'zinc' },
          ]}
        />

        <ChamberCard tone="bronze" className="mb-4 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Add Local Queue Item</h2>
              <p className="mt-1 text-xs text-zinc-500">Creates local platform variants. It does not publish, schedule, or call Buffer.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          </div>
          <input value={idea} onChange={event => setIdea(event.target.value)} className="mb-2 h-9 w-full rounded-lg border border-zinc-800 bg-black/30 px-3 text-sm text-zinc-200 outline-none" />
          <textarea value={caption} onChange={event => setCaption(event.target.value)} className="min-h-20 w-full rounded-lg border border-zinc-800 bg-black/30 p-3 text-sm text-zinc-200 outline-none" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={createItem} disabled={busy}><Plus className="h-3.5 w-3.5" /> Add To Queue</Button>
            {notice && <span className="self-center text-xs text-cyan-100">{notice}</span>}
          </div>
        </ChamberCard>

        <div className="space-y-3">
          {queue.map(item => (
            <ChamberCard key={item.queueItemId} tone={item.status === 'reviewed' ? 'emerald' : item.status === 'published' ? 'cyan' : 'zinc'} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-zinc-100">{item.idea}</h2>
                    <Badge variant={item.status === 'reviewed' ? 'success' : item.status === 'scheduled' ? 'warning' : 'default'}>{item.status}</Badge>
                    {item.approvalRequired && <Badge variant="warning"><ShieldCheck className="h-3 w-3" /> approval</Badge>}
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{item.caption}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.keys(item.platformVariants).map(platform => <Badge key={platform}>{platform}</Badge>)}
                    {item.sourceOutputIds.map(id => <Badge key={id} variant="info">{id}</Badge>)}
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => advance(item)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> {item.status === 'reviewed' && item.approvalRequired ? 'Approval Required' : NEXT_STATUS[item.status]}
                </Button>
              </div>
            </ChamberCard>
          ))}
          {!queue.length && <ChamberCard tone="zinc" className="p-6 text-sm text-zinc-500">No local publishing queue items yet.</ChamberCard>}
        </div>
      </div>
    </ScrollArea>
  )
}
