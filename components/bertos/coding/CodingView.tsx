'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  Code2,
  Copy,
  GitBranch,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CODING_MISSION_TEMPLATES,
  compileCodingMission,
  providerToAIModel,
  type CodingMission,
} from '@/lib/bertos/missions'
import type { AIModel } from '@/lib/bertos/types'

interface RepoStatus {
  online?: boolean
  repo?: {
    root: string
    branch: string
    remote: string
    status: string
    safeRepo: boolean
    blockedReason?: string
  }
  error?: string
}

interface PatchFile {
  path: string
  operation: 'modify' | 'create' | 'delete'
  before?: string
  after?: string
}

interface PatchProposal {
  summary: string
  provider?: string
  files: PatchFile[]
  commandsToRun: string[]
  riskLevel: 'low' | 'medium' | 'high'
}

interface PatchResponse {
  ok: boolean
  proposal?: PatchProposal
  provider?: {
    providerId?: string
    providerName?: string
    modelOrTool?: string
    source?: string
    latencyMs?: number
    fallbackUsed?: string
  }
  error?: string
  debug?: {
    serialization?: {
      promptChars: number
      includedFileCount: number
      includedFilePaths: string[]
      serializedContextPreview: string
      serializedPayloadPreview: string
      fileBodiesPresent: boolean
      truncationWarnings: string[]
    }
    parseError?: string
  }
  routeDebug?: {
    selectedProvider?: string
    routerMode?: string
    taskType?: string
    inventoryShortcutUsed?: boolean
  }
}

interface CommandResult {
  ok?: boolean
  stdout?: string
  stderr?: string
  exitCode?: number | null
  durationMs?: number
  error?: string
}

const DEFAULT_PROMPT = `Add a focused improvement to BertOS.

Goal:
- Describe the exact app, workflow, bug, or feature here.

Constraints:
- Keep the patch focused.
- Preserve daemon, provider routing, Workspace, Evolution Lab, and chat.
- Never touch Sylistly.
- Validate before commit.`

const VALIDATION_COMMANDS = new Map<string, { executable: string; args: string[]; timeoutMs?: number }>([
  ['npm run typecheck', { executable: 'npm', args: ['run', 'typecheck'], timeoutMs: 180000 }],
  ['npm run build', { executable: 'npm', args: ['run', 'build'], timeoutMs: 240000 }],
  ['npm run bertos:safety', { executable: 'npm', args: ['run', 'bertos:safety'], timeoutMs: 120000 }],
  ['npm run smoke', { executable: 'npm', args: ['run', 'smoke'], timeoutMs: 180000 }],
  ['npm run validate', { executable: 'npm', args: ['run', 'validate'], timeoutMs: 300000 }],
])

function normalizeCommand(command: string) {
  return command.trim().replace(/\s+/g, ' ')
}

function operationLabel(operation: PatchFile['operation']) {
  if (operation === 'create') return 'Created file'
  if (operation === 'delete') return 'Deleted file'
  return 'Modified file'
}

function badgeForRisk(risk: PatchProposal['riskLevel']) {
  if (risk === 'high') return 'error'
  if (risk === 'medium') return 'warning'
  return 'success'
}

