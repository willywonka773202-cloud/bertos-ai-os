'use client'
import { useEffect, useState } from 'react'
import { Check, FileDiff, GitMerge, Hammer, Plus, ShieldAlert, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChamberCard, EmptyChamber } from '@/components/bertos/hermes'
import { type CockpitPatch, getJson, postJson, statusBadge } from './types'
import { DiffView, LiveDiff } from './DiffView'

export function PatchForge({ projectId, patches, onRefresh, onNotice }: {
  projectId: string
  patches: CockpitPatch[]
  onRefresh: () => Promise<void> | void
  onNotice: (message: string) => void
}) {
  const [selected, setSelected] = useState<CockpitPatch | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ title: '', path: '', action: 'modify' as 'create' | 'modify' | 'delete', after: '', description: '' })
  const [befores, setBefores] = useState<Record<string, string>>({})

  const active = patches.find(patch => patch.patchProposalId === selected?.patchProposalId) ?? selected

  // Fetch current file content for modify/delete files to render a true before/after diff.
  useEffect(() => {
    if (!active || active.status === 'applied') return
    for (const file of active.filesChanged) {
      if (file.action === 'create') continue
      const key = `${active.patchProposalId}:${file.path}`
      if (befores[key] !== undefined) continue
      void getJson<{ file?: { content: string } }>(`/api/bertos/projects/${projectId}/files/read?path=${encodeURIComponent(file.path)}`)
        .then(d => setBefores(prev => ({ ...prev, [key]: d.file?.content ?? '' })))
        .catch(() => setBefores(prev => ({ ...prev, [key]: '' })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.patchProposalId, projectId])

  const submit = async () => {
    if (!form.title.trim() || !form.path.trim()) {
      onNotice('A patch needs a title and a file path.')
      return
    }
    setBusy(true)
    const result = await postJson(`/api/bertos/projects/${projectId}/patches`, {
      title: form.title,
      description: form.description || undefined,
      files: [{ path: form.path, action: form.action, after: form.action === 'delete' ? undefined : form.after }],
    })
    setBusy(false)
    if (result.ok) {
      onNotice(`Patch proposed (risk: ${result.patch.riskLevel}).`)
      setCreating(false)
      setForm({ title: '', path: '', action: 'modify', after: '', description: '' })
      await onRefresh()
    } else {
      onNotice(result.error ?? 'Could not create patch.')
    }
  }

  const act = async (patch: CockpitPatch, verb: 'approve' | 'reject' | 'apply', extra?: Record<string, unknown>) => {
    setBusy(true)
    const result = await postJson(`/api/bertos/projects/${projectId}/patches/${patch.patchProposalId}/${verb}`, extra ?? {})
    setBusy(false)
    if (verb === 'apply') {
      if (result.ok && result.result?.ok) {
        onNotice(`Patch applied to ${result.result.appliedFiles?.length ?? 0} file(s). Backups saved.`)
      } else if (result.result && !result.result.ok) {
        onNotice(`Apply blocked: ${result.result.conflicts?.map((c: any) => c.reason).join('; ') || 'conflicts detected'}. Use "Apply anyway" to revalidate.`)
      } else {
        onNotice(result.error ?? 'Apply failed.')
      }
    } else if (result.ok) {
      onNotice(`Patch ${verb === 'approve' ? 'approved' : 'rejected'}.`)
    } else {
      onNotice(result.error ?? `Could not ${verb} patch.`)
    }
    await onRefresh()
    if (result.patch) setSelected(result.patch)
  }

  return (
    <ChamberCard
      tone="amber"
      eyebrow="patch forge"
      title="Patch Forge"
      description="Propose scoped patches, review the diff, then approve and apply with version-safe backups."
      action={(
        <Button size="sm" variant="secondary" onClick={() => { setCreating(value => !value); setSelected(null) }}>
          <Plus className="h-3.5 w-3.5" /> Propose
        </Button>
      )}
    >
      {creating && (
        <div className="mb-3 space-y-2 rounded-lg border border-amber-500/20 bg-black/30 p-3">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Patch title" className="h-9 w-full rounded-md border border-zinc-800 bg-black/40 px-3 text-sm text-zinc-100 outline-none focus:border-amber-500/40" />
          <div className="flex gap-2">
            <input value={form.path} onChange={e => setForm({ ...form, path: e.target.value })} placeholder="relative/file/path.ts" className="h-9 flex-1 rounded-md border border-zinc-800 bg-black/40 px-3 text-sm text-zinc-100 outline-none focus:border-amber-500/40" />
            <select value={form.action} onChange={e => setForm({ ...form, action: e.target.value as typeof form.action })} className="h-9 rounded-md border border-zinc-800 bg-black/40 px-2 text-sm text-zinc-200 outline-none">
              <option value="modify">modify</option>
              <option value="create">create</option>
              <option value="delete">delete</option>
            </select>
          </div>
          {form.action !== 'delete' && (
            <textarea value={form.after} onChange={e => setForm({ ...form, after: e.target.value })} placeholder="Full file content after the change…" rows={6} className="w-full rounded-md border border-zinc-800 bg-black/40 px-3 py-2 font-mono text-xs text-zinc-100 outline-none focus:border-amber-500/40" />
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button size="sm" disabled={busy} onClick={submit}><Hammer className="h-3.5 w-3.5" /> Forge proposal</Button>
          </div>
        </div>
      )}

      {patches.length === 0 && !creating ? (
        <EmptyChamber tone="amber" title="No patch proposals" description="Propose a patch to begin the forge → review → approve → apply loop." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-2">
            {patches.map(patch => (
              <button
                key={patch.patchProposalId}
                onClick={() => { setSelected(patch); setCreating(false) }}
                className={`w-full rounded-lg border p-2.5 text-left transition ${active?.patchProposalId === patch.patchProposalId ? 'border-amber-500/40 bg-amber-500/5' : 'border-zinc-800 hover:border-amber-500/25'}`}
              >
                <div className="flex items-center gap-2">
                  <FileDiff className="h-3.5 w-3.5 text-amber-300" />
                  <span className="truncate text-sm font-medium text-zinc-100">{patch.title}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant={statusBadge(patch.status)}>{patch.status}</Badge>
                  <Badge variant={patch.riskLevel === 'high' ? 'error' : patch.riskLevel === 'medium' ? 'warning' : 'success'}>{patch.riskLevel} risk</Badge>
                  <span className="text-[11px] text-zinc-600">{patch.filesChanged.length} file(s)</span>
                </div>
              </button>
            ))}
          </div>

          {active && (
            <div className="space-y-3 rounded-lg border border-zinc-800 bg-black/20 p-3">
              <div>
                <h4 className="text-sm font-semibold text-zinc-100">{active.title}</h4>
                {active.description && <p className="mt-1 text-xs text-zinc-500">{active.description}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {active.filesChanged.map(file => (
                    <Badge key={file.path} variant="default">{file.action} · {file.path}</Badge>
                  ))}
                </div>
              </div>

              {active.status === 'applied' ? (
                <DiffView diff={active.diff} />
              ) : (
                <div className="space-y-2">
                  {active.filesChanged.map(file => {
                    const key = `${active.patchProposalId}:${file.path}`
                    const before = file.action === 'create' ? '' : befores[key]
                    const after = file.action === 'delete' ? '' : (file.after ?? '')
                    if (file.action !== 'create' && before === undefined) {
                      return <div key={file.path} className="rounded-lg border border-zinc-800 bg-black/20 p-2 text-xs text-zinc-500">Loading diff for {file.path}…</div>
                    }
                    return <LiveDiff key={file.path} before={before ?? ''} after={after} label={`${file.action} · ${file.path}`} />
                  })}
                </div>
              )}

              {active.status === 'applied' ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/25 bg-emerald-500/5 p-2 text-xs text-emerald-300">
                  <Check className="h-3.5 w-3.5" /> Applied · backups recorded{active.appliedOutputId ? ' · report saved to Outputs' : ''}
                </div>
              ) : active.status === 'rejected' ? (
                <div className="flex items-center gap-2 rounded-md border border-red-500/25 bg-red-500/5 p-2 text-xs text-red-300">
                  <X className="h-3.5 w-3.5" /> Rejected
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {active.status === 'proposed' && (
                    <>
                      <Button size="sm" disabled={busy} onClick={() => act(active, 'approve')}><ShieldAlert className="h-3.5 w-3.5" /> Approve</Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(active, 'reject')}>Reject</Button>
                    </>
                  )}
                  {active.status === 'approved' && (
                    <>
                      <Button size="sm" disabled={busy} onClick={() => act(active, 'apply', { runValidationAfter: true })}><GitMerge className="h-3.5 w-3.5" /> Apply</Button>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(active, 'apply', { revalidate: true, runValidationAfter: true })}>Apply anyway (revalidate)</Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(active, 'reject')}>Reject</Button>
                    </>
                  )}
                  <span className="text-[11px] text-zinc-600">Apply is gated behind approval and creates backups.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </ChamberCard>
  )
}
