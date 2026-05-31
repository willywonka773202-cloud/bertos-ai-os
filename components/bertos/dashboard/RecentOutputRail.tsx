'use client'
import { useEffect, useState } from 'react'
import { Archive, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChamberCard } from '@/components/bertos/hermes'

type OutputEntry = {
  id: string
  title: string
  kind: string
  status: string
  tags: string[]
  updatedAt: string
}

export function RecentOutputRail() {
  const [outputs, setOutputs] = useState<OutputEntry[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/bertos/outputs?limit=5', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => { if (!cancelled) setOutputs(data.registry?.outputs ?? []) })
      .catch(() => { if (!cancelled) setOutputs([]) })
    return () => { cancelled = true }
  }, [])

  return (
    <ChamberCard tone="cyan" className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-sky-300" />
          <h2 className="text-sm font-semibold text-zinc-100">Recent Outputs</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={() => window.location.assign('/outputs')}>Open Registry</Button>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {outputs.map(output => (
          <button key={output.id} onClick={() => window.open(`/api/bertos/outputs/${output.id}`, '_blank')} className="rounded-lg border border-zinc-800 bg-black/20 p-3 text-left transition hover:border-sky-400/30">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="default">{output.kind}</Badge>
              <ExternalLink className="h-3 w-3 text-zinc-600" />
            </div>
            <div className="mt-2 line-clamp-2 text-xs font-semibold text-zinc-200">{output.title}</div>
            <div className="mt-1 text-[10px] text-zinc-600">{new Date(output.updatedAt).toLocaleDateString()}</div>
          </button>
        ))}
        {!outputs.length && <div className="text-xs text-zinc-500 md:col-span-2 xl:col-span-5">No registered outputs yet. Run a workflow from Runs / Logs.</div>}
      </div>
    </ChamberCard>
  )
}
