'use client'
import { useState } from 'react'
import { Check, ClipboardList, Plus, ScrollText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChamberCard, EmptyChamber } from '@/components/bertos/hermes'
import { type CockpitDecision, type CockpitTask, postJson, statusBadge } from './types'

export function TaskPhalanx({ projectId, tasks, onRefresh, onNotice }: {
  projectId: string
  tasks: CockpitTask[]
  onRefresh: () => Promise<void> | void
  onNotice: (message: string) => void
}) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const open = tasks.filter(task => !['done', 'archived'].includes(task.status))
  const done = tasks.filter(task => task.status === 'done').slice(0, 4)

  const create = async () => {
    if (!title.trim()) return
    setBusy(true)
    const result = await postJson('/api/bertos/tasks', { title, projectId, status: 'planned' })
    setBusy(false)
    if (result.ok) { setTitle(''); await onRefresh(); onNotice('Task added.') }
    else onNotice(result.error ?? 'Could not add task.')
  }
  const complete = async (task: CockpitTask) => {
    await postJson(`/api/bertos/tasks/${task.taskId}/complete`, {})
    await onRefresh()
  }

  return (
    <ChamberCard tone="cyan" eyebrow="task phalanx" title="Task Phalanx" description="Local task board for the active project.">
      <div className="mb-3 flex gap-2">
        <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void create() }} placeholder="Add a task…" className="h-9 flex-1 rounded-md border border-zinc-800 bg-black/40 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-500/40" />
        <Button size="sm" disabled={busy} onClick={create}><Plus className="h-3.5 w-3.5" /></Button>
      </div>
      {open.length === 0 ? (
        <EmptyChamber tone="cyan" title="No open tasks" description="Add a task or let a workflow create follow-ups." />
      ) : (
        <div className="space-y-1.5">
          {open.map(task => (
            <div key={task.taskId} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-black/20 p-2">
              <button onClick={() => complete(task)} title="Complete" className="grid h-5 w-5 place-items-center rounded border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10">
                <Check className="h-3 w-3" />
              </button>
              <ClipboardList className="h-3.5 w-3.5 text-zinc-600" />
              <span className="flex-1 truncate text-sm text-zinc-200">{task.title}</span>
              <Badge variant={task.priority === 'urgent' || task.priority === 'high' ? 'warning' : 'default'}>{task.priority}</Badge>
              <Badge variant={statusBadge(task.status)}>{task.status}</Badge>
            </div>
          ))}
        </div>
      )}
      {done.length > 0 && (
        <div className="mt-2 border-t border-zinc-800 pt-2 text-xs text-zinc-600">
          {done.map(task => <div key={task.taskId} className="truncate line-through">✓ {task.title}</div>)}
        </div>
      )}
    </ChamberCard>
  )
}

export function DecisionLedger({ projectId, decisions, onRefresh, onNotice }: {
  projectId: string
  decisions: CockpitDecision[]
  onRefresh: () => Promise<void> | void
  onNotice: (message: string) => void
}) {
  const [form, setForm] = useState({ title: '', decision: '' })
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const create = async () => {
    if (!form.title.trim() || !form.decision.trim()) { onNotice('A decision needs a title and a statement.'); return }
    setBusy(true)
    const result = await postJson('/api/bertos/decisions', { ...form, projectId })
    setBusy(false)
    if (result.ok) { setForm({ title: '', decision: '' }); setOpen(false); await onRefresh(); onNotice('Decision recorded.') }
    else onNotice(result.error ?? 'Could not record decision.')
  }

  return (
    <ChamberCard
      tone="violet"
      eyebrow="decision ledger"
      title="Decision Ledger"
      description="Architecture & project decisions, recorded for future you."
      action={<Button size="sm" variant="secondary" onClick={() => setOpen(value => !value)}><Plus className="h-3.5 w-3.5" /> Record</Button>}
    >
      {open && (
        <div className="mb-3 space-y-2 rounded-lg border border-violet-500/20 bg-black/30 p-3">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Decision title" className="h-9 w-full rounded-md border border-zinc-800 bg-black/40 px-3 text-sm text-zinc-100 outline-none focus:border-violet-500/40" />
          <textarea value={form.decision} onChange={e => setForm({ ...form, decision: e.target.value })} placeholder="What did we decide, and why?" rows={3} className="w-full rounded-md border border-zinc-800 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500/40" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={busy} onClick={create}>Record decision</Button>
          </div>
        </div>
      )}
      {decisions.length === 0 ? (
        <EmptyChamber tone="violet" title="No decisions yet" description="Record an architecture or project decision to build your ledger." />
      ) : (
        <div className="space-y-2">
          {decisions.slice(0, 6).map(decision => (
            <div key={decision.decisionId} className="rounded-lg border border-zinc-800 bg-black/20 p-2.5">
              <div className="flex items-center gap-2">
                <ScrollText className="h-3.5 w-3.5 text-violet-300" />
                <span className="flex-1 truncate text-sm font-medium text-zinc-100">{decision.title}</span>
                <Badge variant={statusBadge(decision.status)}>{decision.status}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{decision.decision}</p>
            </div>
          ))}
        </div>
      )}
    </ChamberCard>
  )
}
