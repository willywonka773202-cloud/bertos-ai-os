'use client'
import { useState } from 'react'
import { Search, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChamberCard } from '@/components/bertos/hermes'
import { getJson } from './types'

interface Result {
  type: string
  id: string
  title: string
  snippet?: string
  source: string
  link: string
}

const TYPE_LABEL: Record<string, string> = {
  project: 'Project', file: 'File', output: 'Output', run: 'Run', task: 'Task',
  memory: 'Memory', patch: 'Patch', command: 'Command', validation: 'Validation',
  decision: 'Decision', approval: 'Approval',
}

export function OracleSearch({ projectId }: { projectId?: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (query.trim().length < 2) return
    setBusy(true)
    const params = new URLSearchParams({ q: query, files: 'true' })
    if (projectId) params.set('projectId', projectId)
    const data = await getJson(`/api/bertos/search?${params.toString()}`)
    setBusy(false)
    setSearched(true)
    setResults(data.results ?? [])
  }

  const grouped = results.reduce<Record<string, Result[]>>((acc, result) => {
    ;(acc[result.type] ??= []).push(result)
    return acc
  }, {})

  return (
    <ChamberCard tone="cyan" eyebrow="oracle search" title="Oracle Search" description="Query the whole BertOS constellation — projects, files, patches, tasks, decisions, outputs, approvals.">
      <div className="mb-3 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-800 bg-black/30 px-3">
          <Search className="h-4 w-4 text-zinc-600" />
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void run() }} placeholder="Search everything…" className="h-9 flex-1 bg-transparent text-sm text-zinc-200 outline-none" />
        </div>
        <Button size="sm" disabled={busy} onClick={run}><Sparkles className="h-3.5 w-3.5" /> Search</Button>
      </div>
      {searched && results.length === 0 && <p className="text-sm text-zinc-500">No matches for “{query}”.</p>}
      <div className="space-y-3">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/60">
              {TYPE_LABEL[type] ?? type} <span className="text-zinc-600">({items.length})</span>
            </div>
            <div className="space-y-1">
              {items.slice(0, 6).map(result => (
                <a key={`${result.type}-${result.id}`} href={result.link} className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-black/20 px-2.5 py-1.5 text-sm text-zinc-300 transition hover:border-cyan-500/30 hover:text-zinc-100">
                  <span className="min-w-0">
                    <span className="block truncate">{result.title}</span>
                    {result.snippet && <span className="block truncate text-[11px] text-zinc-600">{result.snippet}</span>}
                  </span>
                  <Badge variant="default">{result.source}</Badge>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ChamberCard>
  )
}
