'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, Clipboard, GitBranch, GitCommit,
  GitPullRequest, Loader2, RefreshCw, Terminal,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/bertos/cn'

interface GitStatus {
  branch: string
  remote: string
  safeRepo: boolean
  status: string
  changedFiles: string[]
}

interface TerminalEntry {
  id: string
  label: string
  stdout: string
  stderr?: string
  exitCode?: number | null
  running?: boolean
  timestamp: number
}

interface GitPanelProps {
  compact?: boolean
}

export function GitPanel({ compact = false }: GitPanelProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [diff, setDiff] = useState<string>('')
  const [showDiff, setShowDiff] = useState(false)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [committing, setCommitting] = useState(false)
  const [entries, setEntries] = useState<TerminalEntry[]>([])

  const runCmd = useCallback(async (label: string, executable: string, args: string[]) => {
    const id = `${Date.now()}`
    setEntries(prev => [...prev, { id, label, stdout: 'Running...', running: true, timestamp: Date.now() }].slice(-10))
    const res = await fetch('/api/local-daemon/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ executable, args, timeoutMs: 60000 }),
    })
    const data = await res.json()
    setEntries(prev => prev.map(e => e.id === id ? {
      ...e, stdout: data.stdout ?? '', stderr: data.stderr,
      exitCode: data.exitCode, running: false,
    } : e))
    return data as { stdout: string; stderr?: string; exitCode?: number | null }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/local-daemon/repo/status', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const statusLines = (data.status ?? '').split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
      setGitStatus({
        branch: data.branch ?? 'unknown',
        remote: data.remote ?? 'unknown',
        safeRepo: Boolean(data.safeRepo),
        status: data.status ?? '',
        changedFiles: statusLines.map((l: string) => l.slice(3).trim()).filter(Boolean),
      })
    } catch {
      /* daemon offline */
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDiff = async () => {
    setLoadingDiff(true)
    try {
      const res = await fetch('/api/local-daemon/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executable: 'git', args: ['diff'], timeoutMs: 30000 }),
      })
      const data = await res.json()
      setDiff(data.stdout ?? '')
      setShowDiff(true)
    } finally {
      setLoadingDiff(false)
    }
  }

  const generateCommitMessage = async () => {
    const res = await fetch('/api/local-daemon/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ executable: 'git', args: ['diff'], timeoutMs: 30000 }),
    })
    const diffData = await res.json()
    const cmRes = await fetch('/api/workspace/commit-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diff: diffData.stdout ?? '', status: gitStatus?.status }),
    })
    const cmData = await cmRes.json()
    if (cmData.ok && typeof cmData.message === 'string') {
      setCommitMessage(cmData.message)
      toast.success('Commit message drafted.')
    }
  }

  const commit = async () => {
    if (!commitMessage.trim()) return toast.error('Enter a commit message first.')
    if (!gitStatus?.safeRepo) return toast.error('Repo safety check failed — commit blocked.')
    if (gitStatus.remote.toLowerCase().includes('sylistly')) return toast.error('Blocked: Sylistly remote detected.')
    if (!window.confirm('Create a local commit? This will NOT push.')) return
    setCommitting(true)
    try {
      await runCmd('git add -A', 'git', ['add', '-A'])
      const r = await runCmd('git commit', 'git', ['commit', '-m', commitMessage])
      if (r.exitCode === 0) {
        toast.success('Committed locally.')
        setCommitMessage('')
        await refresh()
      } else {
        toast.error(r.stderr ?? 'Commit failed.')
      }
    } finally {
      setCommitting(false)
    }
  }

  useEffect(() => { refresh() }, [refresh])

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin text-zinc-600" />
        ) : gitStatus ? (
          <>
            <GitBranch className="w-3 h-3 text-zinc-600" />
            <span className="font-mono text-zinc-400">{gitStatus.branch}</span>
            {gitStatus.changedFiles.length > 0 && (
              <Badge variant="warning" className="text-[9px]">{gitStatus.changedFiles.length} changed</Badge>
            )}
            {gitStatus.safeRepo ? (
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-amber-400" />
            )}
          </>
        ) : (
          <span className="text-zinc-700">daemon offline</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800/50 flex-shrink-0">
        <GitBranch className="w-3.5 h-3.5 text-zinc-600" />
        <span className="text-xs font-semibold text-zinc-300">Git</span>
        {gitStatus && (
          <span className="font-mono text-[11px] text-violet-400 ml-1">{gitStatus.branch}</span>
        )}
        <Button size="sm" variant="ghost" onClick={refresh} disabled={loading} className="ml-auto h-6 px-1.5">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Repo safety */}
          {gitStatus && (
            <div className={cn(
              'rounded-lg border p-2.5 text-xs',
              gitStatus.safeRepo
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                : 'border-amber-500/20 bg-amber-500/5 text-amber-300'
            )}>
              <div className="flex items-center gap-1.5">
                {gitStatus.safeRepo
                  ? <CheckCircle2 className="w-3.5 h-3.5" />
                  : <AlertTriangle className="w-3.5 h-3.5" />}
                <span className="font-medium">{gitStatus.safeRepo ? 'Safe to commit' : 'Repo not safe'}</span>
              </div>
              <p className="mt-1 text-[10px] opacity-70 font-mono truncate">{gitStatus.remote}</p>
            </div>
          )}

          {/* Changed files */}
          {gitStatus && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950">
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-800/50">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  Changed files ({gitStatus.changedFiles.length})
                </span>
                {gitStatus.changedFiles.length > 0 && (
                  <button
                    onClick={loadDiff}
                    disabled={loadingDiff}
                    className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    {loadingDiff ? 'Loading...' : 'View diff'}
                  </button>
                )}
              </div>
              {gitStatus.changedFiles.length === 0 ? (
                <p className="px-2.5 py-2 text-[11px] text-zinc-700">No changes</p>
              ) : (
                <div className="divide-y divide-zinc-800/30">
                  {gitStatus.changedFiles.slice(0, 20).map(file => (
                    <div key={file} className="flex items-center gap-2 px-2.5 py-1.5">
                      <GitPullRequest className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span className="font-mono text-[11px] text-zinc-400 truncate">{file}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Diff viewer */}
          {showDiff && diff && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950">
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-800/50">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Diff</span>
                <button onClick={() => setShowDiff(false)} className="text-[10px] text-zinc-600 hover:text-zinc-400">Close</button>
              </div>
              <pre className="max-h-56 overflow-auto p-2.5 font-mono text-[10px] leading-4 whitespace-pre-wrap">
                {diff.split('\n').map((line, i) => (
                  <div key={i} className={cn(
                    line.startsWith('+') && !line.startsWith('+++') && 'text-emerald-400 bg-emerald-500/10',
                    line.startsWith('-') && !line.startsWith('---') && 'text-red-400 bg-red-500/10',
                    line.startsWith('@@') && 'text-violet-400',
                    !line.startsWith('+') && !line.startsWith('-') && !line.startsWith('@@') && 'text-zinc-600',
                  )}>{line || ' '}</div>
                ))}
              </pre>
            </div>
          )}

          {/* Commit helper */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-zinc-300">Commit</span>
              <Badge variant="warning" className="text-[9px] ml-auto">never pushes</Badge>
            </div>
            <textarea
              value={commitMessage}
              onChange={e => setCommitMessage(e.target.value)}
              placeholder="Commit message"
              className="w-full min-h-14 resize-none rounded-lg border border-zinc-800 bg-zinc-900/50 p-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-700"
            />
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={generateCommitMessage} className="flex-1 text-xs">
                <Clipboard className="w-3 h-3" /> Draft
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={commit}
                disabled={!commitMessage.trim() || committing || !gitStatus?.safeRepo}
                className="flex-1 text-xs"
              >
                {committing ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitCommit className="w-3 h-3" />}
                Commit
              </Button>
            </div>
          </div>

          {/* Run log */}
          {entries.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-zinc-800/50">
                <Terminal className="w-3 h-3 text-zinc-600" />
                <span className="text-[10px] text-zinc-600">Git log</span>
                <button onClick={() => setEntries([])} className="ml-auto text-[10px] text-zinc-700 hover:text-zinc-500">Clear</button>
              </div>
              <div className="p-2 space-y-1.5">
                {entries.map(e => (
                  <div key={e.id} className="font-mono text-[10px]">
                    <div className="flex items-center gap-1.5 text-zinc-600">
                      {e.running ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Terminal className="w-2.5 h-2.5" />}
                      <span>$ {e.label}</span>
                      {e.exitCode !== undefined && (
                        <Badge variant={e.exitCode === 0 ? 'success' : 'error'} className="ml-auto text-[8px]">exit {e.exitCode}</Badge>
                      )}
                    </div>
                    {e.stdout && e.stdout !== 'Running...' && (
                      <pre className="mt-0.5 ml-4 text-zinc-500 whitespace-pre-wrap max-h-24 overflow-auto">{e.stdout}</pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
