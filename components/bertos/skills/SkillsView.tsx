'use client'
import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, FlaskConical, GitBranchPlus, Layers, Play, RefreshCw, ShieldCheck, WandSparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'

type Skill = {
  id: string
  name: string
  version: string
  command: string
  description: string
  requiredPlugins: string[]
  optionalPlugins: string[]
  outputTypes: string[]
  memoryAccess: string
  approvalRequiredFor: string[]
  source: string
  examples: string[]
}

type SkillPatchDraft = {
  patchId: string
  skillId: string
  instruction: string
  currentVersion: string
  proposedVersion: string
  diffSummary: string[]
  status: string
}

export function SkillsView() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [selected, setSelected] = useState<Skill | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<{ agentRunId: string; outputId: string; status: string } | null>(null)
  const [patchDraft, setPatchDraft] = useState<SkillPatchDraft | null>(null)

  const load = async () => {
    setLoading(true)
    const data = await fetch('/api/bertos/skills', { cache: 'no-store' }).then(res => res.json())
    setSkills(data.skills ?? [])
    setSelected((data.skills ?? [])[0] ?? null)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const counts = useMemo(() => ({
    builtIn: skills.filter(skill => skill.source === 'built-in').length,
    runtime: skills.filter(skill => skill.source === 'runtime').length,
  }), [skills])

  const seed = async () => {
    await fetch('/api/bertos/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'seed' }),
    })
    await load()
  }

  const runSelectedSkill = async () => {
    if (!selected) return
    setBusyAction('run')
    setNotice(null)
    try {
      const data = await fetch('/api/bertos/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: selected.id, text: `${selected.command} local_test=true`, project: 'bertos', dryRun: true }),
      }).then(res => res.json())
      if (!data.ok) throw new Error(data.error ?? 'Skill run failed.')
      const outputId = data.output?.outputId ?? data.output?.artifactId ?? 'unknown-output'
      setLastRun({ agentRunId: data.agentRun.agentRunId, outputId, status: data.agentRun.status })
      setNotice(`Local dry run saved: ${outputId}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Skill run failed.')
    } finally {
      setBusyAction(null)
    }
  }

  const promoteSelectedSkill = async () => {
    if (!selected) return
    setBusyAction('automation')
    setNotice(null)
    try {
      const data = await fetch('/api/bertos/automations/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceRunId: lastRun?.agentRunId ?? `skill:${selected.id}`,
          skillChain: [selected.id],
          pluginIds: Array.from(new Set([...selected.requiredPlugins, ...selected.optionalPlugins])),
        }),
      }).then(res => res.json())
      if (!data.ok) throw new Error(data.error ?? 'Automation candidate failed.')
      setNotice(`Automation candidate saved: ${data.candidate.title}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Automation candidate failed.')
    } finally {
      setBusyAction(null)
    }
  }

  const draftPreferencePatch = async () => {
    if (!selected) return
    const instruction = window.prompt(`Update ${selected.name}. Example: "From now on, always include source links."`)
    if (!instruction?.trim()) return
    setBusyAction('patch')
    setNotice(null)
    try {
      const data = await fetch('/api/bertos/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'draftPatch', skillId: selected.id, instruction }),
      }).then(res => res.json())
      if (!data.ok) throw new Error(data.error ?? 'Patch draft failed.')
      setPatchDraft(data.patch)
      setNotice(`Patch drafted for ${selected.name}. Review the diff summary before applying.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Patch draft failed.')
    } finally {
      setBusyAction(null)
    }
  }

  const applyPatchDraft = async (approved: boolean) => {
    if (!patchDraft) return
    setBusyAction(approved ? 'apply-patch' : 'reject-patch')
    try {
      const data = await fetch('/api/bertos/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'applyPatch', patchId: patchDraft.patchId, approved }),
      }).then(res => res.json())
      if (!data.ok) throw new Error(data.error ?? 'Patch update failed.')
      setPatchDraft(null)
      setNotice(approved ? `Skill updated to v${data.patch.proposedVersion}.` : 'Skill patch rejected.')
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Patch update failed.')
    } finally {
      setBusyAction(null)
    }
  }

  const duplicateSelectedSkill = async () => {
    if (!selected) return
    setBusyAction('duplicate')
    setNotice(null)
    try {
      const data = await fetch('/api/bertos/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'duplicate', skillId: selected.id, newId: `${selected.id}-copy` }),
      }).then(res => res.json())
      if (!data.ok) throw new Error(data.error ?? 'Duplicate failed.')
      setNotice(`Duplicated ${selected.name} as ${data.skill.command}.`)
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Duplicate failed.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <RouteHero
          eyebrow="creator os"
          title="Skills Registry"
          subtitle="Reusable BertOS workflows invoked with slash commands. Skills define instructions, outputs, memory access, plugin requirements, and approval gates."
          seal={<WandSparkles className="h-5 w-5" />}
          status={loading ? 'idle' : 'nominal'}
          metrics={[
            { label: 'Installed', value: skills.length, detail: 'slash workflows', tone: 'cyan' },
            { label: 'Built-in', value: counts.builtIn, detail: 'seeded safely', tone: 'bronze' },
            { label: 'Runtime', value: counts.runtime, detail: 'editable local skills', tone: 'emerald' },
            { label: 'Approval Gates', value: skills.reduce((sum, skill) => sum + skill.approvalRequiredFor.length, 0), detail: 'risk controls', tone: 'amber' },
          ]}
        />

        <div className="mb-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          <Button size="sm" onClick={seed}><FlaskConical className="h-3.5 w-3.5" /> Seed Runtime Skills</Button>
        </div>

        {notice && (
          <ChamberCard tone="cyan" className="mb-4 p-3 text-sm text-cyan-100">
            {notice}
          </ChamberCard>
        )}

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-2">
            {skills.map(skill => (
              <button key={skill.id} onClick={() => setSelected(skill)} className="w-full text-left">
                <ChamberCard tone={selected?.id === skill.id ? 'cyan' : 'zinc'} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-zinc-100">{skill.name}</div>
                    <Badge variant="default">{skill.command}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{skill.description}</p>
                </ChamberCard>
              </button>
            ))}
          </div>
          <ChamberCard tone="bronze" className="p-4">
            {selected ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-100">{selected.name}</h2>
                    <p className="text-xs text-zinc-500">v{selected.version} · {selected.source}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(selected.command)}>
                    <Copy className="h-3.5 w-3.5" /> Copy Command
                  </Button>
                </div>
                <p className="mt-3 text-sm text-zinc-400">{selected.description}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Info label="Required Plugins" value={selected.requiredPlugins.join(', ') || 'none'} />
                  <Info label="Optional Plugins" value={selected.optionalPlugins.join(', ') || 'none'} />
                  <Info label="Outputs" value={selected.outputTypes.join(', ') || 'generic'} />
                  <Info label="Memory" value={selected.memoryAccess} />
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
                    <ShieldCheck className="h-3.5 w-3.5" /> Approval Required
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.approvalRequiredFor.map(item => <Badge key={item} variant="warning">{item}</Badge>)}
                    {!selected.approvalRequiredFor.length && <Badge variant="success">none</Badge>}
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-200">
                    <Layers className="h-3.5 w-3.5" /> Examples
                  </div>
                  <pre className="max-h-48 overflow-auto rounded-lg border border-zinc-800 bg-black/30 p-3 text-xs text-zinc-400">{selected.examples.join('\n') || 'No examples yet.'}</pre>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={runSelectedSkill} disabled={Boolean(busyAction)}>
                    <Play className="h-3.5 w-3.5" /> Test Skill
                  </Button>
                  <Button size="sm" variant="secondary" onClick={promoteSelectedSkill} disabled={Boolean(busyAction)}>
                    <GitBranchPlus className="h-3.5 w-3.5" /> Turn Into Automation
                  </Button>
                  <Button size="sm" variant="secondary" onClick={draftPreferencePatch} disabled={Boolean(busyAction)}>
                    Edit Draft
                  </Button>
                  <Button size="sm" variant="secondary" onClick={duplicateSelectedSkill} disabled={Boolean(busyAction)}>
                    Duplicate Skill
                  </Button>
                </div>
                {lastRun && (
                  <div className="mt-4 rounded-lg border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-400">
                    Last run: <span className="font-mono text-zinc-200">{lastRun.agentRunId}</span> · output <span className="font-mono text-zinc-200">{lastRun.outputId}</span> · {lastRun.status}
                  </div>
                )}
                {patchDraft && (
                  <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-950/10 p-3">
                    <div className="text-sm font-semibold text-amber-100">Review skill patch</div>
                    <p className="mt-1 text-xs text-zinc-400">v{patchDraft.currentVersion} → v{patchDraft.proposedVersion}</p>
                    <ul className="mt-3 space-y-1 text-xs text-zinc-300">
                      {patchDraft.diffSummary.map(item => <li key={item}>- {item}</li>)}
                    </ul>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => applyPatchDraft(true)} disabled={Boolean(busyAction)}><Check className="h-3.5 w-3.5" /> Apply</Button>
                      <Button size="sm" variant="secondary" onClick={() => applyPatchDraft(false)} disabled={Boolean(busyAction)}><X className="h-3.5 w-3.5" /> Reject</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-zinc-500">No skills loaded.</p>}
          </ChamberCard>
        </div>
      </div>
    </ScrollArea>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</div>
      <div className="mt-1 text-xs text-zinc-300">{value}</div>
    </div>
  )
}
