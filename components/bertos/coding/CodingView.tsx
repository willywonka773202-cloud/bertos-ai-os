'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronRight, Clipboard,
  Code2, FileText, GitCommit, Info, Loader2, Play, RefreshCw,
  Sparkles, Terminal, Zap, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/bertos/cn'
import type { Mission } from '@/lib/bertos/mission-builder'
import type { AIModel } from '@/lib/bertos/types'

const TEMPLATES = [
  { label: 'Fix a bug',           prompt: 'Fix the bug where ' },
  { label: 'Add a feature',       prompt: 'Add a feature that ' },
  { label: 'UI polish',           prompt: 'Improve the UI of ' },
  { label: 'Refactor safely',     prompt: 'Refactor the ' },
  { label: 'Add tests',           prompt: 'Add unit tests for ' },
  { label: 'Diagnose build fail', prompt: 'The build is failing because ' },
  { label: 'Improve BertOS',      prompt: 'Improve BertOS by ' },
  { label: 'Clean dead code',     prompt: 'Remove dead code from ' },
  { label: 'Create new feature',  prompt: 'Create a new ' },
  { label: 'Create landing page', prompt: 'Build a landing page for ' },
  { label: 'Create automation',   prompt: 'Automate the process of ' },
  { label: 'Create AI tool',      prompt: 'Build an AI tool that ' },
  { label: 'Debug failing tests', prompt: 'Debug why the tests are failing: ' },
]

const MISSION_HISTORY_KEY = 'bertos-coding-history-v1'
const PREFILL_KEY = 'bertos-coding-prefill-v1'

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

interface ProviderMeta {
  providerId?: string
  providerName?: string
  modelOrTool?: string
  source?: string
  fallbackUsed?: string
  latencyMs?: number
}

interface ContextDebug {
  includedFiles: number
  omittedFiles: number
  totalChars: number
  includedPaths: string[]
  truncationWarnings: string[]
  promptSize: number
}

interface TerminalEntry {
  id: string
  label: string
  stdout: string
  stderr?: string
  error?: string
  exitCode?: number | null
  running?: boolean
}

interface SavedMission {
  id: string
  title: string
  goal: string
  savedAt: number
}

function simpleDiff(before = '', after = '') {
  const a = before.split(/\r?\n/)
  const b = after.split(/\r?\n/)
  let s = 0
  while (s < a.length && s < b.length && a[s] === b[s]) s++
  let ae = a.length - 1, be = b.length - 1
  while (ae >= s && be >= s && a[ae] === b[be]) { ae--; be-- }
  return { before: a.slice(s, ae + 1), after: b.slice(s, be + 1), startLine: s + 1 }
}

function DiffBlock({ file }: { file: PatchFile }) {
  const d = simpleDiff(file.before ?? '', file.after ?? '')
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="border-b border-zinc-800 px-3 py-1.5 font-mono text-[10px] text-zinc-500">
        {file.operation} {file.path} from line {d.startLine}
      </div>
      <div className="max-h-48 overflow-auto font-mono text-[11px] leading-5">
        {d.before.length === 0 && d.after.length === 0 && (
          <div className="px-3 py-2 text-zinc-600">No textual diff.</div>
        )}
        {d.before.slice(0, 80).map((line, i) => (
          <div key={`o${i}`} className="bg-red-500/10 px-3 text-red-200"><span className="mr-2 text-red-500">-</span>{line || ' '}</div>
        ))}
        {d.after.slice(0, 80).map((line, i) => (
          <div key={`n${i}`} className="bg-emerald-500/10 px-3 text-emerald-200"><span className="mr-2 text-emerald-500">+</span>{line || ' '}</div>
        ))}
      </div>
    </div>
  )
}

