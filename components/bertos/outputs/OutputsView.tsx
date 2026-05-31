'use client'
import { useEffect, useState } from 'react'
import { Archive, CheckCircle2, ExternalLink, FileJson, RefreshCw, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'

type OutputEntry = {
  id: string
  title: string
  kind: string
  status: string
  summary?: string
  tags: string[]
  payloadBytes: number
  recordVersion: number
  createdAt: string
  updatedAt: string
}

type OutputRecord = {
  id: string
  title: string
  kind: string
  status: string
  summary?: string
  tags: string[]
  payload?: any
  version: { recordVersion: number }
  createdAt: string
  updatedAt: string
}

export function OutputsView() {
  const [outputs, setOutputs] = useState<OutputEntry[]>([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<OutputRecord | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const load = async () => {
    const params = query ? `?q=${encodeURIComponent(query)}` : ''
    const data = await fetch(`/api/bertos/outputs${params}`, { cache: 'no-store' }).then(res => res.json())
    setOutputs(data.registry?.outputs ?? [])
  }
  useEffect(() => { void load() }, [])
  const openOutput = async (id: string) => {
    const data = await fetch(`/api/bertos/outputs/${id}`, { cache: 'no-store' }).then(res => res.json())
    if (data.ok) setSelected(data.output)
  }
  const updateStatus = async (status: string) => {
    if (!selected) return
    const approvalPayload = status === 'approved'
      ? { approved: true, approvalReason: 'Approved from Output Registry review panel.' }
      : {}
    const data = await fetch(`/api/bertos/outputs/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...approvalPayload }),
    }).then(res => res.json())
    if (data.ok) {
      setSelected(data.output)
      setNotice(`Output marked ${status}.`)
      await load()
    } else {
      setNotice(data.error ?? `Could not mark output ${status}.`)
    }
  }
  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <RouteHero
          eyebrow="artifact memory"
          title="Output Registry"
          subtitle="Saved, searchable BertOS artifacts with status, versions, source run metadata, and preview descriptors."
          seal={<Archive className="h-5 w-5" />}
          status="nominal"
          metrics={[
            { label: 'Outputs', value: outputs.length, detail: 'indexed artifacts', tone: 'cyan' },
            { label: 'Drafts', value: outputs.filter(output => output.status === 'draft').length, detail: 'needs review', tone: 'amber' },
            { label: 'Archived Hidden', value: 'yes', detail: 'unless requested', tone: 'zinc' },
            { label: 'Storage', value: 'local', detail: 'data/bertos', tone: 'emerald' },
          ]}
        />
        <div className="mb-4 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-800 bg-black/20 px-3">
            <Search className="h-4 w-4 text-zinc-600" />
            <input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void load() }} className="h-9 flex-1 bg-transparent text-sm text-zinc-200 outline-none" placeholder="Search outputs..." />
          </div>
          <Button size="sm" variant="secondary" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
        </div>
        {notice && <ChamberCard tone="cyan" className="mb-4 p-3 text-sm text-cyan-100">{notice}</ChamberCard>}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-2">
            {outputs.map(output => (
              <ChamberCard key={output.id} tone={selected?.id === output.id ? 'cyan' : 'zinc'} className="p-3">
                <button className="w-full text-left" onClick={() => openOutput(output.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileJson className="h-4 w-4 text-sky-300" />
                        <h2 className="truncate font-semibold text-zinc-100">{output.title}</h2>
                        <Badge>{output.kind}</Badge>
                        <Badge variant={output.status === 'draft' ? 'warning' : output.status === 'failed' ? 'error' : 'success'}>{output.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">{output.id} · v{output.recordVersion} · {new Date(output.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </button>
                <div className="mt-2 flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => window.open(`/api/bertos/outputs/${output.id}`, '_blank')}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {output.summary && <p className="mt-2 text-sm text-zinc-400">{output.summary}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">{output.tags.map(tag => <Badge key={tag} variant="default">{tag}</Badge>)}</div>
              </ChamberCard>
            ))}
            {!outputs.length && <ChamberCard tone="zinc" className="p-6 text-sm text-zinc-500">No outputs found yet. Run a workflow or create an artifact through the API.</ChamberCard>}
          </div>
          <ChamberCard tone="bronze" className="p-4">
            {selected ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-100">{selected.title}</h2>
                    <p className="mt-1 text-xs text-zinc-500">{selected.id} · v{selected.version.recordVersion}</p>
                  </div>
                  <Badge variant={selected.status === 'draft' ? 'warning' : selected.status === 'failed' ? 'error' : 'success'}>{selected.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => updateStatus('reviewed')}><CheckCircle2 className="h-3.5 w-3.5" /> Reviewed</Button>
                  <Button size="sm" variant="secondary" onClick={() => updateStatus('approved')}>Approve</Button>
                  <Button size="sm" variant="secondary" onClick={() => updateStatus('archived')}>Archive</Button>
                </div>
                <Preview record={selected} />
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Select an output to preview its markdown, JSON, source links, status, and metadata.</p>
            )}
          </ChamberCard>
        </div>
      </div>
    </ScrollArea>
  )
}

function Preview({ record }: { record: OutputRecord }) {
  const payload = record.payload ?? {}
  const preview = payload.preview ?? {}
  const content = typeof payload.content === 'string' ? payload.content : ''
  const sourceLinks = Array.isArray(payload.sourceLinks) ? payload.sourceLinks as string[] : []
  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
        <div className="text-[10px] uppercase tracking-wide text-zinc-600">Preview</div>
        <div className="mt-1 text-xs text-zinc-300">{preview.kind ?? preview.type ?? record.kind}</div>
        {preview.summary && <p className="mt-2 text-xs text-zinc-500">{preview.summary}</p>}
      </div>
      {content ? (
        <pre className="max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-black/30 p-3 text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap">{content}</pre>
      ) : (
        <pre className="max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-black/30 p-3 text-xs leading-relaxed text-zinc-400">{JSON.stringify(payload, null, 2)}</pre>
      )}
      {sourceLinks.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-600">Source Links</div>
          <div className="space-y-1">
            {sourceLinks.map(link => <a key={link} href={link} target="_blank" className="block truncate text-xs text-cyan-300 hover:text-cyan-100">{link}</a>)}
          </div>
        </div>
      )}
    </div>
  )
}
