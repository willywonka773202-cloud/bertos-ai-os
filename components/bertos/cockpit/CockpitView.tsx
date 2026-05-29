'use client'
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, Boxes, FlaskConical, FolderGit2, GitBranch, Plus, RefreshCw,
  Sparkles, Terminal, Wand2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, EmptyChamber, RouteHero } from '@/components/bertos/hermes'
import { PatchForge } from './PatchForge'
import { GuardianGates } from './GuardianGates'
import { DecisionLedger, TaskPhalanx } from './TaskPhalanx'
import { OracleSearch } from './OracleSearch'
import { AICommandCenter } from './AICommandCenter'
import { AttentionStrip, MemoryChapel, ReadinessCard, RecentRuns } from './CockpitPanels'
import { FileTree } from './FileTree'
import {
  type CockpitOverview, type CockpitProject, type CockpitWorkflow,
  getJson, postJson, statusBadge,
} from './types'

type MetricTone = 'cyan' | 'bronze' | 'emerald' | 'amber' | 'red' | 'violet' | 'zinc'

export function CockpitView() {
  const [data, setData] = useState<CockpitOverview | null>(null)
  const [workflows, setWorkflows] = useState<CockpitWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [featureRequest, setFeatureRequest] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [register, setRegister] = useState({ name: '', repoPath: '', description: '', validationCommands: '' })
  const [commandInput, setCommandInput] = useState('')

  const projectId = data?.project?.projectId

  const load = useCallback(async () => {
    const overview = await getJson<CockpitOverview & { ok: boolean }>('/api/bertos/coding/overview')
    setData(overview)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    void getJson<{ workflows: CockpitWorkflow[] }>('/api/bertos/coding/workflows/run').then(res => setWorkflows(res.workflows ?? []))
  }, [load])

  const flash = useCallback((message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(null), 6000)
  }, [])

  const registerProject = async () => {
    if (!register.name.trim() || !register.repoPath.trim()) { flash('Project needs a name and a repo path.'); return }
    setBusy('register')
    const result = await postJson('/api/bertos/projects', {
      name: register.name,
      repoPath: register.repoPath,
      description: register.description || undefined,
      validationCommands: register.validationCommands ? register.validationCommands.split(/[\n,]/).map(s => s.trim()).filter(Boolean) : undefined,
    })
    setBusy(null)
    if (result.ok) {
      flash(`Registered “${result.project.name}”.`)
      setShowRegister(false)
      setRegister({ name: '', repoPath: '', description: '', validationCommands: '' })
      await load()
    } else {
      flash(result.error ?? 'Could not register project.')
    }
  }

  const activate = async (project: CockpitProject) => {
    setBusy(project.projectId)
    await postJson(`/api/bertos/projects/${project.projectId}/activate`, {})
    setBusy(null)
    await load()
  }

  const runWorkflow = async (workflowId: string) => {
    if (!projectId) return
    setBusy(workflowId)
    const result = await postJson('/api/bertos/coding/workflows/run', {
      projectId,
      workflowId,
      request: workflowId === 'feature-request-to-patch-plan' ? featureRequest : undefined,
    })
    setBusy(null)
    if (result.ok) {
      const created = result.result?.createdTaskIds?.length ? ` · ${result.result.createdTaskIds.length} task(s) created` : ''
      flash(`${result.result?.title ?? 'Workflow'} saved to Outputs (local, no LLM)${created}.`)
      await load()
    } else {
      flash(result.error ?? 'Workflow failed.')
    }
  }

  const runValidation = async () => {
    if (!projectId) return
    setBusy('validate')
    const result = await postJson(`/api/bertos/projects/${projectId}/validate`, {})
    setBusy(null)
    flash(result.ok ? `Validation ${result.report.status}: ${result.report.summary}` : (result.error ?? 'Validation failed.'))
    await load()
  }

  const runCommand = async () => {
    if (!projectId || !commandInput.trim()) return
    setBusy('command')
    const result = await postJson(`/api/bertos/projects/${projectId}/commands`, { command: commandInput })
    setBusy(null)
    if (result.ok) {
      flash(`Command ${result.run.status}${result.run.exitCode !== undefined ? ` (exit ${result.run.exitCode})` : ''}.`)
      setCommandInput('')
      await load()
    } else {
      flash(result.error ?? 'Command failed.')
    }
  }

  const health = data?.health
  const project = data?.project
  const metrics = useMemo<Array<{ label: string; value: ReactNode; detail?: string; tone: MetricTone }>>(() => {
    if (!project) return []
    return [
      { label: 'Branch', value: health?.branch ?? (health?.isGitRepo ? '—' : 'no git'), detail: health?.clean === false ? `${health?.changedFiles ?? 0} changed` : 'clean', tone: 'cyan' },
      { label: 'Validation', value: health?.lastValidationStatus ?? 'not run', detail: 'last report', tone: health?.lastValidationStatus === 'passed' ? 'emerald' : 'amber' },
      { label: 'Open tasks', value: health?.openTasks ?? 0, detail: 'in phalanx', tone: 'bronze' },
      { label: 'Gates', value: health?.pendingApprovals ?? 0, detail: 'pending approvals', tone: health?.pendingApprovals ? 'red' : 'emerald' },
    ]
  }, [project, health])

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <RouteHero
          eyebrow="everyday coding os"
          title={project ? `Dev Cockpit — ${project.name}` : 'Dev Cockpit'}
          subtitle="Your daily coding sanctuary. Register a repo, browse it safely, run validation, forge patches behind approval, and keep every run, output, task and decision in one place."
          seal={<Terminal className="h-5 w-5" />}
          status={health?.pendingApprovals ? 'warning' : 'active'}
          metrics={metrics}
        />

        {!loading && project && <AttentionStrip health={health} />}

        {notice && (
          <ChamberCard tone="cyan" className="mb-4 p-3 text-sm text-cyan-100">{notice}</ChamberCard>
        )}

        {!loading && (data?.projects.length ?? 0) === 0 && (
          <ChamberCard tone="violet" className="mb-4" eyebrow="first run" title="Welcome to BertOS" description="A local-first AI coding OS. Register a repo below to begin, or take the guided tour.">
            <a href="/onboarding"><Button size="sm" variant="secondary">Open the guided setup →</Button></a>
          </ChamberCard>
        )}

        {/* ── Sanctuary: project registry ── */}
        <ChamberCard
          tone="bronze"
          eyebrow="sanctuary"
          title="Project Sanctuary"
          description="Register and select the repositories BertOS works on. Local-first; sensitive paths are rejected."
          className="mb-4"
          action={<Button size="sm" variant="secondary" onClick={() => setShowRegister(v => !v)}><Plus className="h-3.5 w-3.5" /> Register</Button>}
        >
          {showRegister && (
            <div className="mb-3 grid gap-2 rounded-lg border border-amber-500/20 bg-black/30 p-3 sm:grid-cols-2">
              <input value={register.name} onChange={e => setRegister({ ...register, name: e.target.value })} placeholder="Project name" className="h-9 rounded-md border border-zinc-800 bg-black/40 px-3 text-sm text-zinc-100 outline-none focus:border-amber-500/40" />
              <input value={register.repoPath} onChange={e => setRegister({ ...register, repoPath: e.target.value })} placeholder="Absolute repo path" className="h-9 rounded-md border border-zinc-800 bg-black/40 px-3 text-sm text-zinc-100 outline-none focus:border-amber-500/40" />
              <input value={register.description} onChange={e => setRegister({ ...register, description: e.target.value })} placeholder="Description (optional)" className="h-9 rounded-md border border-zinc-800 bg-black/40 px-3 text-sm text-zinc-100 outline-none focus:border-amber-500/40 sm:col-span-2" />
              <input value={register.validationCommands} onChange={e => setRegister({ ...register, validationCommands: e.target.value })} placeholder="Validation commands (comma-separated, e.g. npm run typecheck)" className="h-9 rounded-md border border-zinc-800 bg-black/40 px-3 text-sm text-zinc-100 outline-none focus:border-amber-500/40 sm:col-span-2" />
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button size="sm" variant="ghost" onClick={() => setShowRegister(false)}>Cancel</Button>
                <Button size="sm" disabled={busy === 'register'} onClick={registerProject}><FolderGit2 className="h-3.5 w-3.5" /> Register repo</Button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-sm text-zinc-500">Loading sanctuary…</p>
          ) : (data?.projects.length ?? 0) === 0 ? (
            <EmptyChamber tone="bronze" title="No projects yet" description="Register your first repository to make BertOS your daily coding OS." />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data?.projects.map(item => (
                <button
                  key={item.projectId}
                  onClick={() => activate(item)}
                  disabled={busy === item.projectId}
                  className={`rounded-lg border p-3 text-left transition ${item.projectId === projectId ? 'border-amber-500/40 bg-amber-500/5' : 'border-zinc-800 hover:border-amber-500/25'}`}
                >
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="h-4 w-4 text-amber-300" />
                    <span className="flex-1 truncate text-sm font-semibold text-zinc-100">{item.name}</span>
                    {item.projectId === projectId && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />}
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-zinc-600">{item.repoPath}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge variant={statusBadge(item.status)}>{item.status}</Badge>
                    {item.tags.slice(0, 2).map(tag => <Badge key={tag} variant="default">{tag}</Badge>)}
                  </div>
                </button>
              ))}
            </div>
          )}
          {health?.warnings.length ? (
            <div className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-2 text-xs text-amber-300">{health.warnings.join(' · ')}</div>
          ) : null}
        </ChamberCard>

        {!project ? (
          <div className="space-y-4">
            <AICommandCenter onActivity={load} />
            <ReadinessCard />
          </div>
        ) : (
          <div className="space-y-4">
            {/* ── AI Command Center — the main interface ── */}
            <AICommandCenter projectId={project.projectId} projectName={project.name} onActivity={load} />

            {/* ── Command Altar + Constellation ── */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChamberCard tone="amber" eyebrow="command altar" title="Command Altar" description="Launch local, deterministic workflows and run safe validation. No LLM is used unless a provider is configured.">
                <div className="mb-2 flex gap-2">
                  <input value={featureRequest} onChange={e => setFeatureRequest(e.target.value)} placeholder="Feature request for 'Plan feature'…" className="h-8 flex-1 rounded-md border border-zinc-800 bg-black/40 px-3 text-xs text-zinc-100 outline-none focus:border-amber-500/40" />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {workflows.map(workflow => (
                    <Button key={workflow.id} size="sm" variant="secondary" disabled={busy === workflow.id} onClick={() => runWorkflow(workflow.id)} className="justify-start">
                      <Wand2 className="h-3.5 w-3.5" /> <span className="truncate">{workflow.label}</span>
                    </Button>
                  ))}
                </div>
                <div className="mt-3 border-t border-zinc-800 pt-3">
                  <div className="flex gap-2">
                    <Button size="sm" disabled={busy === 'validate'} onClick={runValidation}><FlaskConical className="h-3.5 w-3.5" /> Run validation</Button>
                    <div className="flex flex-1 items-center gap-2 rounded-md border border-zinc-800 bg-black/30 px-2">
                      <Terminal className="h-3.5 w-3.5 text-zinc-600" />
                      <input value={commandInput} onChange={e => setCommandInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void runCommand() }} placeholder="run allowlisted command…" className="h-8 flex-1 bg-transparent text-xs text-zinc-200 outline-none" />
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-600">Validation runs this project&apos;s commands: {project.validationCommands.join(', ') || '—'}</p>
                </div>
              </ChamberCard>

              <ChamberCard tone="cyan" eyebrow="constellation map" title="Constellation Map" description="Read-only git snapshot and project structure." status={data?.git ? (data.git.clean ? 'nominal' : 'warning') : 'idle'}>
                {data?.git ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default"><GitBranch className="mr-1 inline h-3 w-3" />{data.git.branch}</Badge>
                      <Badge variant={data.git.clean ? 'success' : 'warning'}>{data.git.clean ? 'clean' : `${data.git.changedFiles.length + data.git.untrackedFiles.length} dirty`}</Badge>
                      {data.git.ahead > 0 && <Badge variant="default">↑{data.git.ahead}</Badge>}
                      {data.git.behind > 0 && <Badge variant="default">↓{data.git.behind}</Badge>}
                    </div>
                    {!data.git.clean && (
                      <div className="max-h-28 overflow-auto rounded-md border border-zinc-800 bg-black/30 p-2 font-mono text-[11px] text-zinc-400">
                        {[...data.git.changedFiles.map(f => `M ${f}`), ...data.git.untrackedFiles.map(f => `? ${f}`)].slice(0, 30).map(line => <div key={line} className="truncate">{line}</div>)}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">{health?.isGitRepo ? 'Git status unavailable.' : 'This project path is not a git repository.'}</p>
                )}
                {data?.structure && (
                  <div className="mt-3 border-t border-zinc-800 pt-2">
                    <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/60"><Boxes className="h-3 w-3" /> Stack</div>
                    <div className="flex flex-wrap gap-1">
                      {(data.structure.techStack.length ? data.structure.techStack : ['none detected']).map(tech => <Badge key={tech} variant="default">{tech}</Badge>)}
                    </div>
                    {data.structure.importantFiles.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {data.structure.importantFiles.slice(0, 6).map(file => <span key={file} className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">{file}</span>)}
                      </div>
                    )}
                  </div>
                )}
              </ChamberCard>
            </div>

            {/* ── File Explorer ── */}
            <FileTree projectId={project.projectId} />

            {/* ── Patch Forge ── */}
            <PatchForge projectId={project.projectId} patches={data?.patches ?? []} onRefresh={load} onNotice={flash} />

            {/* ── Guardian Gates + Task Phalanx ── */}
            <div className="grid gap-4 lg:grid-cols-2">
              <GuardianGates approvals={data?.approvals ?? []} onRefresh={load} onNotice={flash} />
              <TaskPhalanx projectId={project.projectId} tasks={data?.tasks ?? []} onRefresh={load} onNotice={flash} />
            </div>

            {/* ── Memory Chapel + Recent Runs ── */}
            <div className="grid gap-4 lg:grid-cols-2">
              <MemoryChapel onActivity={load} />
              <RecentRuns refreshKey={data?.commands?.length ?? 0} />
            </div>

            {/* ── Decision Ledger + Oracle Search ── */}
            <div className="grid gap-4 lg:grid-cols-2">
              <DecisionLedger projectId={project.projectId} decisions={data?.decisions ?? []} onRefresh={load} onNotice={flash} />
              <OracleSearch projectId={project.projectId} />
            </div>

            {/* ── Public Readiness ── */}
            <ReadinessCard />

            {/* ── Celestial Ledger: recent commands/validation output ── */}
            <ChamberCard tone="zinc" eyebrow="celestial ledger" title="Command & Validation Ledger" description="Recent command output and validation history for this project." action={<Button size="sm" variant="ghost" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>}>
              {(data?.commands?.length ?? 0) === 0 && (data?.validation?.length ?? 0) === 0 ? (
                <EmptyChamber tone="zinc" title="No runs yet" description="Run validation or a command from the Command Altar." />
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500"><Activity className="h-3 w-3" /> Commands</div>
                    <div className="space-y-1.5">
                      {(data?.commands ?? []).slice(0, 6).map(run => (
                        <details key={run.commandRunId} className="rounded-md border border-zinc-800 bg-black/20">
                          <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-300">
                            <Badge variant={statusBadge(run.status)}>{run.status}</Badge>
                            <span className="flex-1 truncate font-mono">{run.command}</span>
                            {run.exitCode !== undefined && <span className="text-zinc-600">exit {run.exitCode}</span>}
                          </summary>
                          <pre className="max-h-44 overflow-auto border-t border-zinc-800 p-2 font-mono text-[11px] leading-relaxed text-zinc-400">{run.blockedReason || run.stdoutPreview || run.stderrPreview || '(no output)'}</pre>
                        </details>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500"><FlaskConical className="h-3 w-3" /> Validation</div>
                    <div className="space-y-1.5">
                      {(data?.validation ?? []).slice(0, 6).map(report => (
                        <div key={report.validationReportId} className="rounded-md border border-zinc-800 bg-black/20 px-2.5 py-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <Badge variant={statusBadge(report.status)}>{report.status}</Badge>
                            <span className="flex-1 truncate text-zinc-300">{report.summary}</span>
                          </div>
                          {report.failures.length > 0 && <ul className="mt-1 space-y-0.5 text-[11px] text-red-300/80">{report.failures.slice(0, 3).map(f => <li key={f} className="truncate">• {f}</li>)}</ul>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-800 pt-3 text-xs">
                <a href="/outputs" className="rounded-md border border-zinc-800 px-2.5 py-1 text-zinc-400 transition hover:border-cyan-500/30 hover:text-cyan-200"><Sparkles className="mr-1 inline h-3 w-3" />Artifact Vault →</a>
                <a href="/runs" className="rounded-md border border-zinc-800 px-2.5 py-1 text-zinc-400 transition hover:border-cyan-500/30 hover:text-cyan-200"><Activity className="mr-1 inline h-3 w-3" />Run Ledger →</a>
                <a href="/approvals" className="rounded-md border border-zinc-800 px-2.5 py-1 text-zinc-400 transition hover:border-cyan-500/30 hover:text-cyan-200">Guardian Gates →</a>
                <a href="/memory-review" className="rounded-md border border-zinc-800 px-2.5 py-1 text-zinc-400 transition hover:border-cyan-500/30 hover:text-cyan-200">Memory Chapel →</a>
              </div>
            </ChamberCard>
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
