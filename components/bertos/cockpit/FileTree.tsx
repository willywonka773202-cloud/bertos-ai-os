'use client'
import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Search, ShieldAlert, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ChamberCard } from '@/components/bertos/hermes'
import { getJson } from './types'

interface Entry { path: string; name: string; type: 'file' | 'dir'; sizeBytes?: number; ext?: string }
interface FilePreview { path: string; content: string; truncated: boolean; redactionApplied: boolean; language: string }

export function FileTree({ projectId }: { projectId: string }) {
  const [dirs, setDirs] = useState<Record<string, Entry[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['']))
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<{ path: string; line: number; preview: string }[] | null>(null)

  const loadDir = useCallback(async (dir: string) => {
    setLoading(prev => new Set(prev).add(dir))
    const data = await getJson<{ entries: Entry[] }>(`/api/bertos/projects/${projectId}/files?dir=${encodeURIComponent(dir)}`)
    setDirs(prev => ({ ...prev, [dir]: data.entries ?? [] }))
    setLoading(prev => { const next = new Set(prev); next.delete(dir); return next })
  }, [projectId])

  useEffect(() => { void loadDir('') }, [loadDir])

  const toggle = (dir: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir)
      else { next.add(dir); if (!dirs[dir]) void loadDir(dir) }
      return next
    })
  }

  const openFile = async (path: string) => {
    setPreviewError(null)
    setPreview(null)
    const res = await fetch(`/api/bertos/projects/${projectId}/files/read?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
    const data = await res.json()
    if (data.ok) setPreview(data.file)
    else setPreviewError(data.error ?? 'Could not open file.')
  }

  const runSearch = async () => {
    if (query.trim().length < 2) { setHits(null); return }
    const data = await getJson<{ hits: { path: string; line: number; preview: string }[] }>(`/api/bertos/projects/${projectId}/search?q=${encodeURIComponent(query)}`)
    setHits(data.hits ?? [])
  }

  const renderDir = (dir: string, depth: number) => {
    const entries = dirs[dir] ?? []
    return entries.map(entry => {
      const isOpen = expanded.has(entry.path)
      if (entry.type === 'dir') {
        return (
          <div key={entry.path}>
            <button onClick={() => toggle(entry.path)} style={{ paddingLeft: depth * 12 + 4 }} className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200">
              {isOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
              {isOpen ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-300/70" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-amber-300/70" />}
              <span className="truncate">{entry.name}</span>
            </button>
            {isOpen && (loading.has(entry.path) ? <div style={{ paddingLeft: depth * 12 + 24 }} className="py-0.5 text-[10px] text-zinc-600">loading…</div> : renderDir(entry.path, depth + 1))}
          </div>
        )
      }
      return (
        <button key={entry.path} onClick={() => openFile(entry.path)} style={{ paddingLeft: depth * 12 + 20 }} className={`flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-white/5 ${preview?.path === entry.path ? 'bg-cyan-500/10 text-cyan-200' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <File className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
          <span className="truncate">{entry.name}</span>
        </button>
      )
    })
  }

  return (
    <ChamberCard tone="cyan" eyebrow="constellation files" title="File Explorer" description="Browse and preview project files safely. Sensitive files and build dirs are excluded; secrets are redacted.">
      <div className="mb-2 flex items-center gap-2 rounded-md border border-zinc-800 bg-black/30 px-2">
        <Search className="h-3.5 w-3.5 text-zinc-600" />
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void runSearch() }} placeholder="Search file contents…" className="h-8 flex-1 bg-transparent text-xs text-zinc-200 outline-none" />
        {hits !== null && <button onClick={() => { setHits(null); setQuery('') }} className="text-zinc-600 hover:text-zinc-300"><X className="h-3.5 w-3.5" /></button>}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <div className="max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-black/20 p-1">
          {hits !== null ? (
            hits.length === 0 ? <p className="p-2 text-xs text-zinc-600">No matches.</p> : hits.map((hit, i) => (
              <button key={`${hit.path}:${hit.line}:${i}`} onClick={() => openFile(hit.path)} className="block w-full rounded px-1.5 py-1 text-left text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200">
                <span className="block truncate font-medium text-zinc-300">{hit.path}<span className="text-zinc-600">:{hit.line}</span></span>
                <span className="block truncate font-mono text-[10px] text-zinc-600">{hit.preview}</span>
              </button>
            ))
          ) : (
            renderDir('', 0)
          )}
        </div>
        <div className="max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-[#070503]">
          {previewError ? (
            <div className="flex items-center gap-2 p-3 text-xs text-amber-300"><ShieldAlert className="h-4 w-4" /> {previewError}</div>
          ) : preview ? (
            <div>
              <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-1.5 text-[10px] text-zinc-500">
                <span className="truncate font-mono">{preview.path}</span>
                <span className="flex items-center gap-1.5">
                  <Badge variant="default">{preview.language}</Badge>
                  {preview.redactionApplied && <Badge variant="warning">redacted</Badge>}
                  {preview.truncated && <Badge variant="default">truncated</Badge>}
                </span>
              </div>
              <pre className="overflow-auto p-3 font-mono text-[11px] leading-relaxed text-zinc-300">{preview.content}</pre>
            </div>
          ) : (
            <div className="p-3 text-xs text-zinc-600">Select a file to preview it.</div>
          )}
        </div>
      </div>
    </ChamberCard>
  )
}
