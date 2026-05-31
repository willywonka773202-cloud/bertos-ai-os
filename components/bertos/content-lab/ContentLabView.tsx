'use client'
import { useEffect, useState } from 'react'
import { FileText, Layers, Play, RefreshCw, Send } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'

type WorkflowDefinition = {
  id: string
  name: string
  description: string
  skillChain: string[]
  pluginIds: string[]
  outputTypes: string[]
  approvalRequired: boolean
}

type GroundingPack = {
  groundingPackId: string
  taskReason: string
  sources: Array<{ sourceName: string; sourceType: string; sourceUrl?: string }>
  createdAt: string
}

type OutputEntry = {
  id: string
  title: string
  status: string
  tags: string[]
  updatedAt: string
}

export function ContentLabView() {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([])
  const [groundingPacks, setGroundingPacks] = useState<GroundingPack[]>([])
  const [outputs, setOutputs] = useState<OutputEntry[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState('research-outline-draft-publish-checklist')
  const [prompt, setPrompt] = useState('Create a grounded outline, draft direction, and publishing checklist for a BertOS creator workflow.')
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    const [workflowData, groundingData, outputData] = await Promise.all([
      fetch('/api/bertos/workflows/run', { cache: 'no-store' }).then(res => res.json()),
      fetch('/api/bertos/grounding?limit=6', { cache: 'no-store' }).then(res => res.json()),
      fetch('/api/bertos/outputs?tag=workflow&limit=8&includeArchived=true', { cache: 'no-store' }).then(res => res.json()),
    ])
    setWorkflows(workflowData.workflows ?? [])
    setGroundingPacks(groundingData.packs ?? [])
    setOutputs(outputData.registry?.outputs ?? [])
  }

  useEffect(() => { void load() }, [])

  const runWorkflow = async () => {
    const data = await fetch('/api/bertos/workflows/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId: selectedWorkflow, prompt, project: 'bertos' }),
    }).then(res => res.json())
    setNotice(data.ok ? `Workflow saved output ${data.result.output.outputId}.` : data.error ?? 'Workflow failed.')
    await load()
  }

  const queueLatest = async () => {
    const latest = outputs[0]
    if (!latest) return setNotice('No workflow output is available to queue.')
    const data = await fetch('/api/bertos/publishing/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: latest.title, caption: latest.title, sourceOutputIds: [latest.id], approvalRequired: true }),
    }).then(res => res.json())
    setNotice(data.ok ? `Saved local queue item ${data.item.queueItemId}.` : data.error ?? 'Could not queue item.')
  }

  const activeWorkflow = workflows.find(workflow => workflow.id === selectedWorkflow)

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <RouteHero
          eyebrow="creator workflows"
          title="Content Lab"
          subtitle="Grounding packs, workflow templates, drafts, diagrams, scripts, and local publishing handoffs in one runtime lane."
          seal={<FileText className="h-5 w-5" />}
          status="nominal"
          metrics={[
            { label: 'Workflows', value: workflows.length, detail: 'templates', tone: 'cyan' },
            { label: 'Grounding', value: groundingPacks.length, detail: 'recent packs', tone: 'bronze' },
            { label: 'Outputs', value: outputs.length, detail: 'workflow artifacts', tone: 'emerald' },
            { label: 'External Publish', value: 'gated', detail: 'local queue first', tone: 'amber' },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <ChamberCard tone="bronze" className="p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-100"><Layers className="h-4 w-4" /> Workflow Stack</div>
            <select value={selectedWorkflow} onChange={event => setSelectedWorkflow(event.target.value)} className="mb-3 h-9 w-full rounded-lg border border-zinc-800 bg-black/30 px-3 text-sm text-zinc-200 outline-none">
              {workflows.map(workflow => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
            </select>
            {activeWorkflow && (
              <div className="mb-3 rounded-lg border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-400">
                <p>{activeWorkflow.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeWorkflow.skillChain.map(skill => <Badge key={skill}>{skill}</Badge>)}
                  {activeWorkflow.pluginIds.map(plugin => <Badge key={plugin} variant="info">@{plugin}</Badge>)}
                  {activeWorkflow.outputTypes.map(type => <Badge key={type} variant="default">{type}</Badge>)}
                  {activeWorkflow.approvalRequired && <Badge variant="warning">approval-gated</Badge>}
                </div>
              </div>
            )}
            <textarea value={prompt} onChange={event => setPrompt(event.target.value)} className="min-h-28 w-full rounded-lg border border-zinc-800 bg-black/30 p-3 text-sm text-zinc-200 outline-none" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={runWorkflow}><Play className="h-3.5 w-3.5" /> Run Stack</Button>
              <Button size="sm" variant="secondary" onClick={queueLatest}><Send className="h-3.5 w-3.5" /> Queue Latest</Button>
              <Button size="sm" variant="secondary" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
            </div>
            {notice && <p className="mt-3 text-xs text-cyan-100">{notice}</p>}
          </ChamberCard>
          <div className="space-y-3">
            <ChamberCard tone="cyan" className="p-4">
              <h2 className="text-sm font-semibold text-zinc-100">Recent Grounding</h2>
              <div className="mt-3 space-y-2">
                {groundingPacks.map(pack => (
                  <div key={pack.groundingPackId} className="rounded border border-zinc-800 bg-black/20 p-2">
                    <div className="truncate text-xs font-semibold text-zinc-200">{pack.taskReason}</div>
                    <p className="mt-1 text-[11px] text-zinc-500">{pack.sources.length} sources · {new Date(pack.createdAt).toLocaleString()}</p>
                  </div>
                ))}
                {!groundingPacks.length && <p className="text-xs text-zinc-500">No grounding packs yet.</p>}
              </div>
            </ChamberCard>
            <ChamberCard tone="emerald" className="p-4">
              <h2 className="text-sm font-semibold text-zinc-100">Workflow Outputs</h2>
              <div className="mt-3 space-y-2">
                {outputs.map(output => (
                  <div key={output.id} className="rounded border border-zinc-800 bg-black/20 p-2">
                    <div className="truncate text-xs font-semibold text-zinc-200">{output.title}</div>
                    <p className="mt-1 text-[11px] text-zinc-500">{output.status} · {new Date(output.updatedAt).toLocaleString()}</p>
                  </div>
                ))}
                {!outputs.length && <p className="text-xs text-zinc-500">No workflow outputs yet.</p>}
              </div>
            </ChamberCard>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
