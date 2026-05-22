'use client'
import {
  AlertTriangle, CheckCircle2, GitBranch, GitCommit, Github,
  Loader2, RefreshCw, Shield, Terminal, XCircle, Clock,
  ChevronRight, Copy, Check,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

interface CommitEntry {
  hash: string
  message: string
  raw: string
}

interface RunResult { stdout: string; stderr: string; exitCode: number; error?: string }

async function runCmd(executable: string, args: string[]): Promise<RunResult> {
  const res = await fetch('/api/local-daemon/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ executable, args, timeoutMs: 30000 }),
  })
  if (!res.ok) return { stdout: '', stderr: '', exitCode: 1, error: `HTTP ${res.status}` }
  return res.json()
}

function parseCommits(raw: string): CommitEntry[] {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const spaceIdx = line.indexOf(' ')
      if (spaceIdx < 1) return { hash: line.slice(0, 8), message: line, raw: line }
      return {
        hash: line.slice(0, Math.min(spaceIdx, 8)),
        message: line.slice(spaceIdx + 1).trim(),
        raw: line,
      }
    })
}

function RepoOrb({ safe, daemonOnline, loading }: { safe: boolean; daemonOnline: boolean; loading: boolean }) {
  const color = loading ? '#71717A' : !daemonOnline ? '#F59E0B' : safe ? '#10B981' : '#EF4444'
  const glow = loading ? 'rgba(113,113,122,0.3)' : !daemonOnline ? 'rgba(245,158,11,0.4)' : safe ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'

  return (
    <div className="relative flex items-center justify-center w-16 h-16 flex-shrink-0">
      {!loading && (
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.15, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: `radial-gradient(circle, ${glow}, transparent)` }}
        />
      )}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center border-2 z-10"
        style={{ borderColor: `${color}60`, background: `${color}15` }}
      >
        {loading
          ? <Loader2 className="w-5 h-5 animate-spin" style={{ color }} />
          : !daemonOnline
            ? <AlertTriangle className="w-5 h-5" style={{ color }} />
            : safe
              ? <Shield className="w-5 h-5" style={{ color }} />
              : <XCircle className="w-5 h-5" style={{ color }} />
        }
      </div>
    </div>
  )
}

function StatTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'emerald' | 'violet' | 'amber' | 'red' }) {
  const colors = {
    emerald: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5',
    violet: 'text-violet-300 border-violet-500/20 bg-violet-500/5',
    amber: 'text-amber-300 border-amber-500/20 bg-amber-500/5',
    red: 'text-red-300 border-red-500/20 bg-red-500/5',
  }
  return (
    <div className={cn('rounded-xl border px-4 py-3 min-w-0', tone ? colors[tone] : 'border-zinc-800 bg-zinc-900/40')}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-0.5">{label}</p>
      <p className={cn('text-sm font-semibold truncate', tone ? '' : 'text-zinc-200')} title={value}>{value || '—'}</p>
      {sub && <p className="text-[10px] text-zinc-600 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

export function GitHubView() {
  const [repo, setRepo] = useState<RepoStatus | null>(null)
  const [daemonOnline, setDaemonOnline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [commits, setCommits] = useState<CommitEntry[]>([])
  const [branches, setBranches] = useState<string[]>([])
  const [logLoading, setLogLoading] = useState(false)
  const [branchLoading, setBranchLoading] = useState(false)
  const [runOutput, setRunOutput] = useState<{ cmd: string; result: RunResult } | null>(null)
  const [runLoading, setRunLoading] = useState(false)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

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
    const r = await runCmd('git', ['log', '--oneline', '-25'])
    if (r.stdout) setCommits(parseCommits(r.stdout))
    setLogLoading(false)
  }, [])

  const fetchBranches = useCallback(async () => {
    setBranchLoading(true)
    const r = await runCmd('git', ['branch', '-a'])
    setBranches((r.stdout || '').split('\n').map(l => l.trim()).filter(Boolean))
    setBranchLoading(false)
  }, [])

  const runGitCmd = useCallback(async (label: string, executable: string, args: string[]) => {
    setRunLoading(true)
    setRunOutput(null)
    const result = await runCmd(executable, args)
    setRunOutput({ cmd: label, result })
    setRunLoading(false)
    if (label.startsWith('git fetch') || label.startsWith('git pull')) void fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    if (daemonOnline) {
      void fetchLog()
      void fetchBranches()
    }
  }, [daemonOnline, fetchLog, fetchBranches])

  const safe = daemonOnline && (repo?.safeRepo ?? false)
  const statusLabel = !daemonOnline ? 'Daemon Offline' : !repo?.safeRepo ? 'Blocked' : (repo?.status?.includes('nothing to commit') ? 'Clean' : repo?.status ? 'Changes' : 'Clean')
  const statusTone = !daemonOnline ? 'amber' : !repo?.safeRepo ? 'red' : statusLabel === 'Clean' ? 'emerald' : 'amber'

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedHash(hash)
    setTimeout(() => setCopiedHash(null), 2000)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#09090B]">

      {/* Hero */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-zinc-800/50 bg-zinc-950/40">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-5 mb-5">
            <RepoOrb safe={safe} daemonOnline={daemonOnline} loading={loading} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Github className="w-4 h-4 text-zinc-400" />
                <h1 className="text-lg font-bold text-zinc-100 tracking-tight">Git Repository</h1>
                {safe && <Badge variant="success" className="text-[9px] h-4">Safe</Badge>}
                {!loading && !daemonOnline && <Badge variant="warning" className="text-[9px] h-4">Daemon Offline</Badge>}
                {!loading && daemonOnline && !repo?.safeRepo && <Badge variant="error" className="text-[9px] h-4">Blocked</Badge>}
              </div>
              <p className="text-xs text-zinc-500">
                {repo?.remote ? repo.remote : 'Branch status, commits, and safe read-only git ops via daemon'}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="ml-auto h-8 px-3 flex-shrink-0" onClick={() => { void fetchStatus(); void fetchLog(); void fetchBranches() }} disabled={loading}>
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              label="Branch"
              value={repo?.branch ?? '—'}
              tone="violet"
            />
            <StatTile
              label="Status"
              value={statusLabel}
              tone={statusTone as 'emerald' | 'violet' | 'amber' | 'red'}
            />
            <StatTile
              label="Commits"
              value={commits.length > 0 ? `${commits.length} loaded` : 'Click load'}
            />
            <StatTile
              label="Daemon"
              value={daemonOnline ? 'Online' : 'Offline'}
              sub={repo?.root ? repo.root.slice(-28) : undefined}
              tone={daemonOnline ? 'emerald' : 'amber'}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full max-w-5xl mx-auto flex flex-col xl:flex-row xl:divide-x divide-zinc-800/50">

          {/* Left: Commits + Output */}
          <div className="flex-1 min-w-0 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-4">

                {/* Alerts */}
                <AnimatePresence>
                  {!daemonOnline && !loading && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-300">Local daemon is offline</p>
                        <p className="text-xs text-amber-300/70 mt-0.5">
                          Start it with <code className="font-mono bg-black/30 px-1 rounded">npm run bertos:daemon</code>
                        </p>
                      </div>
                    </motion.div>
                  )}
                  {daemonOnline && repo && !repo.safeRepo && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3"
                    >
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-300">Repository blocked</p>
                        <p className="text-xs text-red-300/70 mt-0.5">{repo.blockedReason ?? 'Remote safety check failed.'}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Commit timeline */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
                    <GitCommit className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs font-semibold text-zinc-300">Recent Commits</span>
                    <span className="text-[10px] text-zinc-700 ml-1">(last 25)</span>
                    {logLoading && <Loader2 className="w-3 h-3 animate-spin text-zinc-600 ml-auto" />}
                    {!logLoading && (
                      <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-[10px]" onClick={() => void fetchLog()} disabled={!daemonOnline}>
                        Refresh
                      </Button>
                    )}
                  </div>

                  {commits.length === 0 && !logLoading ? (
                    <div className="px-4 py-8 text-center">
                      <GitCommit className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                      <p className="text-xs text-zinc-600">
                        {daemonOnline ? 'Loading commit history…' : 'Start the daemon to view commits.'}
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Timeline line */}
                      <div className="absolute left-[27px] top-0 bottom-0 w-px bg-zinc-800" />
                      <div className="py-2">
                        {commits.map((commit, i) => (
                          <motion.div
                            key={commit.hash}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.02 }}
                            className="flex items-start gap-3 px-4 py-2 hover:bg-white/3 transition-colors group"
                          >
                            {/* Dot */}
                            <div className="relative flex-shrink-0 w-6 h-6 flex items-center justify-center mt-0.5">
                              <div className={cn(
                                'w-2.5 h-2.5 rounded-full border-2 z-10',
                                i === 0
                                  ? 'border-violet-400 bg-violet-500/40'
                                  : 'border-zinc-600 bg-zinc-900'
                              )} />
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-zinc-300 leading-relaxed truncate">{commit.message}</p>
                            </div>
                            {/* Hash */}
                            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => copyHash(commit.hash)}
                                className="flex items-center gap-1 font-mono text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                              >
                                {copiedHash === commit.hash
                                  ? <Check className="w-3 h-3 text-emerald-400" />
                                  : <Copy className="w-3 h-3" />
                                }
                                {commit.hash}
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Command output */}
                <AnimatePresence>
                  {(runOutput || runLoading) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/50">
                        <Terminal className="w-3.5 h-3.5 text-zinc-600" />
                        {runOutput && (
                          <code className="text-[10px] font-mono text-zinc-500 flex-1 truncate">$ {runOutput.cmd}</code>
                        )}
                        {runLoading
                          ? <Loader2 className="w-3.5 h-3.5 text-zinc-600 animate-spin ml-auto" />
                          : runOutput && (
                            runOutput.result.exitCode === 0
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
                              : <XCircle className="w-3.5 h-3.5 text-red-400 ml-auto" />
                          )
                        }
                      </div>
                      {runOutput && (
                        <pre className="p-4 text-[11px] font-mono text-zinc-300 whitespace-pre-wrap overflow-auto max-h-52">
                          {runOutput.result.stdout || runOutput.result.stderr || runOutput.result.error || '(empty output)'}
                        </pre>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>

          {/* Right: Branches + Actions */}
          <div className="xl:w-72 xl:flex-shrink-0 border-t xl:border-t-0 border-zinc-800/50 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">

                {/* Branches */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-zinc-800/50 flex items-center gap-2">
                    <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-semibold text-zinc-300">Branches</span>
                    {branchLoading && <Loader2 className="w-3 h-3 animate-spin text-zinc-600 ml-auto" />}
                    {!branchLoading && (
                      <Button size="sm" variant="ghost" className="ml-auto h-5 px-1.5 text-[10px]" onClick={() => void fetchBranches()} disabled={!daemonOnline}>
                        Refresh
                      </Button>
                    )}
                  </div>
                  {branches.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-zinc-700 text-center">
                      {daemonOnline ? 'Loading branches…' : 'Daemon required'}
                    </p>
                  ) : (
                    <div className="py-1 max-h-52 overflow-auto">
                      {branches.map(b => {
                        const isCurrent = b.startsWith('*')
                        const name = isCurrent ? b.slice(1).trim() : b
                        return (
                          <div
                            key={b}
                            className={cn(
                              'flex items-center gap-2 px-3 py-1.5 transition-colors',
                              isCurrent ? 'bg-violet-500/8' : 'hover:bg-white/3'
                            )}
                          >
                            {isCurrent
                              ? <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                              : <ChevronRight className="w-3 h-3 text-zinc-700 flex-shrink-0" />
                            }
                            <span className={cn(
                              'text-xs font-mono truncate',
                              isCurrent ? 'text-violet-300 font-semibold' : 'text-zinc-500'
                            )}>
                              {name}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Quick git actions */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-zinc-800/50">
                    <p className="text-xs font-semibold text-zinc-300">Quick Git Actions</p>
                    <p className="text-[10px] text-zinc-700 mt-0.5">Read-only & fetch ops — never auto-pushes</p>
                  </div>
                  <div className="p-3 flex flex-col gap-1.5">
                    {[
                      { label: 'git status',       exe: 'git', args: ['status']                          },
                      { label: 'git diff --stat',  exe: 'git', args: ['diff', '--stat']                  },
                      { label: 'git fetch --dry',  exe: 'git', args: ['fetch', '--dry-run']              },
                      { label: 'git stash list',   exe: 'git', args: ['stash', 'list']                   },
                      { label: 'git remote -v',    exe: 'git', args: ['remote', '-v']                    },
                      { label: 'git tag --list',   exe: 'git', args: ['tag', '--sort=-creatordate']      },
                    ].map(({ label, exe, args }) => (
                      <button
                        key={label}
                        onClick={() => void runGitCmd(label, exe, args)}
                        disabled={!safe || runLoading}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all font-mono text-[11px] border',
                          safe && !runLoading
                            ? 'text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200 hover:bg-white/4'
                            : 'text-zinc-700 border-zinc-800/50 cursor-not-allowed'
                        )}
                      >
                        <Terminal className="w-3 h-3 flex-shrink-0" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Worktree roadmap */}
                <div className="rounded-xl border border-zinc-800/50 bg-zinc-950/60 p-3">
                  <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Planned: Worktree Missions</p>
                  <ul className="space-y-1 text-[11px] text-zinc-700">
                    <li>• Isolated git worktree per mission</li>
                    <li>• AI patch loop inside worktree</li>
                    <li>• Review diff before merge</li>
                    <li>• Never auto-push</li>
                  </ul>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  )
}
