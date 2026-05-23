'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  FlaskConical,
  GitCommit,
  Loader2,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/bertos/cn'
import type { AIModel } from '@/lib/bertos/types'
import { EmptyChamber, LoadingRelay, RouteHero } from '@/components/bertos/hermes'

type EvolutionCategory = 'bug' | 'feature' | 'ui' | 'code-quality' | 'automation' | 'safety'
type RecurringMode = 'suggestOnOpen' | 'dailyPlan' | 'backgroundScan'

interface EvolutionItem {
  id: string
  title: string
  category: EvolutionCategory
  description: string
  evidence: string[]
  impact: number
  risk: number
  difficulty: number
  score: number
  recommendedProvider: AIModel
  nextAction: string
  patchPrompt: string
}

interface EvolutionScan {
  ok: boolean
  scannedAt: string
  summary: string
  repo?: {
    root: string
    branch: string
    remote: string
    status: string
    safeRepo: boolean
    blockedReason?: string
  }
  providers?: {
    ollama: { online: boolean; provider: string; mode: string; model: string }
    localDaemon: {
      online: boolean
      safeRepo: boolean
      tools: Array<{ id: string; label: string; installed: boolean; version?: string; resolvedPath?: string; loginStatus?: string; error?: string }>
    }
    composio: { configured: boolean; reachable: boolean; error?: string }
  }
  backlog: EvolutionItem[]
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

interface TerminalEntry {
  id: string
  label: string
  stdout: string
  stderr?: string
  error?: string
  exitCode?: number | null
  timestamp: number
  running?: boolean
}

const SETTINGS_KEY = 'bertos-evolution-lab-settings-v1'
const SCAN_KEY = 'bertos-evolution-lab-last-scan-v1'

const CATEGORY_VARIANTS: Record<EvolutionCategory, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  bug: 'error',
  feature: 'info',
  ui: 'default',
  'code-quality': 'warning',
  automation: 'success',
  safety: 'warning',
}

function scoreTone(score: number) {
  if (score >= 14) return 'text-emerald-300'
  if (score >= 10) return 'text-amber-300'
  return 'text-zinc-400'
}

function simpleDiff(before = '', after = '') {
  const oldLines = before.split(/\r?\n/)
  const newLines = after.split(/\r?\n/)
  let prefix = 0
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) prefix += 1
  let oldSuffix = oldLines.length - 1
  let newSuffix = newLines.length - 1
  while (oldSuffix >= prefix && newSuffix >= prefix && oldLines[oldSuffix] === newLines[newSuffix]) {
    oldSuffix -= 1
    newSuffix -= 1
  }
  return {
    startLine: prefix + 1,
    before: oldLines.slice(prefix, oldSuffix + 1),
    after: newLines.slice(prefix, newSuffix + 1),
  }
}

function DiffBlock({ file }: { file: PatchFile }) {
  const diff = simpleDiff(file.before ?? '', file.after ?? '')
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-2 font-mono text-[11px] text-zinc-500">
        {file.operation} {file.path} from line {diff.startLine}
      </div>
      <div className="max-h-56 overflow-auto font-mono text-[11px] leading-5">
        {diff.before.length === 0 && diff.after.length === 0 ? (
          <div className="px-3 py-2 text-zinc-600">No textual diff detected.</div>
        ) : null}
        {diff.before.slice(0, 100).map((line, index) => (
          <div key={`old-${index}`} className="bg-red-500/10 px-3 text-red-200">
            <span className="mr-2 text-red-500">-</span>{line || ' '}
          </div>
        ))}
        {diff.after.slice(0, 100).map((line, index) => (
          <div key={`new-${index}`} className="bg-emerald-500/10 px-3 text-emerald-200">
            <span className="mr-2 text-emerald-500">+</span>{line || ' '}
          </div>
        ))}
      </div>
    </div>
  )
}

