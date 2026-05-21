'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  Code2,
  Copy,
  FileText,
  FolderOpen,
  GitBranch,
  GitCommit,
  Loader2,
  PanelBottom,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/bertos/cn'
import type { AIModel } from '@/lib/bertos/types'
import { GitPanel } from './GitPanel'
import { useUIStore } from '@/store/bertos/ui'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

interface WorkspaceStatus {
  online: boolean
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

interface OpenTab {
  path: string
  content: string
  savedContent: string
  language: string
}

interface TerminalEntry {
  id: string
  label: string
  stdout: string
  stderr?: string
  error?: string
  exitCode?: number | null
  durationMs?: number
  timestamp: number
  running?: boolean
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
    fallbackUsed?: string
    fallbackChain?: string[]
    latencyMs?: number
  }
  error?: string
  raw?: string
}

const STORAGE_KEY = 'bertos-workspace-tabs-v2'
const TERMINAL_HISTORY_KEY = 'bertos-workspace-terminal-v1'

const SAFE_COMMANDS = [
  { label: 'git status', executable: 'git', args: ['status', '--short'] },
  { label: 'git diff', executable: 'git', args: ['diff'] },
  { label: 'git log', executable: 'git', args: ['log', '--oneline', '-5'] },
  { label: 'typecheck', executable: 'npm', args: ['run', 'typecheck'], timeoutMs: 180000 },
  { label: 'build', executable: 'npm', args: ['run', 'build'], timeoutMs: 240000 },
  { label: 'lint', executable: 'npm', args: ['run', 'lint'], timeoutMs: 180000 },
  { label: 'test', executable: 'npm', args: ['test'], timeoutMs: 180000 },
  { label: 'npm install', executable: 'npm', args: ['install'], timeoutMs: 300000 },
] as const

const CUSTOM_COMMANDS = new Map<string, { executable: string; args: string[]; timeoutMs?: number }>([
  ['git status', { executable: 'git', args: ['status', '--short'] }],
  ['git status --short', { executable: 'git', args: ['status', '--short'] }],
  ['git diff', { executable: 'git', args: ['diff'] }],
  ['git log --oneline -5', { executable: 'git', args: ['log', '--oneline', '-5'] }],
  ['npm run typecheck', { executable: 'npm', args: ['run', 'typecheck'], timeoutMs: 180000 }],
  ['npm run build', { executable: 'npm', args: ['run', 'build'], timeoutMs: 240000 }],
  ['npm run lint', { executable: 'npm', args: ['run', 'lint'], timeoutMs: 180000 }],
  ['npm test', { executable: 'npm', args: ['test'], timeoutMs: 180000 }],
  ['npm install', { executable: 'npm', args: ['install'], timeoutMs: 300000 }],
])

const MEMORY_FACTS = [
  'Never touch Sylistly or any sylistly remote.',
  'BertOS is a standalone self-coding AI operating system.',
  'The local daemon is the file and terminal bridge.',
  'Ollama Cloud works for API responses.',
  'Claude Code, Codex CLI, and Gemini CLI are available through the daemon when it is online.',
]

function readSystemFacts(): string[] {
  if (useUIStore.getState().settings.memoryEnabled === false) return []
  try {
    const raw = localStorage.getItem('bertos-system-facts-v1')
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<{ content: string }>
    return parsed.map(f => f.content).filter(Boolean)
  } catch { return [] }
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap(node => node.type === 'dir' ? flattenFiles(node.children ?? []) : [node])
}

function getLanguage(path: string) {
  if (/\.(tsx|ts)$/.test(path)) return 'TypeScript'
  if (/\.(jsx|js|mjs|cjs)$/.test(path)) return 'JavaScript'
  if (/\.json$/.test(path)) return 'JSON'
  if (/\.mdx?$/.test(path)) return 'Markdown'
  if (/\.css$/.test(path)) return 'CSS'
  if (/\.ya?ml$/.test(path)) return 'YAML'
  return 'Text'
}

function commandToLabel(executable: string, args: string[]) {
  return [executable, ...args].join(' ')
}

function getChangedFiles(statusText?: string) {
  return (statusText ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.slice(3).trim())
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
    before: oldLines.slice(prefix, oldSuffix + 1),
    after: newLines.slice(prefix, newSuffix + 1),
    startLine: prefix + 1,
  }
}

