'use client'
import { useEffect, useState } from 'react'
import { Activity, GitBranch, Play, RefreshCw, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'

type RunsPayload = {
  agentRuns: Array<{ agentRunId: string; title: string; status: string; lanes: any[]; outputIds: string[]; memoryProposalIds: string[]; updatedAt: string }>
  workflowRuns: Array<{ workflowRunId: string; workflowId: string; title: string; status: string; outputIds: string[]; memoryProposalIds: string[]; updatedAt: string }>
}

type WorkflowDefinition = {
  id: string
  name: string
  description: string
  skillChain: string[]
  pluginIds: string[]
  approvalRequired: boolean
}

export function RunsView() {
  const [runs, setRuns] = useState<RunsPayload>({ agentRuns: [], workflowRuns: [] })
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState('content-idea-digest')
  const [prompt, setPrompt] = useState('Create a local content idea digest from current BertOS memory and outputs.')
  const [notice, setNotice] = useState<string | null>(null)
  const load = async () => {
    const [runData, workflowData] = await Promise.all([
      fetch('/api/bertos/runs', { cache: 'no-store' }).then(res => res.json()),
      fetch('/api/bertos/workflows/run', { cache: 'no-store' }).then(res => res.json()),
    ])
    setRuns({ agentRuns: runData.agentRuns ?? [], workflowRuns: runData.workflowRuns ?? [] })
    setWorkflows(workflowData.workflows ?? [])
  }
  useEffect(() => { void load() }, [])
  const runSelectedWorkflow = async () => {
    const data = await fetch('/api/bertos/workflows/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId: selectedWorkflow, prompt, project: 'bertos' }),
    }).then(res => res.json())
    setNotice(data.ok ? `Workflow run saved: ${data.result.workflowRun.workflowRunId}` : data.error ?? 'Workflow failed.')
    await load()
  }
  const activeWorkflow = workflows.find(workflow => workflow.id === selectedWorkflow)
  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <RouteHero
          eyebrow="runtime ledger"
          title="Runs / Logs"
          subtitle="Workflow runs, agent run lanes, outputs, memory proposals, and approval-gated execution records."
          seal={<Activity className="h-5 w-5" />}
          status="nominal"
          metrics={[
            { label: 'Agent Runs', value: runs.agentRuns.length, detail: 'lane records', tone: 'cyan' },
            { label: 'Workflow Runs', value: runs.workflowRuns.length, detail: 'runtime workflows', tone: 'bronze' },
            { label: 'Workflow Types', value: workflows.length, detail: 'templates', tone: 'emerald' },
            { label: 'Needs Approval', value: [...runs.agentRuns, ...runs.workflowRuns].filter(run => run.status === 'needs-approval').length, detail: 'gated', tone: 'amber' },
          ]}
        />
        <ChamberCard tone="bronze" className="mb-4 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-100"><Workflow className="h-4 w-4" /> Run Production Workflow</div>
          <select value={selectedWorkflow} onChange={event => setSelectedWorkflow(event.target.value)} className="mb-2 h-9 w-full rounded-lg border border-zinc-800 bg-black/30 px-3 text-sm text-zinc-200 outline-none">
            {workflows.map(workflow => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
          </select>
          {activeWorkflow && (
            <div className="mb-3 rounded-lg border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-400">
              <div>{activeWorkflow.description}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeWorkflow.skillChain.map(skill => <Badge key={skill}>{skill}</Badge>)}
                {activeWorkflow.pluginIds.map(plugin => <Badge key={plugin} variant="info">@{plugin}</Badge>)}
                {activeWorkflow.approvalRequired && <Badge variant="warning">approval-gated</Badge>}
              </div>
            </div>
          )}
          <textarea value={prompt} onChange={event => setPrompt(event.target.value)} className="min-h-20 w-full rounded-lg border border-zinc-800 bg-black/30 p-3 text-sm text-zinc-200 outline-none" />
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={runSelectedWorkflow}><Play className="h-3.5 w-3.5" /> Run Workflow</Button>
            <Button size="sm" variant="secondary" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          </div>
          {notice && <p className="mt-3 text-xs text-cyan-100">{notice}</p>}
        </ChamberCard>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-200">Workflow Runs</h2>
            {runs.workflowRuns.map(run => <RunCard key={run.workflowRunId} id={run.workflowRunId} title={run.title} status={run.status} detail={run.workflowId} updatedAt={run.updatedAt} outputs={run.outputIds.length} proposals={run.memoryProposalIds.length} />)}
          </section>
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-200">Agent Lanes</h2>
            {runs.agentRuns.map(run => (
              <ChamberCard key={run.agentRunId} tone={run.status === 'needs-approval' ? 'amber' : 'zinc'} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-zinc-100">{run.title}</div>
                  <Badge variant={run.status === 'needs-approval' ? 'warning' : 'success'}>{run.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{run.agentRunId} · {new Date(run.updatedAt).toLocaleString()}</p>
                <div className="mt-3 space-y-1.5">
                  {run.lanes.map(lane => (
                    <div key={lane.laneId} className="flex items-center justify-between rounded border border-zinc-800 bg-black/20 px-2 py-1 text-xs">
                      <span className="text-zinc-300"><GitBranch className="mr-1 inline h-3 w-3" />{lane.role}</span>
                      <span className="text-zinc-500">{lane.status}</span>
                    </div>
                  ))}
                </div>
              </ChamberCard>
            ))}
          </section>
        </div>
      </div>
    </ScrollArea>
  )
}

function RunCard({ id, title, status, detail, updatedAt, outputs, proposals }: { id: string; title: string; status: string; detail: string; updatedAt: string; outputs: number; proposals: number }) {
  return (
    <ChamberCard tone={status === 'needs-approval' ? 'amber' : 'zinc'} className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-zinc-100">{title}</div>
        <Badge variant={status === 'needs-approval' ? 'warning' : 'success'}>{status}</Badge>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{id} · {detail} · {new Date(updatedAt).toLocaleString()}</p>
      <p className="mt-2 text-xs text-zinc-400">{outputs} outputs · {proposals} memory proposals</p>
    </ChamberCard>
  )
}