export function EvolutionLabView() {
  const [scan, setScan] = useState<EvolutionScan | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [proposal, setProposal] = useState<PatchProposal | null>(null)
  const [proposalProvider, setProposalProvider] = useState<Record<string, unknown> | null>(null)
  const [selectedPatchFiles, setSelectedPatchFiles] = useState<Set<string>>(new Set())
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([])
  const [commitMessage, setCommitMessage] = useState('')
  const [recurring, setRecurring] = useState<Record<RecurringMode, boolean>>({
    suggestOnOpen: false,
    dailyPlan: false,
    backgroundScan: false,
  })

  const selectedItem = useMemo(
    () => scan?.backlog.find(item => item.id === selectedId) ?? scan?.backlog[0],
    [scan, selectedId],
  )
  const safe = Boolean(scan?.providers?.localDaemon.online && scan.repo?.safeRepo)

  const appendTerminal = (entry: TerminalEntry) => {
    setTerminalEntries(current => [...current, entry].slice(-20))
  }

  const runCommand = async (label: string, executable: string, args: string[], timeoutMs = 180000) => {
    const id = `${Date.now()}-${label}`
    appendTerminal({ id, label, stdout: 'Running...', timestamp: Date.now(), running: true })
    const res = await fetch('/api/local-daemon/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ executable, args, timeoutMs }),
    })
    const data = await res.json()
    setTerminalEntries(current => current.map(entry => entry.id === id ? {
      ...entry,
      stdout: data.stdout ?? '',
      stderr: data.stderr,
      error: data.error,
      exitCode: data.exitCode,
      running: false,
    } : entry))
    return data
  }

  const scanBertos = async (quiet = false) => {
    setScanning(true)
    try {
      const res = await fetch('/api/evolution/scan', { cache: 'no-store' })
      const data = await res.json() as EvolutionScan
      if (!res.ok || !data.ok) throw new Error('Evolution scan failed.')
      setScan(data)
      setSelectedId(current => current || data.backlog[0]?.id || '')
      localStorage.setItem(SCAN_KEY, JSON.stringify({ date: new Date().toISOString(), scan: data }))
      if (!quiet) toast.success(`Scan found ${data.backlog.length} improvement opportunities.`)
    } catch (error) {
      if (!quiet) toast.error(error instanceof Error ? error.message : 'Evolution scan failed.')
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    const rawSettings = localStorage.getItem(SETTINGS_KEY)
    if (rawSettings) {
      try {
        const parsed = JSON.parse(rawSettings) as Partial<Record<RecurringMode, boolean>>
        setRecurring(current => ({ ...current, ...parsed }))
      } catch {
        localStorage.removeItem(SETTINGS_KEY)
      }
    }
    const rawScan = localStorage.getItem(SCAN_KEY)
    if (rawScan) {
      try {
        const parsed = JSON.parse(rawScan) as { date?: string; scan?: EvolutionScan }
        if (parsed.scan) {
          setScan(parsed.scan)
          setSelectedId(parsed.scan.backlog[0]?.id || '')
        }
      } catch {
        localStorage.removeItem(SCAN_KEY)
      }
    }
  }, [])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const rawScan = localStorage.getItem(SCAN_KEY)
    let lastDay = ''
    if (rawScan) {
      try {
        lastDay = String((JSON.parse(rawScan) as { date?: string }).date ?? '').slice(0, 10)
      } catch {
        lastDay = ''
      }
    }
    if (recurring.suggestOnOpen || recurring.backgroundScan || (recurring.dailyPlan && lastDay !== today)) {
      void scanBertos(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurring.suggestOnOpen, recurring.backgroundScan, recurring.dailyPlan])

  const toggleRecurring = (mode: RecurringMode) => {
    setRecurring(current => {
      const next = { ...current, [mode]: !current[mode] }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  }

  const generateNextImprovement = async () => {
    if (!selectedItem) return toast.error('Run a scan and select an improvement first.')
    if (!safe) return toast.error('Evolution changes require daemon online and safe bertos-ai-os repo.')
    setGenerating(true)
    setProposal(null)
    setProposalProvider(null)
    try {
      const res = await fetch('/api/workspace/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: selectedItem.patchPrompt,
          provider: selectedItem.recommendedProvider,
          context: {
            repo: scan?.repo,
            gitStatus: scan?.repo?.status,
            memories: [
              'Never touch Sylistly.',
              'BertOS Evolution Lab can scan and propose patches, but all writes require approval.',
              'Never auto-push.',
              'Require local daemon and safe repo before changes.',
            ],
          },
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok || !data.proposal) throw new Error(data.error || 'Patch generation failed.')
      setProposal(data.proposal)
      setProposalProvider(data.provider ?? null)
      setSelectedPatchFiles(new Set(data.proposal.files.filter((file: PatchFile) => file.operation !== 'delete').map((file: PatchFile) => file.path)))
      toast.success('Improvement patch proposed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Patch generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const applyPatch = async () => {
    if (!proposal || selectedPatchFiles.size === 0) return
    if (!safe) return toast.error('Daemon + safe repo are required before applying.')
    setApplying(true)
    try {
      for (const file of proposal.files) {
        if (!selectedPatchFiles.has(file.path)) continue
        if (file.operation === 'delete') {
          toast.error(`Delete blocked for ${file.path}.`)
          continue
        }
        const res = await fetch('/api/local-daemon/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: file.path, content: file.after ?? '' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `Could not write ${file.path}`)
      }
      toast.success('Patch applied. Running typecheck/build.')
      await runCommand('npm run typecheck', 'npm', ['run', 'typecheck'], 180000)
      await runCommand('npm run build', 'npm', ['run', 'build'], 240000)
      await scanBertos(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Patch apply failed.')
    } finally {
      setApplying(false)
    }
  }

  const generateCommitMessage = async () => {
    const diff = await runCommand('git diff', 'git', ['diff'], 60000)
    const res = await fetch('/api/workspace/commit-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diff: diff.stdout, status: scan?.repo?.status }),
    })
    const data = await res.json()
    if (!res.ok || !data.ok) return toast.error(data.error || 'Could not draft commit message.')
    setCommitMessage(data.message)
    toast.success('Commit message drafted.')
  }

  const commitChanges = async () => {
    if (!commitMessage.trim()) return toast.error('Draft or enter a commit message first.')
    if (!safe || scan?.repo?.remote.toLowerCase().includes('sylistly')) return toast.error('Git actions blocked by repo safety.')
    if (!window.confirm('Create a local commit from current changes? This will not push.')) return
    await runCommand('git add -A', 'git', ['add', '-A'], 60000)
    await runCommand(`git commit -m "${commitMessage}"`, 'git', ['commit', '-m', commitMessage], 120000)
    await scanBertos(true)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-cyan-300/10 px-6 py-4">
          <RouteHero
            eyebrow="experimental weapons lab"
            title="Evolution Lab"
            subtitle="Feature candidates move through scan, risk review, patch proposal, validation, and promotion from experiment to skill to production feature. Nothing applies without an explicit approval gate."
            status={scanning || generating ? 'active' : safe ? 'nominal' : 'warning'}
            seal={<FlaskConical className="h-5 w-5" />}
            metrics={[
              { label: 'Experiments', value: scan?.backlog.length ?? 0, detail: 'ranked feature candidates', tone: 'cyan' },
              { label: 'Risk Level', value: selectedItem ? `${selectedItem.risk}/10` : 'unselected', detail: selectedItem?.title ?? 'choose a candidate', tone: selectedItem && selectedItem.risk > 6 ? 'amber' : 'bronze' },
              { label: 'Model Agent', value: selectedItem?.recommendedProvider ?? 'awaiting scan', detail: 'recommended executor', tone: 'emerald' },
              { label: 'Promotion Path', value: 'experiment -> skill -> production', detail: safe ? 'repo verified' : 'read-only until safe', tone: safe ? 'cyan' : 'amber' },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10">
              <FlaskConical className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-zinc-100">Evolution Lab</h1>
              <p className="text-xs text-zinc-500">Continuous improvement backlog, patch proposals, and approval-gated self-coding.</p>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => scanBertos(false)} disabled={scanning}>
                {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Scan BertOS
              </Button>
              <Button size="sm" onClick={generateNextImprovement} disabled={generating || !selectedItem || !safe}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate next improvement
              </Button>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[410px_1fr]">
          <aside className="min-h-0 border-r border-zinc-800/50 bg-zinc-950/50">
            <ScrollArea className="h-full">
              <div className="space-y-4 p-4">
                <div className={cn(
                  'rounded-xl border p-3',
                  safe ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'
                )}>
                  <div className="flex items-center gap-2">
                    {safe ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <AlertTriangle className="h-4 w-4 text-amber-300" />}
                    <span className="text-sm font-medium text-zinc-200">{safe ? 'Safe to propose/apply' : 'Read-only until daemon/repo safe'}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    {scan?.repo?.root ?? 'Run a scan to verify the local daemon and repo.'}
                  </p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-300" />
                    <h2 className="text-sm font-semibold text-zinc-200">Recurring mode</h2>
                  </div>
                  {([
                    ['suggestOnOpen', 'Suggest improvements every time app opens'],
                    ['dailyPlan', 'Daily improvement plan'],
                    ['backgroundScan', 'Background scan only'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 py-1.5 text-xs text-zinc-400">
                      <input type="checkbox" checked={recurring[key]} onChange={() => toggleRecurring(key)} />
                      {label}
                    </label>
                  ))}
                  <p className="mt-2 text-[11px] text-zinc-600">These modes only scan and suggest. They never write files without approval.</p>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-zinc-200">Improvement backlog</h2>
                    <Badge variant="default" className="text-[10px]">{scan?.backlog.length ?? 0}</Badge>
                  </div>
                  {scan?.summary && <p className="mb-3 text-xs leading-relaxed text-zinc-500">{scan.summary}</p>}
                  <div className="space-y-2">
                    {scan?.backlog.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          'w-full rounded-xl border p-3 text-left transition-colors',
                          selectedItem?.id === item.id
                            ? 'border-violet-500/40 bg-violet-500/10'
                            : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                        )}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant={CATEGORY_VARIANTS[item.category]} className="text-[9px]">{item.category}</Badge>
                          <span className={cn('ml-auto font-mono text-xs', scoreTone(item.score))}>score {item.score}</span>
                        </div>
                        <p className="text-sm font-medium text-zinc-200">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{item.description}</p>
                      </button>
                    )) ?? (
                      scanning
                        ? <LoadingRelay label="Evolution Scan Running" detail="Inspecting repo signals and provider readiness." compact />
                        : <EmptyChamber icon={<FlaskConical className="h-6 w-6" />} title="Lab Backlog Dormant" description="Run a scan to build the first improvement backlog." />
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </aside>

          <main className="min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-4 p-4">
                {selectedItem && (
                  <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Wrench className="h-4 w-4 text-violet-300" />
                      <h2 className="text-sm font-semibold text-zinc-100">{selectedItem.title}</h2>
                      <Badge variant={CATEGORY_VARIANTS[selectedItem.category]} className="text-[10px]">{selectedItem.category}</Badge>
                      <Badge variant="default" className="text-[10px]">provider: {selectedItem.recommendedProvider}</Badge>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-400">{selectedItem.description}</p>
                    <div className="mt-4 grid gap-2 md:grid-cols-4">
                      {[
                        ['impact', selectedItem.impact],
                        ['risk', selectedItem.risk],
                        ['difficulty', selectedItem.difficulty],
                        ['priority', selectedItem.score],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-600">{label}</div>
                          <div className="mt-1 font-mono text-lg text-zinc-200">{value}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                      <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-600">Evidence</div>
                      <ul className="space-y-1 text-xs text-zinc-500">
                        {selectedItem.evidence.map(line => <li key={line}>- {line}</li>)}
                      </ul>
                    </div>
                    <p className="mt-3 text-xs text-zinc-500">Next action: {selectedItem.nextAction}</p>
                  </section>
                )}

                {proposal && (
                  <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Bot className="h-4 w-4 text-emerald-300" />
                      <h2 className="text-sm font-semibold text-zinc-100">Proposed patch</h2>
                      <Badge variant={proposal.riskLevel === 'high' ? 'error' : proposal.riskLevel === 'medium' ? 'warning' : 'success'} className="text-[10px]">
                        {proposal.riskLevel} risk
                      </Badge>
                      {proposalProvider && <span className="text-[11px] text-zinc-600">{String(proposalProvider.providerName ?? proposalProvider.providerId ?? 'provider')}</span>}
                    </div>
                    <p className="mb-4 text-sm text-zinc-400">{proposal.summary}</p>
                    <div className="space-y-4">
                      {proposal.files.length === 0 ? (
                        <div className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-500">No files proposed. The model may need a more specific improvement.</div>
                      ) : proposal.files.map(file => (
                        <div key={file.path} className="space-y-2">
                          <label className="flex items-center gap-2 text-xs text-zinc-300">
                            <input
                              type="checkbox"
                              checked={selectedPatchFiles.has(file.path)}
                              disabled={file.operation === 'delete'}
                              onChange={event => {
                                setSelectedPatchFiles(current => {
                                  const next = new Set(current)
                                  if (event.target.checked) next.add(file.path)
                                  else next.delete(file.path)
                                  return next
                                })
                              }}
                            />
                            {file.path}
                            <Badge variant="default" className="text-[10px]">{file.operation}</Badge>
                          </label>
                          <DiffBlock file={file} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" onClick={applyPatch} disabled={applying || selectedPatchFiles.size === 0 || !safe}>
                        {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Approve/apply selected + run checks
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setProposal(null)}>Reject patch</Button>
                    </div>
                  </section>
                )}

                <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-zinc-500" />
                    <h2 className="text-sm font-semibold text-zinc-100">Evolution run log</h2>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setTerminalEntries([])}>Clear</Button>
                  </div>
                  <div className="space-y-2">
                    {terminalEntries.length === 0 ? (
                      <p className="text-xs text-zinc-600">Typecheck/build output appears here after you approve a patch.</p>
                    ) : terminalEntries.map(entry => (
                      <div key={entry.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 font-mono text-xs">
                        <div className="mb-2 flex items-center gap-2 text-zinc-500">
                          {entry.running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Terminal className="h-3 w-3" />}
                          <span>$ {entry.label}</span>
                          {entry.exitCode !== undefined && <Badge variant={entry.exitCode === 0 ? 'success' : 'error'} className="ml-auto text-[10px]">exit {entry.exitCode}</Badge>}
                        </div>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-zinc-400">{entry.stdout}</pre>
                        {entry.stderr && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-amber-300">{entry.stderr}</pre>}
                        {entry.error && <pre className="mt-2 whitespace-pre-wrap text-red-300">{entry.error}</pre>}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <GitCommit className="h-4 w-4 text-emerald-300" />
                    <h2 className="text-sm font-semibold text-zinc-100">Commit helper</h2>
                    <Badge variant="warning" className="text-[10px]">never pushes</Badge>
                  </div>
                  <textarea
                    value={commitMessage}
                    onChange={event => setCommitMessage(event.target.value)}
                    placeholder="Commit message"
                    className="min-h-20 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-700"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={generateCommitMessage}>
                      <Clipboard className="h-3.5 w-3.5" /> Draft from diff
                    </Button>
                    <Button size="sm" variant="secondary" onClick={commitChanges} disabled={!commitMessage.trim() || !safe}>
                      Commit locally
                    </Button>
                  </div>
                </section>
              </div>
            </ScrollArea>
          </main>
        </div>
      </section>
    </div>
  )
}