export function CodingView() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [templateId, setTemplateId] = useState(CODING_MISSION_TEMPLATES[0]?.id ?? '')
  const [mission, setMission] = useState<CodingMission | null>(null)
  const [repoStatus, setRepoStatus] = useState<RepoStatus | null>(null)
  const [patchResponse, setPatchResponse] = useState<PatchResponse | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [buildingMission, setBuildingMission] = useState(false)
  const [runningMission, setRunningMission] = useState(false)
  const [applyingPatch, setApplyingPatch] = useState(false)
  const [runningChecks, setRunningChecks] = useState(false)
  const [commandResults, setCommandResults] = useState<Array<{ command: string; result: CommandResult }>>([])
  const [runLog, setRunLog] = useState<string[]>([])

  const template = useMemo(
    () => CODING_MISSION_TEMPLATES.find(item => item.id === templateId),
    [templateId],
  )
  const safe = Boolean(repoStatus?.repo?.safeRepo)
  const proposal = patchResponse?.proposal
  const safeValidationCommands = useMemo(() => {
    return (proposal?.commandsToRun ?? [])
      .map(normalizeCommand)
      .filter(command => VALIDATION_COMMANDS.has(command))
  }, [proposal])

  const refreshRepoStatus = async () => {
    try {
      const res = await fetch('/api/local-daemon/repo/status', { cache: 'no-store' })
      const data = await res.json() as RepoStatus
      setRepoStatus(data)
    } catch (error) {
      setRepoStatus({ online: false, error: error instanceof Error ? error.message : 'Could not reach local daemon.' })
    }
  }

  useEffect(() => {
    void refreshRepoStatus()
  }, [])

  const appendLog = (line: string) => {
    setRunLog(current => [`${new Date().toLocaleTimeString()} ${line}`, ...current].slice(0, 80))
  }

  const buildMission = () => {
    setBuildingMission(true)
    try {
      const compiled = compileCodingMission(prompt, template)
      setMission(compiled)
      setPatchResponse(null)
      setSelectedFiles(new Set())
      appendLog(`Mission compiled: ${compiled.title}`)
      if (compiled.warnings.length) toast.warning(compiled.warnings[0])
      else toast.success('Mission compiled.')
    } finally {
      setBuildingMission(false)
    }
  }

  const runMission = async () => {
    const compiled = mission ?? compileCodingMission(prompt, template)
    setMission(compiled)
    setRunningMission(true)
    setPatchResponse(null)
    setCommandResults([])
    appendLog(`Patch generation started with ${compiled.provider}.`)
    try {
      const provider = providerToAIModel(compiled.provider)
      const res = await fetch('/api/workspace/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: compiled.suggestedPrompt,
          provider: provider satisfies AIModel,
          context: {
            repo: repoStatus?.repo,
            gitStatus: repoStatus?.repo?.status,
            fileTree: compiled.likelyFiles,
            memories: [
              'BertOS is a standalone AI operating system.',
              'Never touch Sylistly.',
              'Use daemon-safe file and terminal operations only.',
            ],
          },
        }),
      })
      const data = await res.json() as PatchResponse
      setPatchResponse(data)
      if (!res.ok || !data.ok || !data.proposal) {
        appendLog(`Patch generation failed: ${data.error ?? `HTTP ${res.status}`}`)
        toast.error(data.error ?? 'Patch generation failed.')
        return
      }
      setSelectedFiles(new Set(data.proposal.files.map(file => file.path)))
      appendLog(`Patch proposed: ${data.proposal.files.length} file(s).`)
      toast.success(`Patch proposed by ${data.provider?.providerName ?? data.proposal.provider ?? 'provider'}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mission run failed.'
      appendLog(message)
      toast.error(message)
    } finally {
      setRunningMission(false)
    }
  }

  const applySelectedPatch = async () => {
    if (!proposal || selectedFiles.size === 0) return
    if (!safe) return toast.error('Patch apply requires a safe local daemon repo.')
    const files = proposal.files.filter(file => selectedFiles.has(file.path))
    if (files.some(file => file.operation === 'delete') && !window.confirm('This patch deletes files. Continue through the safe daemon delete endpoint?')) return
    setApplyingPatch(true)
    const patchHistoryId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      for (const file of files) {
        const body = file.operation === 'delete'
          ? {
              path: file.path,
              operation: 'delete',
              confirm: true,
              patchHistoryId,
              confirmPatchHistoryId: patchHistoryId,
            }
          : {
              path: file.path,
              operation: file.operation === 'create' ? 'create' : 'write',
              content: file.after ?? '',
            }
        const res = await fetch('/api/local-daemon/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `Could not apply ${file.path}.`)
        appendLog(`Applied ${file.operation}: ${file.path}`)
      }
      toast.success(`Applied ${files.length} file(s).`)
      await refreshRepoStatus()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Patch apply failed.'
      appendLog(message)
      toast.error(message)
    } finally {
      setApplyingPatch(false)
    }
  }

  const runChecks = async () => {
    if (!safe) return toast.error('Validation requires the local daemon.')
    if (!safeValidationCommands.length) return toast.message('No safe validation commands are available for this patch.')
    setRunningChecks(true)
    setCommandResults([])
    try {
      for (const command of safeValidationCommands) {
        const config = VALIDATION_COMMANDS.get(command)
        if (!config) continue
        appendLog(`Running ${command}`)
        const res = await fetch('/api/local-daemon/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        })
        const result = await res.json() as CommandResult
        setCommandResults(current => [...current, { command, result }])
        appendLog(`${command} finished with exit ${result.exitCode ?? (res.ok ? 0 : 1)}.`)
        if (!res.ok || result.ok === false || (typeof result.exitCode === 'number' && result.exitCode !== 0)) break
      }
    } finally {
      setRunningChecks(false)
    }
  }

  const copyMission = async () => {
    const compiled = mission ?? compileCodingMission(prompt, template)
    await navigator.clipboard.writeText(compiled.suggestedPrompt)
    toast.success('Mission prompt copied.')
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#09090B]">
      <aside className="hidden w-72 shrink-0 border-r border-zinc-800/50 bg-zinc-950/70 md:block">
        <div className="border-b border-zinc-800/50 p-4">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-violet-400" />
            <h1 className="text-sm font-semibold text-zinc-100">Coding</h1>
          </div>
          <p className="mt-1 text-xs text-zinc-600">Mission compiler for large build prompts.</p>
        </div>
        <ScrollArea className="h-[calc(100%-73px)]">
          <div className="space-y-4 p-3">
            <section>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-700">Templates</div>
              <div className="space-y-1">
                {CODING_MISSION_TEMPLATES.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setTemplateId(item.id)
                      setPrompt(current => current === DEFAULT_PROMPT ? item.seedPrompt : current)
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                      templateId === item.id
                        ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                        : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <div className="font-medium">{item.label}</div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] text-zinc-600">{item.description}</div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </aside>

      <main className="grid min-w-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex min-w-0 flex-col border-r border-zinc-800/50">
          <div className="flex items-center justify-between border-b border-zinc-800/50 p-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-zinc-100">Mission Builder 2.0</h2>
              </div>
              <p className="mt-1 text-xs text-zinc-600">Paste a rough build prompt. BertOS compiles it into a scoped, provider-routed mission.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={safe ? 'success' : 'warning'} className="text-[10px]">
                {safe ? 'repo safe' : 'daemon needed'}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => void refreshRepoStatus()}>
                <GitBranch className="h-3.5 w-3.5" />Refresh
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              <textarea
                value={prompt}
                onChange={event => setPrompt(event.target.value)}
                placeholder="Paste a huge Claude/Codex/Gemini-style build prompt..."
                className="min-h-72 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-violet-500/60"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={buildMission} disabled={buildingMission || !prompt.trim()}>
                  {buildingMission ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Build mission
                </Button>
                <Button variant="secondary" onClick={() => void runMission()} disabled={runningMission || !prompt.trim()}>
                  {runningMission ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Run mission
                </Button>
                <Button variant="outline" onClick={() => void copyMission()}>
                  <Copy className="h-4 w-4" />Copy mission
                </Button>
              </div>

              {mission && (
                <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-100">{mission.title}</h3>
                    <Badge variant={mission.risk === 'high' ? 'error' : mission.risk === 'medium' ? 'warning' : 'success'} className="text-[10px]">{mission.risk} risk</Badge>
                    <Badge variant="default" className="text-[10px]">{mission.estimatedScope}</Badge>
                    <Badge variant={mission.worktreeRecommended ? 'warning' : 'default'} className="text-[10px]">
                      {mission.worktreeRecommended ? 'worktree recommended' : 'main ok with review'}
                    </Badge>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-600">Provider</div>
                      <div className="text-sm text-zinc-200">{mission.provider}</div>
                      <p className="mt-1 text-xs text-zinc-500">{mission.providerReason}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-600">Validation</div>
                      <div className="flex flex-wrap gap-1">
                        {mission.validation.map(command => <Badge key={command} variant="default" className="text-[10px]">{command}</Badge>)}
                      </div>
                    </div>
                  </div>
                  {mission.warnings.length > 0 && (
                    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                      {mission.warnings.map(warning => <div key={warning}>• {warning}</div>)}
                    </div>
                  )}
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-600">Likely files</div>
                      <div className="space-y-1 text-xs text-zinc-500">
                        {mission.likelyFiles.length ? mission.likelyFiles.map(file => <div key={file} className="truncate font-mono">{file}</div>) : <div>Context search will locate files.</div>}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-600">Context queries</div>
                      <div className="flex flex-wrap gap-1">
                        {mission.contextQueries.slice(0, 18).map(term => <Badge key={term} variant="default" className="text-[10px]">{term}</Badge>)}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-zinc-100">Provider logs</h3>
                </div>
                <div className="max-h-48 overflow-auto rounded-lg border border-zinc-800 bg-black/40 p-3 font-mono text-[11px] text-zinc-500">
                  {runLog.length ? runLog.map(line => <div key={line}>{line}</div>) : <div>No mission activity yet.</div>}
                </div>
              </section>
            </div>
          </ScrollArea>
        </section>

        <aside className="min-h-0 overflow-hidden bg-zinc-950/60">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-sky-400" />
                  <h3 className="text-sm font-semibold text-zinc-100">Git state</h3>
                </div>
                <div className="space-y-1 text-xs text-zinc-500">
                  <div>Branch: <span className="text-zinc-300">{repoStatus?.repo?.branch ?? 'unknown'}</span></div>
                  <div>Remote: <span className="break-all text-zinc-300">{repoStatus?.repo?.remote ?? 'unknown'}</span></div>
                  <div>Root: <span className="break-all text-zinc-300">{repoStatus?.repo?.root ?? 'daemon offline'}</span></div>
                  {repoStatus?.repo?.blockedReason && <div className="text-red-300">{repoStatus.repo.blockedReason}</div>}
                </div>
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100">Patch proposal</h3>
                  {proposal && <Badge variant={badgeForRisk(proposal.riskLevel)} className="text-[10px]">{proposal.riskLevel}</Badge>}
                </div>
                {!patchResponse && <p className="text-xs text-zinc-600">Run a mission to generate a reviewable patch.</p>}
                {patchResponse?.error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    {patchResponse.error}
                    {patchResponse.debug?.parseError && <div className="mt-1 opacity-80">{patchResponse.debug.parseError}</div>}
                  </div>
                )}
                {proposal && (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed text-zinc-500">{proposal.summary}</p>
                    {patchResponse.provider && (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-[11px] text-zinc-500">
                        Provider: {patchResponse.provider.providerName ?? patchResponse.provider.providerId} · {patchResponse.provider.source ?? 'source'} · {patchResponse.provider.latencyMs ?? 0}ms
                      </div>
                    )}
                    {patchResponse.debug?.serialization && (
                      <details className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
                        <summary className="cursor-pointer text-[11px] text-zinc-400">Context payload debug</summary>
                        <div className="mt-2 space-y-1 text-[11px] text-zinc-500">
                          <div>Prompt chars: {patchResponse.debug.serialization.promptChars}</div>
                          <div>Included files: {patchResponse.debug.serialization.includedFileCount}</div>
                          <div>File bodies present: {patchResponse.debug.serialization.fileBodiesPresent ? 'yes' : 'no'}</div>
                          <div className="break-all">Paths: {patchResponse.debug.serialization.includedFilePaths.join(', ') || 'none'}</div>
                        </div>
                      </details>
                    )}
                    <div className="space-y-2">
                      {proposal.files.map(file => (
                        <label key={file.path} className="block rounded-lg border border-zinc-800 bg-zinc-900/30 p-2 text-xs">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedFiles.has(file.path)}
                              onChange={event => {
                                setSelectedFiles(current => {
                                  const next = new Set(current)
                                  if (event.target.checked) next.add(file.path)
                                  else next.delete(file.path)
                                  return next
                                })
                              }}
                            />
                            <span className="min-w-0 flex-1 truncate font-mono text-zinc-300">{file.path}</span>
                            <Badge variant={file.operation === 'delete' ? 'error' : file.operation === 'create' ? 'success' : 'default'} className="text-[10px]">
                              {operationLabel(file.operation)}
                            </Badge>
                          </div>
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black/40 p-2 text-[10px] text-zinc-500">
                            {(file.after ?? file.before ?? '').slice(0, 3000) || '(delete)'}
                          </pre>
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void applySelectedPatch()} disabled={applyingPatch || !safe || selectedFiles.size === 0}>
                        {applyingPatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Apply selected
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void runChecks()} disabled={runningChecks || !safeValidationCommands.length || !safe}>
                        {runningChecks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        Run checks
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clipboard className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-zinc-100">Validation checks</h3>
                </div>
                {safeValidationCommands.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {safeValidationCommands.map(command => <Badge key={command} variant="success" className="text-[10px]">{command}</Badge>)}
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-zinc-600">No safe checks are available yet.</p>
                )}
                <div className="space-y-2">
                  {commandResults.map(item => (
                    <div key={item.command} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-zinc-300">{item.command}</span>
                        <Badge variant={(item.result.exitCode ?? 0) === 0 && item.result.ok !== false ? 'success' : 'error'} className="text-[10px]">
                          exit {item.result.exitCode ?? (item.result.ok === false ? 1 : 0)}
                        </Badge>
                      </div>
                      {(item.result.stdout || item.result.stderr || item.result.error) && (
                        <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-[10px] text-zinc-500">
                          {item.result.error ?? item.result.stderr ?? item.result.stdout}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {mission?.worktreeRecommended && (
                <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100">
                  <div className="mb-1 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Worktree recommended
                  </div>
                  <p>Worktree execution is scaffolded in BertOS but not automatically enabled here. Use this mission as a plan first, then run implementation in an isolated worktree when available.</p>
                </section>
              )}
            </div>
          </ScrollArea>
        </aside>
      </main>
    </div>
  )
}