function FileTree({
  nodes,
  activePath,
  query,
  onOpen,
}: {
  nodes: FileNode[]
  activePath: string
  query: string
  onOpen: (path: string) => void
}) {
  const normalizedQuery = query.trim().toLowerCase()
  return (
    <div className="space-y-0.5">
      {nodes.map(node => {
        const visible = !normalizedQuery || node.path.toLowerCase().includes(normalizedQuery) || node.type === 'dir'
        if (!visible) return null
        return (
          <div key={node.path}>
            <button
              onClick={() => node.type === 'file' && onOpen(node.path)}
              className={cn(
                'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors',
                node.type === 'file' ? 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5' : 'text-zinc-300',
                activePath === node.path && 'bg-violet-500/15 text-violet-200'
              )}
            >
              {node.type === 'dir'
                ? <FolderOpen className="w-3 h-3 text-zinc-600" />
                : <FileText className="w-3 h-3 text-zinc-600" />}
              <span className="truncate">{node.name}</span>
            </button>
            {node.type === 'dir' && node.children?.length ? (
              <div className="ml-3 border-l border-zinc-800/60 pl-1">
                <FileTree nodes={node.children} activePath={activePath} query={query} onOpen={onOpen} />
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function Editor({
  tab,
  safe,
  onChange,
}: {
  tab?: OpenTab
  safe: boolean
  onChange: (content: string) => void
}) {
  const lines = (tab?.content ?? '').split(/\r?\n/).length
  return (
    <div className="grid h-full grid-cols-[52px_1fr] overflow-hidden bg-[#09090B]">
      <div className="select-none border-r border-zinc-900 bg-zinc-950/60 py-4 text-right font-mono text-xs leading-5 text-zinc-700">
        {Array.from({ length: Math.max(lines, 1) }, (_, index) => (
          <div key={index} className="px-3">{index + 1}</div>
        ))}
      </div>
      <textarea
        value={tab?.content ?? ''}
        onChange={event => onChange(event.target.value)}
        disabled={!safe || !tab}
        spellCheck={false}
        placeholder={safe ? 'Open a file from the explorer.' : 'Workspace unavailable until the local daemon is online and repo safety passes.'}
        className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-5 text-zinc-200 placeholder:text-zinc-700 outline-none"
      />
    </div>
  )
}

function DiffBlock({ file }: { file: PatchFile }) {
  const diff = simpleDiff(file.before ?? '', file.after ?? '')
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="border-b border-zinc-800 px-3 py-2 font-mono text-[11px] text-zinc-400">
        {file.operation} {file.path} from line {diff.startLine}
      </div>
      <div className="max-h-64 overflow-auto font-mono text-[11px] leading-5">
        {diff.before.length === 0 && diff.after.length === 0 ? (
          <div className="px-3 py-2 text-zinc-600">No textual diff detected.</div>
        ) : null}
        {diff.before.slice(0, 120).map((line, index) => (
          <div key={`old-${index}`} className="bg-red-500/10 px-3 text-red-200">
            <span className="mr-2 text-red-500">-</span>{line || ' '}
          </div>
        ))}
        {diff.after.slice(0, 120).map((line, index) => (
          <div key={`new-${index}`} className="bg-emerald-500/10 px-3 text-emerald-200">
            <span className="mr-2 text-emerald-500">+</span>{line || ' '}
          </div>
        ))}
      </div>
    </div>
  )
}

export function WorkspaceView() {
  const [status, setStatus] = useState<WorkspaceStatus | null>(null)
  const [files, setFiles] = useState<FileNode[]>([])
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activeFile, setActiveFile] = useState('')
  const [fileSearch, setFileSearch] = useState('')
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([])
  const [terminalInput, setTerminalInput] = useState('')
  const [cmdHistory, setCmdHistory] = useState<string[]>([])
  const [historyPos, setHistoryPos] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [task, setTask] = useState('')
  const [provider, setProvider] = useState<AIModel>('auto')
  const [proposal, setProposal] = useState<PatchProposal | null>(null)
  const [proposalProvider, setProposalProvider] = useState<PatchResponse['provider'] | null>(null)
  const [selectedPatchFiles, setSelectedPatchFiles] = useState<Set<string>>(new Set())
  const [generatingPatch, setGeneratingPatch] = useState(false)
  const [applyingPatch, setApplyingPatch] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [generatingCommit, setGeneratingCommit] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const activeTab = tabs.find(tab => tab.path === activeFile)
  const dirty = Boolean(activeTab && activeTab.content !== activeTab.savedContent)
  const dirtyTabs = tabs.filter(tab => tab.content !== tab.savedContent)
  const flatFiles = useMemo(() => flattenFiles(files), [files])
  const safe = Boolean(status?.online && status.repo?.safeRepo)
  const changedFiles = getChangedFiles(status?.repo?.status)

  const saveWorkspaceState = useCallback((nextTabs: OpenTab[], nextActiveFile: string) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tabs: nextTabs.map(tab => ({ path: tab.path, language: tab.language })),
      activeFile: nextActiveFile,
    }))
  }, [])

  const setTabsAndPersist = useCallback((updater: (current: OpenTab[]) => OpenTab[], nextActive = activeFile) => {
    setTabs(current => {
      const next = updater(current)
      saveWorkspaceState(next, nextActive)
      return next
    })
  }, [activeFile, saveWorkspaceState])

  const appendTerminal = useCallback((entry: TerminalEntry) => {
    setTerminalEntries(current => {
      const next = [...current, entry].slice(-40)
      localStorage.setItem(TERMINAL_HISTORY_KEY, JSON.stringify(next.slice(-20)))
      return next
    })
  }, [])

  const loadStatus = useCallback(async () => {
    const res = await fetch('/api/local-daemon/status', { cache: 'no-store' })
    const data = await res.json()
    setStatus(data)
  }, [])

  const loadFiles = useCallback(async () => {
    const res = await fetch('/api/local-daemon/files', { cache: 'no-store' })
    const data = await res.json()
    setFiles(data.files ?? [])
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([loadStatus(), loadFiles()])
    } finally {
      setLoading(false)
    }
  }, [loadFiles, loadStatus])

  const openFile = useCallback(async (path: string) => {
    const existing = tabs.find(tab => tab.path === path)
    if (existing) {
      setActiveFile(path)
      saveWorkspaceState(tabs, path)
      return
    }

    const res = await fetch(`/api/local-daemon/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Could not open file.')
      return
    }

    const tab: OpenTab = {
      path,
      content: data.content ?? '',
      savedContent: data.content ?? '',
      language: getLanguage(path),
    }
    const nextTabs = [...tabs, tab]
    setTabs(nextTabs)
    setActiveFile(path)
    saveWorkspaceState(nextTabs, path)
  }, [saveWorkspaceState, tabs])

  useEffect(() => {
    const restoredTerminal = localStorage.getItem(TERMINAL_HISTORY_KEY)
    if (restoredTerminal) {
      try { setTerminalEntries(JSON.parse(restoredTerminal)) } catch { /* ignore stale cache */ }
    }
    refresh()
  }, [refresh])

  useEffect(() => {
    const restored = localStorage.getItem(STORAGE_KEY)
    if (!restored || flatFiles.length === 0 || tabs.length > 0) return
    let cancelled = false
    try {
      const parsed = JSON.parse(restored) as { tabs?: { path: string }[]; activeFile?: string }
      const paths = (parsed.tabs ?? []).map(tab => tab.path).filter(path => flatFiles.some(file => file.path === path)).slice(0, 6)
      Promise.all(paths.map(async path => {
        const res = await fetch(`/api/local-daemon/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
        if (!res.ok) return null
        const data = await res.json()
        return {
          path,
          content: data.content ?? '',
          savedContent: data.content ?? '',
          language: getLanguage(path),
        } satisfies OpenTab
      })).then(restoredTabs => {
        if (cancelled) return
        const nextTabs = restoredTabs.filter((tab): tab is OpenTab => Boolean(tab))
        setTabs(nextTabs)
        setActiveFile(parsed.activeFile && paths.includes(parsed.activeFile) ? parsed.activeFile : nextTabs[0]?.path ?? '')
      })
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
    return () => { cancelled = true }
  }, [flatFiles, openFile, tabs.length])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveActiveFile()
      }
      if (mod && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  const updateActiveContent = (content: string) => {
    setTabsAndPersist(current => current.map(tab => tab.path === activeFile ? { ...tab, content } : tab))
  }

  const closeTab = (path: string) => {
    const tab = tabs.find(item => item.path === path)
    if (tab && tab.content !== tab.savedContent && !window.confirm(`${path} has unsaved changes. Close it anyway?`)) return
    const nextTabs = tabs.filter(item => item.path !== path)
    const nextActive = activeFile === path ? nextTabs.at(-1)?.path ?? '' : activeFile
    setTabs(nextTabs)
    setActiveFile(nextActive)
    saveWorkspaceState(nextTabs, nextActive)
  }

  const saveActiveFile = async () => {
    if (!activeTab || !dirty || !safe) return
    const res = await fetch('/api/local-daemon/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: activeTab.path, content: activeTab.content }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Save failed.')
      return
    }
    setTabsAndPersist(current => current.map(tab => tab.path === activeTab.path ? { ...tab, savedContent: tab.content } : tab))
    toast.success(`Saved ${activeTab.path}`)
    await loadStatus()
  }

  const reloadActiveFile = async () => {
    if (!activeTab) return
    if (dirty && !window.confirm('Discard unsaved changes and reload this file?')) return
    const res = await fetch(`/api/local-daemon/file?path=${encodeURIComponent(activeTab.path)}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Reload failed.')
      return
    }
    setTabsAndPersist(current => current.map(tab => tab.path === activeTab.path ? {
      ...tab,
      content: data.content ?? '',
      savedContent: data.content ?? '',
    } : tab))
  }

  const runCommand = async (command: { label: string; executable: string; args: readonly string[]; timeoutMs?: number }) => {
    if (!safe) return
    const id = `${Date.now()}-${command.label}`
    appendTerminal({
      id,
      label: command.label,
      stdout: 'Running...',
      timestamp: Date.now(),
      running: true,
    })
    const res = await fetch('/api/local-daemon/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    })
    const data = await res.json()
    setTerminalEntries(current => current.map(entry => entry.id === id ? {
      ...entry,
      stdout: data.stdout ?? '',
      stderr: data.stderr,
      error: data.error,
      exitCode: data.exitCode,
      durationMs: data.durationMs,
      running: false,
    } : entry))
    await loadStatus()
    return data
  }

  const runCustomCommand = async () => {
    const normalized = terminalInput.trim().replace(/\s+/g, ' ')
    const command = CUSTOM_COMMANDS.get(normalized)
    if (!command) {
      toast.error('Command is not allowlisted. Use the safe command buttons or an exact allowed command.')
      return
    }
    setCmdHistory(prev => [normalized, ...prev.filter(c => c !== normalized)].slice(0, 50))
    setHistoryPos(-1)
    setTerminalInput('')
    await runCommand({ label: normalized, ...command })
  }

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { void runCustomCommand(); return }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHistoryPos(prev => {
        const next = Math.min(prev + 1, cmdHistory.length - 1)
        if (cmdHistory[next]) setTerminalInput(cmdHistory[next])
        return next
      })
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHistoryPos(prev => {
        const next = prev - 1
        if (next < 0) { setTerminalInput(''); return -1 }
        if (cmdHistory[next]) setTerminalInput(cmdHistory[next])
        return next
      })
    }
  }

  const generatePatch = async () => {
    if (!task.trim()) {
      toast.error('Describe the change first.')
      return
    }
    setGeneratingPatch(true)
    setProposal(null)
    setProposalProvider(null)
    try {
      const res = await fetch('/api/workspace/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          provider,
          context: {
            repo: status?.repo,
            activeFile,
            activeContent: activeTab?.content,
            includedFiles: tabs
              .filter(tab => typeof tab.content === 'string' && tab.content.length > 0)
              .slice(0, 8)
              .map(tab => ({ path: tab.path, content: tab.content })),
            fileTree: flatFiles.map(file => file.path),
            gitStatus: status?.repo?.status,
            terminalOutput: terminalEntries.slice(-5).map(entry => [
              `$ ${entry.label}`,
              entry.stdout,
              entry.stderr,
              entry.error,
            ].filter(Boolean).join('\n')).join('\n\n'),
            memories: [...MEMORY_FACTS, ...readSystemFacts()],
          },
        }),
      })
      const data = await res.json() as PatchResponse
      if (!res.ok || !data.ok || !data.proposal) throw new Error(data.error || 'Patch generation failed.')
      const hydratedFiles = data.proposal.files.map(file => {
        const open = tabs.find(tab => tab.path === file.path)
        return {
          ...file,
          before: file.before ?? open?.savedContent ?? '',
        }
      })
      setProposal({ ...data.proposal, files: hydratedFiles })
      setProposalProvider(data.provider ?? null)
      setSelectedPatchFiles(new Set(hydratedFiles.filter(file => file.operation !== 'delete').map(file => file.path)))
      toast.success(`Patch proposed by ${data.provider?.providerName ?? data.proposal.provider ?? 'provider'}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Patch generation failed.')
    } finally {
      setGeneratingPatch(false)
    }
  }

  const applyPatch = async () => {
    if (!proposal || selectedPatchFiles.size === 0) return
    if (!safe) return toast.error('Workspace is not safe.')
    setApplyingPatch(true)
    try {
      const patchedPaths: string[] = []
      for (const file of proposal.files) {
        if (!selectedPatchFiles.has(file.path)) continue
        if (file.operation === 'delete') {
          toast.error(`Delete is blocked for ${file.path}.`)
          continue
        }
        const res = await fetch('/api/local-daemon/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: file.path, content: file.after ?? '' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `Could not write ${file.path}`)
        patchedPaths.push(file.path)
        const existing = tabs.find(tab => tab.path === file.path)
        if (existing) {
          setTabs(current => current.map(tab => tab.path === file.path
            ? { ...tab, content: file.after ?? '', savedContent: file.after ?? '' }
            : tab))
        }
      }

      // Reload open tab contents for any patched files from disk.
      await Promise.all(patchedPaths.map(async path => {
        const existing = tabs.find(tab => tab.path === path)
        if (!existing) return
        const res = await fetch(`/api/local-daemon/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        setTabs(current => current.map(tab => tab.path === path
          ? { ...tab, content: data.content ?? '', savedContent: data.content ?? '' }
          : tab))
      }))

      toast.success('Approved patch files applied.')
      await refresh()

      // Run typecheck and surface the result as a toast.
      const typecheckCommand = CUSTOM_COMMANDS.get('npm run typecheck')
      if (typecheckCommand) {
        const result = await runCommand({ label: 'npm run typecheck', ...typecheckCommand })
        if (result?.exitCode === 0) {
          toast.success('Typecheck passed.')
        } else {
          toast.error(`Typecheck failed (exit ${result?.exitCode ?? '?'}).`)
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Patch apply failed.')
    } finally {
      setApplyingPatch(false)
    }
  }

  const runSuggestedCommands = async () => {
    if (!proposal) return
    for (const commandText of proposal.commandsToRun) {
      const command = CUSTOM_COMMANDS.get(commandText.trim().replace(/\s+/g, ' '))
      if (command) await runCommand({ label: commandText, ...command })
    }
  }

  const generateCommitMessage = async () => {
    setGeneratingCommit(true)
    try {
      const diff = await runCommand({ label: 'git diff', executable: 'git', args: ['diff'] })
      const res = await fetch('/api/workspace/commit-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diff: diff?.stdout, status: status?.repo?.status }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not generate commit message.')
      setCommitMessage(data.message)
      toast.success('Commit message drafted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Commit message failed.')
    } finally {
      setGeneratingCommit(false)
    }
  }

  const commitChanges = async () => {
    if (!commitMessage.trim()) return toast.error('Write or generate a commit message first.')
    if (!safe || status?.repo?.remote?.toLowerCase().includes('sylistly')) return toast.error('Git actions are blocked by repo safety.')
    if (!window.confirm('Stage current repo changes and create a local commit? This will not push.')) return
    await runCommand({ label: 'git add -A', executable: 'git', args: ['add', '-A'] })
    await runCommand({ label: `git commit -m "${commitMessage}"`, executable: 'git', args: ['commit', '-m', commitMessage], timeoutMs: 120000 })
    await refresh()
  }

  const copyActivePath = async () => {
    if (!activeFile) return
    await navigator.clipboard.writeText(activeFile)
    toast.success('File path copied.')
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#09090B]">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-zinc-800/50 bg-zinc-950/60 md:flex">
        <div className="flex items-center justify-between border-b border-zinc-800/50 px-3 py-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-semibold text-zinc-300">BertOS Workspace</span>
          </div>
          <button onClick={refresh} className="text-zinc-600 hover:text-zinc-300">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="border-b border-zinc-800/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            {safe ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
            <Badge variant={safe ? 'success' : 'warning'} className="text-[10px]">
              {safe ? 'Repo safe' : 'Local coding unavailable'}
            </Badge>
          </div>
          <p className="truncate text-[11px] text-zinc-500">{status?.repo?.root ?? status?.error ?? 'Checking daemon...'}</p>
          <p className="truncate text-[11px] text-zinc-600">{status?.repo?.remote ?? 'Start npm run bertos:daemon'}</p>
          {status?.repo?.blockedReason && <p className="text-[11px] text-amber-300">{status.repo.blockedReason}</p>}
        </div>

        <div className="border-b border-zinc-800/50 p-2">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-zinc-600" />
            <input
              ref={searchRef}
              value={fileSearch}
              onChange={event => setFileSearch(event.target.value)}
              placeholder="Quick open (Ctrl+P)"
              className="w-full bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-700"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 p-2">
          {safe ? <FileTree nodes={files} activePath={activeFile} query={fileSearch} onOpen={openFile} /> : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">
              Local coding requires running BertOS locally with <code>npm run bertos:daemon</code>. Vercel can still use Ollama Cloud chat, but cannot edit your Windows files.
            </div>
          )}
        </ScrollArea>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-[48px] items-center gap-2 border-b border-zinc-800/50 px-3">
          <GitBranch className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-zinc-400">{status?.repo?.branch ?? 'unknown branch'}</span>
          <span className="text-xs text-zinc-700">|</span>
          <span className="truncate text-xs text-zinc-500">{activeFile || `${flatFiles.length} files indexed`}</span>
          {dirtyTabs.length > 0 && <Badge variant="warning" className="ml-1 text-[10px]">{dirtyTabs.length} unsaved</Badge>}
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={copyActivePath} disabled={!activeFile}><Copy className="w-3.5 h-3.5" />Path</Button>
            <Button size="sm" variant="ghost" onClick={reloadActiveFile} disabled={!activeTab}><RotateCcw className="w-3.5 h-3.5" />Revert</Button>
            <Button size="sm" variant="secondary" onClick={saveActiveFile} disabled={!dirty || !safe} title="Save current file (Ctrl+S)">
              <Save className="w-3.5 h-3.5" />{dirty ? 'Save' : 'Saved'}
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-[38px] items-end gap-1 overflow-x-auto border-b border-zinc-800/50 bg-zinc-950/40 px-2 pt-1">
              {tabs.length === 0 ? (
                <div className="px-2 pb-2 text-xs text-zinc-600">Open a file to start editing.</div>
              ) : tabs.map(tab => {
                const isDirty = tab.content !== tab.savedContent
                return (
                  <button
                    key={tab.path}
                    onClick={() => setActiveFile(tab.path)}
                    className={cn(
                      'flex max-w-56 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 text-xs',
                      activeFile === tab.path
                        ? 'border-zinc-700 bg-[#09090B] text-zinc-200'
                        : 'border-transparent bg-zinc-900/30 text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', isDirty ? 'bg-amber-400' : 'bg-zinc-700')} />
                    <span className="truncate">{tab.path.split(/[\\/]/).pop()}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={event => { event.stopPropagation(); closeTab(tab.path) }}
                      onKeyDown={event => { if (event.key === 'Enter') closeTab(tab.path) }}
                      className="rounded p-0.5 hover:bg-white/10"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="min-h-0 flex-1">
              <Editor tab={activeTab} safe={safe} onChange={updateActiveContent} />
            </div>

            <div className="h-72 border-t border-zinc-800/50 bg-zinc-950/80">
              <div className="flex items-center gap-2 border-b border-zinc-800/50 px-3 py-2">
                <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Safe Terminal</span>
                <div className="ml-auto flex flex-wrap gap-1">
                  {SAFE_COMMANDS.map(command => (
                    <button
                      key={command.label}
                      disabled={!safe}
                      onClick={() => runCommand(command)}
                      className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-200 disabled:opacity-40"
                    >
                      {command.label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setTerminalEntries([])
                      localStorage.removeItem(TERMINAL_HISTORY_KEY)
                    }}
                    className="rounded border border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-200"
                  >
                    clear
                  </button>
                </div>
              </div>
              <div className="flex border-b border-zinc-800/50">
                <input
                  value={terminalInput}
                  onChange={event => setTerminalInput(event.target.value)}
                  onKeyDown={handleTerminalKeyDown}
                  placeholder="Custom safe command, e.g. npm run typecheck"
                  className="flex-1 bg-transparent px-3 py-2 font-mono text-xs text-zinc-300 outline-none placeholder:text-zinc-700"
                />
                <Button size="sm" variant="ghost" onClick={runCustomCommand} disabled={!safe || !terminalInput.trim()}>
                  <Play className="w-3.5 h-3.5" />Run
                </Button>
              </div>
              <ScrollArea className="h-[214px]">
                <div className="space-y-3 p-3 font-mono text-xs">
                  {terminalEntries.length === 0 ? (
                    <div className="text-zinc-600">Run a safe command. Output is never faked.</div>
                  ) : terminalEntries.map(entry => (
                    <div key={entry.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 group">
                      <div className="mb-2 flex items-center gap-2 text-zinc-500">
                        {entry.running ? <Loader2 className="w-3 h-3 animate-spin" /> : <PanelBottom className="w-3 h-3" />}
                        <span>$ {entry.label}</span>
                        <span className="ml-auto">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        {!entry.running && entry.stdout && (
                          <button
                            onClick={() => navigator.clipboard.writeText(entry.stdout)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-400"
                            title="Copy output"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                        {entry.exitCode !== undefined && <Badge variant={entry.exitCode === 0 ? 'success' : 'error'} className="text-[10px]">exit {entry.exitCode}</Badge>}
                      </div>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-zinc-400">{entry.stdout}</pre>
                      {entry.stderr && <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-amber-300">{entry.stderr}</pre>}
                      {entry.error && <pre className="mt-2 whitespace-pre-wrap text-red-300">{entry.error}</pre>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </section>

          <aside className="hidden w-[430px] shrink-0 flex-col border-l border-zinc-800/50 bg-zinc-950/50 xl:flex">
            <ScrollArea className="flex-1">
              <div className="space-y-4 p-4">
                <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <h2 className="text-sm font-semibold text-zinc-200">AI Patch Loop</h2>
                    <Badge variant="info" className="ml-auto text-[10px]">review required</Badge>
                  </div>
                  <textarea
                    value={task}
                    onChange={event => setTask(event.target.value)}
                    placeholder="Describe a repo change. The AI must return structured patch JSON for review."
                    className="min-h-24 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-700"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={provider}
                      onChange={event => setProvider(event.target.value as AIModel)}
                      className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-300 outline-none"
                    >
                      <option value="auto">Auto</option>
                      <option value="claude-code">Claude</option>
                      <option value="codex-cli">Codex</option>
                      <option value="gemini-cli">Gemini</option>
                      <option value="ollama-pro">Ollama</option>
                    </select>
                    <Button size="sm" onClick={generatePatch} disabled={!safe || generatingPatch || !task.trim()}>
                      {generatingPatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                      Generate patch
                    </Button>
                  </div>
                  {proposalProvider && (
                    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-[11px] text-zinc-500">
                      Provider: {proposalProvider.providerName ?? proposalProvider.providerId} / {proposalProvider.modelOrTool ?? 'unknown'} / {proposalProvider.source ?? 'unknown'} / {proposalProvider.latencyMs ?? 'n/a'}ms
                    </div>
                  )}
                </section>

                {proposal && (
                  <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-200">Patch proposal</h3>
                      <Badge variant={proposal.riskLevel === 'high' ? 'error' : proposal.riskLevel === 'medium' ? 'warning' : 'success'} className="text-[10px]">
                        {proposal.riskLevel} risk
                      </Badge>
                    </div>
                    <p className="mb-3 text-xs leading-relaxed text-zinc-500">{proposal.summary}</p>
                    <div className="space-y-3">
                      {proposal.files.length === 0 ? (
                        <div className="rounded-lg border border-zinc-800 p-3 text-xs text-zinc-500">No files proposed. The model needs more context or the task is not patchable yet.</div>
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
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={applyPatch} disabled={applyingPatch || selectedPatchFiles.size === 0}>
                        {applyingPatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Apply selected
                      </Button>
                      <Button size="sm" variant="outline" onClick={runSuggestedCommands} disabled={!proposal.commandsToRun.length}>
                        Run suggested checks
                      </Button>
                    </div>
                    {proposal.commandsToRun.length > 0 && (
                      <div className="mt-3 text-[11px] text-zinc-600">
                        Suggested: {proposal.commandsToRun.join(', ')}
                      </div>
                    )}
                  </section>
                )}

                <GitPanel />
              </div>
            </ScrollArea>
          </aside>
        </div>
      </main>
    </div>
  )
}