export function CodingView() {
  const [prompt, setPrompt] = useState('')
  const [mission, setMission] = useState<Mission | null>(null)
  const [compilingMission, setCompilingMission] = useState(false)
  const [proposal, setProposal] = useState<PatchProposal | null>(null)
  const [proposalMeta, setProposalMeta] = useState<ProviderMeta | null>(null)
  const [ctxDebug, setCtxDebug] = useState<ContextDebug | null>(null)
  const [rawOutput, setRawOutput] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [selectedPatchFiles, setSelectedPatchFiles] = useState<Set<string>>(new Set())
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([])
  const [commitMessage, setCommitMessage] = useState('')
  const [missionOpen, setMissionOpen] = useState(true)
  const [debugOpen, setDebugOpen] = useState(false)
  const [history, setHistory] = useState<SavedMission[]>([])
  const promptRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MISSION_HISTORY_KEY)
      if (saved) setHistory(JSON.parse(saved) as SavedMission[])
    } catch { /* ignore */ }
    try {
      const prefill = localStorage.getItem(PREFILL_KEY)
      if (prefill) {
        setPrompt(prefill)
        localStorage.removeItem(PREFILL_KEY)
        promptRef.current?.focus()
      }
    } catch { /* ignore */ }
  }, [])

  const saveToHistory = useCallback((m: Mission) => {
    const entry: SavedMission = { id: `${Date.now()}`, title: m.title, goal: m.goal, savedAt: Date.now() }
    setHistory(prev => {
      const next = [entry, ...prev.filter(h => h.goal !== m.goal)].slice(0, 20)
      localStorage.setItem(MISSION_HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const appendTerminal = (entry: TerminalEntry) =>
    setTerminalEntries(prev => [...prev, entry].slice(-30))

  const runCommand = async (label: string, executable: string, args: string[]) => {
    const id = `${Date.now()}-${label}`
    appendTerminal({ id, label, stdout: 'Running...', running: true })
    const res = await fetch('/api/local-daemon/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ executable, args, timeoutMs: 180000 }),
    })
    const data = await res.json()
    setTerminalEntries(prev => prev.map(e => e.id === id ? {
      ...e, stdout: data.stdout ?? '', stderr: data.stderr, error: data.error,
      exitCode: data.exitCode, running: false,
    } : e))
    return data
  }

  const buildMission = async () => {
    if (!prompt.trim()) { toast.error('Enter a task first.'); return }
    setCompilingMission(true)
    setMission(null)
    setProposal(null)
    try {
      // Fetch file tree from daemon for better mission building
      let fileTree: string[] = []
      try {
        const fr = await fetch('/api/local-daemon/files')
        if (fr.ok) {
          const fd = await fr.json()
          fileTree = (fd.files ?? []).map((f: { path: string }) => f.path)
        }
      } catch { /* ignore */ }

      const res = await fetch('/api/workspace/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: prompt, fileTree }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Mission build failed.')
      setMission(data.mission as Mission)
      saveToHistory(data.mission as Mission)
      setMissionOpen(true)
      toast.success('Mission compiled.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mission build failed.')
    } finally {
      setCompilingMission(false)
    }
  }

  const runMission = async () => {
    if (!mission) { toast.error('Build a mission first.'); return }
    setGenerating(true)
    setProposal(null)
    setCtxDebug(null)
    setRawOutput('')
    try {
      // Fetch contents of likely files
      const includedFiles: Array<{ path: string; content: string }> = []
      for (const filePath of mission.likelyFiles.slice(0, 8)) {
        try {
          const r = await fetch(`/api/local-daemon/file?path=${encodeURIComponent(filePath)}`)
          if (r.ok) {
            const d = await r.json()
            if (typeof d.content === 'string' && d.content.length > 0) {
              includedFiles.push({ path: filePath, content: d.content })
            }
          }
        } catch { /* skip file */ }
      }

      const res = await fetch('/api/workspace/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: mission.goal,
          provider: mission.provider === 'team' ? 'auto' : (mission.provider as AIModel),
          context: {
            activeFile: includedFiles[0]?.path,
            activeContent: includedFiles[0]?.content,
            includedFiles,
            memories: [
              'Never touch Sylistly.',
              'BertOS is a standalone self-coding AI operating system.',
              'Never auto-push. All patches require approval.',
              ...mission.constraints,
            ],
          },
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.ok || !data.proposal) throw new Error(data.error || 'Mission run failed.')
      setProposal(data.proposal as PatchProposal)
      setProposalMeta(data.provider as ProviderMeta)
      setCtxDebug(data.contextDebug as ContextDebug)
      setRawOutput(typeof data.raw === 'string' ? data.raw : '')
      setSelectedPatchFiles(new Set(
        (data.proposal.files as PatchFile[])
          .filter(f => f.operation !== 'delete')
          .map(f => f.path)
      ))
      toast.success(`Patch proposed by ${(data.provider as ProviderMeta)?.providerName ?? 'provider'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mission run failed.')
    } finally {
      setGenerating(false)
    }
  }

  const applyPatch = async () => {
    if (!proposal || selectedPatchFiles.size === 0) return
    setApplying(true)
    try {
      for (const file of proposal.files) {
        if (!selectedPatchFiles.has(file.path)) continue
        if (file.operation === 'delete') { toast.error(`Delete blocked: ${file.path}`); continue }
        const r = await fetch('/api/local-daemon/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: file.path, content: file.after ?? '' }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || `Could not write ${file.path}`)
      }
      toast.success('Patch applied. Running checks.')
      await runCommand('npm run typecheck', 'npm', ['run', 'typecheck'])
      await runCommand('npm run build', 'npm', ['run', 'build'])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Apply failed.')
    } finally {
      setApplying(false)
    }
  }

  const generateCommitMessage = async () => {
    const diff = await runCommand('git diff', 'git', ['diff'])
    const res = await fetch('/api/workspace/commit-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diff: diff.stdout }),
    })
    const data = await res.json()
    if (data.ok && typeof data.message === 'string') {
      setCommitMessage(data.message)
      toast.success('Commit message drafted.')
    }
  }

  const riskColor = (risk: string) =>
    risk === 'high' ? 'error' : risk === 'medium' ? 'warning' : 'success'

  return (
    <div className="flex h-full overflow-hidden bg-[#09090B]">

      {/* Left: Templates + History */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-zinc-800/50 bg-zinc-950/60 flex-shrink-0">
        <div className="border-b border-zinc-800/50 px-3 py-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-semibold text-zinc-200">Coding</span>
            <Badge variant="info" className="ml-auto text-[9px]">Mission</Badge>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-700">Templates</p>
              <div className="space-y-0.5">
                {TEMPLATES.map(t => (
                  <button
                    key={t.label}
                    onClick={() => { setPrompt(t.prompt); promptRef.current?.focus() }}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-all"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {history.length > 0 && (
              <div>
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-700">Recent</p>
                <div className="space-y-0.5">
                  {history.slice(0, 10).map(h => (
                    <button
                      key={h.id}
                      onClick={() => setPrompt(h.goal)}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-all truncate"
                      title={h.goal}
                    >
                      {h.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Center: Prompt + Mission + Results */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-zinc-800/50 px-4 py-3 flex items-center gap-2 flex-shrink-0">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-zinc-200">Mission Builder</span>
          <span className="text-xs text-zinc-600">— paste a task, compile a mission, run it</span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4 max-w-3xl">

            {/* Prompt input */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950">
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Paste your coding task here. Be specific. e.g. &quot;Add a tooltip to the Save button in WorkspaceView.tsx that says Save current file&quot;"
                className="w-full min-h-32 resize-none bg-transparent p-4 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none leading-relaxed"
              />
              <div className="border-t border-zinc-800/50 flex items-center gap-2 px-3 py-2">
                <span className="text-[10px] text-zinc-700 flex-1">{prompt.length.toLocaleString()} chars</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => { setPrompt(''); setMission(null); setProposal(null) }}
                  disabled={!prompt && !mission && !proposal}
                >
                  <X className="w-3 h-3" /> Clear
                </Button>
                <Button size="sm" onClick={buildMission} disabled={compilingMission || !prompt.trim()}>
                  {compilingMission ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  Build Mission
                </Button>
              </div>
            </div>

            {/* Mission card */}
            {mission && (
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/5">
                <button
                  onClick={() => setMissionOpen(!missionOpen)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left"
                >
                  {missionOpen ? <ChevronDown className="w-4 h-4 text-violet-400" /> : <ChevronRight className="w-4 h-4 text-violet-400" />}
                  <span className="text-sm font-semibold text-zinc-100 flex-1 truncate">{mission.title}</span>
                  <Badge variant={riskColor(mission.risk) as 'error' | 'warning' | 'success'} className="text-[10px]">{mission.risk} risk</Badge>
                  <Badge variant="default" className="text-[10px]">mode: {mission.mode}</Badge>
                  <Badge variant="info" className="text-[10px]">provider: {mission.provider}</Badge>
                </button>

                {missionOpen && (
                  <div className="border-t border-violet-500/15 px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Scope</p>
                        <div className="flex flex-wrap gap-1">
                          {mission.scope.map(s => <Badge key={s} variant="default" className="text-[10px]">{s}</Badge>)}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Context searches</p>
                        <div className="flex flex-wrap gap-1">
                          {mission.contextQueries.map(q => <Badge key={q} variant="info" className="text-[10px]">{q}</Badge>)}
                        </div>
                      </div>
                    </div>

                    {mission.likelyFiles.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Likely files</p>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2 space-y-0.5">
                          {mission.likelyFiles.map(f => (
                            <div key={f} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                              <FileText className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                              <span className="font-mono truncate">{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Done when</p>
                        <ul className="space-y-0.5">
                          {mission.doneWhen.map(d => (
                            <li key={d} className="flex items-start gap-1.5 text-[11px] text-zinc-500">
                              <CheckCircle2 className="w-3 h-3 text-zinc-700 flex-shrink-0 mt-0.5" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1.5">Validation</p>
                        <ul className="space-y-0.5">
                          {mission.validation.map(v => (
                            <li key={v} className="font-mono text-[11px] text-zinc-400">{v}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {mission.warnings.length > 0 && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                        {mission.warnings.map(w => (
                          <div key={w} className="flex items-start gap-2 text-xs text-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            {w}
                          </div>
                        ))}
                      </div>
                    )}

                    <Button onClick={runMission} disabled={generating} className="w-full">
                      {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      {generating ? 'Running mission...' : 'Run Mission'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Context debug */}
            {ctxDebug && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/50">
                <button
                  onClick={() => setDebugOpen(!debugOpen)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left"
                >
                  {debugOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />}
                  <Info className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-xs text-zinc-500">Context debug</span>
                  <span className="text-[10px] text-zinc-700 ml-auto">
                    {ctxDebug.includedFiles} files · {ctxDebug.totalChars.toLocaleString()} chars · {ctxDebug.promptSize.toLocaleString()} prompt
                  </span>
                </button>
                {debugOpen && (
                  <div className="border-t border-zinc-800 p-3 space-y-2 font-mono text-[11px]">
                    <div className="text-zinc-400">Included paths: <span className="text-zinc-300">{ctxDebug.includedPaths.join(', ') || '(none)'}</span></div>
                    {ctxDebug.truncationWarnings.map(w => (
                      <div key={w} className="text-amber-400">⚠ {w}</div>
                    ))}
                    {rawOutput && (
                      <details>
                        <summary className="cursor-pointer text-zinc-600 hover:text-zinc-400">Raw provider output</summary>
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-zinc-500 text-[10px]">{rawOutput}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Terminal */}
            {terminalEntries.length > 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50">
                  <Terminal className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-xs text-zinc-500">Run log</span>
                  <Button size="sm" variant="ghost" className="ml-auto h-5 px-1.5 text-[10px]" onClick={() => setTerminalEntries([])}>Clear</Button>
                </div>
                <div className="p-2 space-y-2">
                  {terminalEntries.map(entry => (
                    <div key={entry.id} className="rounded-lg border border-zinc-800/50 bg-zinc-900/40 p-2 font-mono text-[11px]">
                      <div className="flex items-center gap-2 mb-1 text-zinc-500">
                        {entry.running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Terminal className="w-3 h-3" />}
                        <span>$ {entry.label}</span>
                        {entry.exitCode !== undefined && (
                          <Badge variant={entry.exitCode === 0 ? 'success' : 'error'} className="ml-auto text-[9px]">exit {entry.exitCode}</Badge>
                        )}
                      </div>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-zinc-400">{entry.stdout}</pre>
                      {entry.stderr && <pre className="mt-1 whitespace-pre-wrap text-amber-300">{entry.stderr}</pre>}
                      {entry.error && <pre className="mt-1 whitespace-pre-wrap text-red-300">{entry.error}</pre>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Patch + Commit */}
      <aside className="hidden xl:flex w-80 flex-col border-l border-zinc-800/50 flex-shrink-0">
        <div className="border-b border-zinc-800/50 px-3 py-3">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-zinc-200">Patch proposal</span>
            {proposalMeta && (
              <span className="text-[10px] text-zinc-600 ml-auto truncate">{proposalMeta.providerName}</span>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            {!proposal && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-center">
                <Sparkles className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                <p className="text-xs text-zinc-600">Build and run a mission to see the patch proposal here.</p>
              </div>
            )}

            {proposal && (
              <>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <Badge variant={riskColor(proposal.riskLevel) as 'error' | 'warning' | 'success'} className="text-[10px]">{proposal.riskLevel} risk</Badge>
                    {proposal.provider && <span className="text-[10px] text-zinc-600 ml-auto">{proposal.provider}</span>}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{proposal.summary}</p>
                </div>

                {proposal.files.length === 0 ? (
                  <div className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-600">No files proposed — task may need more context.</div>
                ) : (
                  <div className="space-y-3">
                    {proposal.files.map(file => (
                      <div key={file.path} className="space-y-1.5">
                        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPatchFiles.has(file.path)}
                            disabled={file.operation === 'delete'}
                            onChange={e => {
                              setSelectedPatchFiles(prev => {
                                const next = new Set(prev)
                                e.target.checked ? next.add(file.path) : next.delete(file.path)
                                return next
                              })
                            }}
                          />
                          <span className="font-mono text-[11px] truncate" title={file.path}>{file.path}</span>
                          <Badge variant="default" className="text-[9px] flex-shrink-0">{file.operation}</Badge>
                        </label>
                        <DiffBlock file={file} />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button size="sm" onClick={applyPatch} disabled={applying || selectedPatchFiles.size === 0}>
                    {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Apply selected + run checks
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setProposal(null); setSelectedPatchFiles(new Set()) }}>
                    Reject patch
                  </Button>
                </div>

                {proposal.commandsToRun.length > 0 && (
                  <div className="rounded-lg border border-zinc-800 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-2">Run after apply</p>
                    {proposal.commandsToRun.map(cmd => (
                      <button
                        key={cmd}
                        onClick={() => {
                          const parts = cmd.trim().split(' ')
                          const [exe, ...args] = parts
                          if (exe) runCommand(cmd, exe, args)
                        }}
                        className="block font-mono text-[11px] text-zinc-400 hover:text-zinc-200 py-0.5 w-full text-left"
                      >
                        $ {cmd}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Commit helper */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="flex items-center gap-2 mb-2">
                <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-zinc-200">Commit</span>
                <Badge variant="warning" className="text-[9px] ml-auto">never pushes</Badge>
              </div>
              <textarea
                value={commitMessage}
                onChange={e => setCommitMessage(e.target.value)}
                placeholder="Commit message"
                className="w-full min-h-16 resize-none rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-700 mb-2"
              />
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={generateCommitMessage} className="flex-1">
                  <Clipboard className="w-3 h-3" /> Draft
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!commitMessage.trim()}
                  onClick={async () => {
                    if (!window.confirm('Create a local commit? This will NOT push.')) return
                    await runCommand('git add -A', 'git', ['add', '-A'])
                    await runCommand(`git commit`, 'git', ['commit', '-m', commitMessage])
                    setCommitMessage('')
                    toast.success('Committed locally.')
                  }}
                  className="flex-1"
                >
                  Commit
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </aside>
    </div>
  )
}
