'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCopy, Github, GitBranch, Loader2, RefreshCw, Terminal, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DaemonHealthBanner } from '@/components/bertos/shell/DaemonHealthBanner'
import { useDaemonHealth } from '@/hooks/useDaemonHealth'

interface RepoStatus {
  root?: string
  branch?: string
  remote?: string
  status?: string
  safeRepo?: boolean
  blockedReason?: string
}

interface CommandResult {
  stdout?: string
  stderr?: string
  exitCode?: number | null
  error?: string
}

const QUICK_ACTIONS = [
  'git status',
  'git diff --stat',
  'git log --oneline -20',
  'git remote -v',
  'git fetch --dry-run',
  'git stash list',
]

export function GitHubView() {
  const { health, loading: healthLoading, refresh: refreshHealth } = useDaemonHealth()
  const [repo, setRepo] = useState<RepoStatus | null>(null)
  const [loadingRepo, setLoadingRepo] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [output, setOutput] = useState<{ command: string; result: CommandResult } | null>(null)

  const refreshRepo = useCallback(async () => {
    setLoadingRepo(true)
    try {
      const res = await fetch('/api/local-daemon/repo/status', { cache: 'no-store' })
      const data = await res.json()
      setRepo(data.repo ?? data)
    } catch {
      setRepo(null)
    } finally {
      setLoadingRepo(false)
    }
  }, [])

  useEffect(() => {
    void refreshRepo()
  }, [refreshRepo])

  const runCommand = async (command: string) => {
    setRunning(command)
    setOutput(null)
    try {
      const res = await fetch('/api/local-daemon/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const result = await res.json() as CommandResult
      setOutput({ command, result })
      if (!res.ok || result.exitCode) toast.error(result.error || `${command} failed.`)
      else toast.success(`${command} completed.`)
    } finally {
      setRunning(null)
    }
  }

  const copyReport = async () => {
    const text = [
      'BertOS GitHub / Repo Report',
      `Branch: ${repo?.branch ?? 'unknown'}`,
      `Remote: ${repo?.remote ?? 'unknown'}`,
      `Safe repo: ${repo?.safeRepo ? 'yes' : 'no'}`,
      `Daemon: ${health?.daemonOnline ? 'online' : 'offline'}`,
      output ? `Last command: ${output.command}\n${output.result.stdout || output.result.stderr || output.result.error || ''}` : '',
    ].filter(Boolean).join('\n')
    await navigator.clipboard.writeText(text)
    toast.success('Repo report copied.')
  }

  const daemonOnline = Boolean(health?.daemonOnline)
  const safe = daemonOnline && Boolean(repo?.safeRepo)

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#09090B]">
      <div className="shrink-0 border-b border-zinc-800/50 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800">
            <Github className="h-4 w-4 text-zinc-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-100">GitHub / Repo Control</h1>
            <p className="text-xs text-zinc-500">Local repo health, remote safety, and read-only GitHub workflow checks. Never auto-pushes.</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant={safe ? 'success' : daemonOnline ? 'warning' : 'default'} className="text-[10px]">
              {safe ? 'safe repo' : daemonOnline ? 'blocked/unknown' : 'daemon offline'}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => { void refreshHealth(); void refreshRepo() }} disabled={healthLoading || loadingRepo}>
              <RefreshCw className={`h-3.5 w-3.5 ${healthLoading || loadingRepo ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-5xl space-y-5 p-6">
          <DaemonHealthBanner health={health} loading={healthLoading} onRefresh={refreshHealth} />

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-3 flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-semibold text-zinc-100">Repository status</h2>
              </div>
              {repo ? (
                <div className="grid gap-3 text-xs">
                  <InfoRow label="Branch" value={repo.branch ?? 'unknown'} />
                  <InfoRow label="Remote" value={repo.remote ?? 'unknown'} />
                  <InfoRow label="Root" value={repo.root ?? 'unknown'} />
                  <InfoRow label="Safe" value={repo.safeRepo ? 'yes' : 'no'} />
                  {repo.blockedReason && <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-red-300">{repo.blockedReason}</div>}
                </div>
              ) : (
                <p className="text-sm text-zinc-600">Repo status requires the local daemon.</p>
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-100">
                  <AlertTriangle className="h-4 w-4" />
                  Guardrails
                </div>
                <div className="space-y-1 text-xs leading-relaxed text-amber-200/75">
                  <p>No push, no merge, no destructive git commands.</p>
                  <p>Branch/worktree execution is scaffolded, not automatic.</p>
                  <p>Sylistly remotes are blocked by BertOS safety checks.</p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => void copyReport()}>
                <ClipboardCopy className="h-4 w-4" />Copy repo report
              </Button>
            </aside>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-zinc-100">Safe git actions</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map(command => (
                <Button
                  key={command}
                  size="sm"
                  variant="secondary"
                  onClick={() => void runCommand(command)}
                  disabled={!safe || Boolean(running)}
                  className="font-mono text-xs"
                >
                  {running === command ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {command}
                </Button>
              ))}
            </div>
            {!safe && (
              <p className="mt-3 text-xs text-zinc-600">
                Safe git actions require `npm run bertos:daemon` and the verified BertOS remote.
              </p>
            )}
          </section>

          {output && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-2 flex items-center gap-2">
                {(output.result.exitCode ?? 0) === 0 && !output.result.error
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  : <XCircle className="h-4 w-4 text-red-400" />}
                <code className="text-xs text-zinc-400">$ {output.command}</code>
                <Badge variant={(output.result.exitCode ?? 0) === 0 && !output.result.error ? 'success' : 'error'} className="ml-auto text-[10px]">
                  exit {output.result.exitCode ?? (output.result.error ? 1 : 0)}
                </Badge>
              </div>
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black/40 p-3 text-xs leading-relaxed text-zinc-400">
                {output.result.error || output.result.stderr || output.result.stdout || '(empty)'}
              </pre>
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-700">{label}</div>
      <div className="mt-1 break-all font-mono text-zinc-300">{value}</div>
    </div>
  )
}
