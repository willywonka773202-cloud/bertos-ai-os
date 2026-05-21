'use client'
import {
  AlertTriangle, CheckCircle2, ChevronRight, GitBranch, Github,
  Loader2, RefreshCw, Terminal, XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/bertos/cn'

interface RepoStatus {
  root: string
  daemonCwd: string
  branch: string
  remote: string
  status: string
  safeRepo: boolean
  blockedReason?: string
}

interface RunResult { stdout: string; stderr: string; exitCode: number; error?: string }

async function runCmd(cmd: string): Promise<RunResult> {
  const res = await fetch('/api/local-daemon/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: cmd }),
  })
  if (!res.ok) return { stdout: '', stderr: '', exitCode: 1, error: `HTTP ${res.status}` }
  return res.json()
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', ok ? 'bg-emerald-400' : 'bg-red-500')} />
}

export function GitHubView() {
  const [repo, setRepo] = useState<RepoStatus | null>(null)
  const [daemonOnline, setDaemonOnline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [log, setLog] = useState<string>('')
  const [branches, setBranches] = useState<string[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [branchLoading, setBranchLoading] = useState(false)
  const [runOutput, setRunOutput] = useState<{ cmd: string; result: RunResult } | null>(null)
  const [runLoading, setRunLoading] = useState(false)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const [repoRes, daemonRes] = await Promise.allSettled([
        fetch('/api/local-daemon/repo/status', { cache: 'no-store' }),
        fetch('/api/local-daemon/status', { cache: 'no-store' }),
      ])
      if (repoRes.status === 'fulfilled' && repoRes.value.ok) {
        const d = await repoRes.value.json()
        setRepo(d.repo ?? null)
      }
      if (daemonRes.status === 'fulfilled' && daemonRes.value.ok) {
        const d = await daemonRes.value.json()
        setDaemonOnline(d.online ?? false)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLog = useCallback(async () => {
    setLogLoading(true)
    const r = await runCmd('git log --oneline -20')
    setLog(r.stdout || r.stderr || r.error || '(no output)')
    setLogLoading(false)
  }, [])

  const fetchBranches = useCallback(async () => {
    setBranchLoading(true)
    const r = await runCmd('git branch -a')
    setBranches((r.stdout || '').split('\n').map(l => l.trim()).filter(Boolean))
    setBranchLoading(false)
  }, [])

  const runGitCmd = useCallback(async (cmd: string) => {
    setRunLoading(true)
    setRunOutput(null)
    const result = await runCmd(cmd)
    setRunOutput({ cmd, result })
    setRunLoading(false)
    // refresh status after write commands
    if (cmd.startsWith('git fetch') || cmd.startsWith('git pull')) fetchStatus()
  }, [fetchStatus])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const safe = daemonOnline && repo?.safeRepo

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#09090B]">
      {/* Header */}
      <div className="border-b border-zinc-800/50 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <Github className="w-4 h-4 text-zinc-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-100">Git Repository</h1>
            <p className="text-xs text-zinc-500">Branch status, log, and safe read-only git ops via daemon</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <StatusDot ok={daemonOnline} />
            <span className="text-xs text-zinc-500">{daemonOnline ? 'Daemon online' : 'Daemon offline'}</span>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={fetchStatus} disabled={loading}>
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-3xl space-y-5">

          {/* Daemon offline banner */}
          {!daemonOnline && !loading && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-300">Local daemon is offline</p>
                <p className="text-xs text-amber-300/70 mt-1">Start it with <code className="font-mono bg-black/30 px-1 rounded">npm run bertos:daemon</code> to unlock git operations.</p>
              </div>
            </div>
          )}

          {/* Blocked repo banner */}
          {daemonOnline && repo && !repo.safeRepo && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-300">Repository blocked</p>
                <p className="text-xs text-red-300/70 mt-1">{repo.blockedReason ?? 'Remote safety check failed.'}</p>
              </div>
            </div>
          )}

          {/* Repo info */}
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading repo status…
            </div>
          ) : repo ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Repo Status</span>
                {safe
                  ? <Badge variant="success" className="ml-auto text-[9px]">Safe</Badge>
                  : <Badge variant="error" className="ml-auto text-[9px]">Blocked</Badge>
                }
              </div>
              <div className="grid grid-cols-2 gap-px bg-zinc-800/30">
                {[
                  { label: 'Branch', value: repo.branch },
                  { label: 'Remote', value: repo.remote || '—' },
                  { label: 'Root', value: repo.root },
                  { label: 'Status', value: repo.status || 'clean' },
                ].map(row => (
                  <div key={row.label} className="bg-zinc-950 px-4 py-3">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">{row.label}</p>
                    <p className="text-xs font-mono text-zinc-200 truncate" title={row.value}>{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-zinc-600">No repo status available.</div>
          )}

          {/* Commit log */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Commit Log</span>
              <Button
                size="sm" variant="ghost"
                className="ml-auto h-6 px-2 text-[10px]"
                onClick={fetchLog}
                disabled={!daemonOnline || logLoading}
              >
                {logLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load'}
              </Button>
            </div>
            {log ? (
              <pre className="p-4 text-[11px] font-mono text-zinc-400 whitespace-pre-wrap overflow-auto max-h-64">{log}</pre>
            ) : (
              <p className="p-4 text-xs text-zinc-700">Click Load to fetch the last 20 commits.</p>
            )}
          </div>

          {/* Branches */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Branches</span>
              <Button
                size="sm" variant="ghost"
                className="ml-auto h-6 px-2 text-[10px]"
                onClick={fetchBranches}
                disabled={!daemonOnline || branchLoading}
              >
                {branchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load'}
              </Button>
            </div>
            {branches.length > 0 ? (
              <div className="p-2 space-y-0.5 max-h-48 overflow-auto">
                {branches.map(b => (
                  <div key={b} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                    <ChevronRight className="w-3 h-3 text-zinc-700" />
                    <span className={cn(
                      'text-xs font-mono',
                      b.startsWith('*') ? 'text-violet-400 font-semibold' : 'text-zinc-400'
                    )}>{b}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-4 text-xs text-zinc-700">Click Load to list all branches.</p>
            )}
          </div>

          {/* Safe read-only ops */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/50">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Quick Git Actions</p>
              <p className="text-[10px] text-zinc-700 mt-0.5">Read-only and fetch operations only. Never auto-pushes.</p>
            </div>
            <div className="p-3 flex flex-wrap gap-2">
              {[
                { label: 'git status',     cmd: 'git status' },
                { label: 'git fetch',      cmd: 'git fetch --dry-run' },
                { label: 'git diff --stat',cmd: 'git diff --stat' },
                { label: 'git stash list', cmd: 'git stash list' },
                { label: 'git remote -v',  cmd: 'git remote -v' },
                { label: 'git tags',       cmd: 'git tag --sort=-creatordate | head -10' },
              ].map(({ label, cmd }) => (
                <Button
                  key={cmd}
                  size="sm"
                  variant="secondary"
                  className="h-7 text-[11px] font-mono"
                  onClick={() => runGitCmd(cmd)}
                  disabled={!safe || runLoading}
                >
                  {label}
                </Button>
              ))}
            </div>
            {runLoading && (
              <div className="px-4 pb-3 flex items-center gap-2 text-zinc-600 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Running…
              </div>
            )}
            {runOutput && (
              <div className="border-t border-zinc-800/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <code className="text-[10px] font-mono text-zinc-500">$ {runOutput.cmd}</code>
                  {runOutput.result.exitCode === 0
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400 ml-auto" />
                  }
                </div>
                <pre className="text-[11px] font-mono text-zinc-300 whitespace-pre-wrap max-h-48 overflow-auto">
                  {runOutput.result.stdout || runOutput.result.stderr || runOutput.result.error || '(empty)'}
                </pre>
              </div>
            )}
          </div>

          {/* Worktree note */}
          <div className="rounded-xl border border-zinc-800/50 bg-zinc-950 p-4">
            <p className="text-xs font-semibold text-zinc-500 mb-2">Worktree missions — planned</p>
            <ul className="space-y-1.5 text-xs text-zinc-700">
              <li>• Create isolated git worktree per mission</li>
              <li>• Run AI patch loop inside the worktree</li>
              <li>• Review diff before merge — never auto-push</li>
              <li>• Requires daemon worktree backend (future build pass)</li>
            </ul>
          </div>

        </div>
      </ScrollArea>
    </div>
  )
}
