'use client'
import { useEffect, useMemo, useState } from 'react'
import { Code2, FolderOpen, FileText, GitBranch, RefreshCw, Save, Terminal, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/bertos/cn'

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

const SAFE_COMMANDS = [
  { label: 'git status', executable: 'git', args: ['status', '--short'] },
  { label: 'git diff', executable: 'git', args: ['diff'] },
  { label: 'typecheck', executable: 'npm', args: ['run', 'typecheck'] },
  { label: 'build', executable: 'npm', args: ['run', 'build'] },
  { label: 'test', executable: 'npm', args: ['test'] },
]

function flattenFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap(node => node.type === 'dir' ? flattenFiles(node.children ?? []) : [node])
}

function FileTree({ nodes, onOpen }: { nodes: FileNode[]; onOpen: (path: string) => void }) {
  return (
    <div className="space-y-0.5">
      {nodes.map(node => (
        <div key={node.path}>
          <button
            onClick={() => node.type === 'file' && onOpen(node.path)}
            className={cn(
              'w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left transition-colors',
              node.type === 'file' ? 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5' : 'text-zinc-300'
            )}
          >
            {node.type === 'dir' ? <FolderOpen className="w-3 h-3 text-zinc-600" /> : <FileText className="w-3 h-3 text-zinc-600" />}
            <span className="truncate">{node.name}</span>
          </button>
          {node.type === 'dir' && node.children?.length ? (
            <div className="ml-3 border-l border-zinc-800/60 pl-1">
              <FileTree nodes={node.children} onOpen={onOpen} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function WorkspaceView() {
  const [status, setStatus] = useState<WorkspaceStatus | null>(null)
  const [files, setFiles] = useState<FileNode[]>([])
  const [activeFile, setActiveFile] = useState<string>('')
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [terminal, setTerminal] = useState<string>('Workspace terminal output appears here.')
  const [loading, setLoading] = useState(false)

  const dirty = content !== savedContent
  const flatFiles = useMemo(() => flattenFiles(files), [files])
  const safe = Boolean(status?.online && status.repo?.safeRepo)

  const loadStatus = async () => {
    const res = await fetch('/api/local-daemon/status', { cache: 'no-store' })
    const data = await res.json()
    setStatus(data)
  }

  const loadFiles = async () => {
    const res = await fetch('/api/local-daemon/files', { cache: 'no-store' })
    const data = await res.json()
    setFiles(data.files ?? [])
  }

  const refresh = async () => {
    setLoading(true)
    try {
      await loadStatus()
      await loadFiles()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const openFile = async (path: string) => {
    const res = await fetch(`/api/local-daemon/file?path=${encodeURIComponent(path)}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) {
      setTerminal(data.error || 'Could not open file.')
      return
    }
    setActiveFile(path)
    setContent(data.content ?? '')
    setSavedContent(data.content ?? '')
  }

  const saveFile = async () => {
    if (!activeFile || !dirty) return
    const res = await fetch('/api/local-daemon/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: activeFile, content }),
    })
    const data = await res.json()
    if (!res.ok) {
      setTerminal(data.error || 'Save failed.')
      return
    }
    setSavedContent(content)
    setTerminal(`Saved ${activeFile}`)
    await loadStatus()
  }

  const runCommand = async (command: typeof SAFE_COMMANDS[number]) => {
    setTerminal(`$ ${command.label}\nRunning...`)
    const res = await fetch('/api/local-daemon/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    })
    const data = await res.json()
    setTerminal([
      `$ ${command.label}`,
      data.stdout,
      data.stderr ? `stderr:\n${data.stderr}` : '',
      data.error ? `error:\n${data.error}` : '',
    ].filter(Boolean).join('\n'))
  }

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="hidden md:flex w-72 flex-col border-r border-zinc-800/50 bg-zinc-950/40">
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
              {safe ? 'Repo safe' : 'Blocked/offline'}
            </Badge>
          </div>
          <p className="text-[11px] text-zinc-500 truncate">{status?.repo?.root ?? status?.error ?? 'Checking daemon...'}</p>
          <p className="text-[11px] text-zinc-600 truncate">{status?.repo?.remote ?? 'Start npm run bertos:daemon'}</p>
          {status?.repo?.blockedReason && <p className="text-[11px] text-amber-300">{status.repo.blockedReason}</p>}
        </div>
        <ScrollArea className="flex-1 p-2">
          {safe ? <FileTree nodes={files} onOpen={openFile} /> : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">
              Start the local daemon with <code>npm run bertos:daemon</code>. Workspace editing is disabled until the daemon reports the `bertos-ai-os` repo as safe.
            </div>
          )}
        </ScrollArea>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 border-b border-zinc-800/50 px-4 py-3">
          <GitBranch className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-zinc-400">{status?.repo?.branch ?? 'unknown branch'}</span>
          <span className="text-xs text-zinc-700">|</span>
          <span className="text-xs text-zinc-500 truncate">{activeFile || `${flatFiles.length} files indexed`}</span>
          <Button size="sm" variant="secondary" className="ml-auto" onClick={saveFile} disabled={!dirty || !safe}>
            <Save className="w-3.5 h-3.5" />
            {dirty ? 'Save' : 'Saved'}
          </Button>
        </div>

        <div className="flex-1 grid grid-rows-[1fr_220px] min-h-0">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            disabled={!safe || !activeFile}
            placeholder={safe ? 'Open a file from the explorer.' : 'Workspace unavailable until local daemon is online and repo safety passes.'}
            className="w-full h-full resize-none bg-[#09090B] p-4 font-mono text-sm text-zinc-200 placeholder:text-zinc-700 outline-none"
          />
          <div className="border-t border-zinc-800/50 bg-zinc-950/80">
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
              </div>
            </div>
            <pre className="h-[170px] overflow-auto whitespace-pre-wrap p-3 font-mono text-xs text-zinc-400">{terminal}</pre>
          </div>
        </div>
      </main>
    </div>
  )
}
