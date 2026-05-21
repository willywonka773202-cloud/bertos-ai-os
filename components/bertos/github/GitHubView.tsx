'use client'
import {
  AlertTriangle, BookOpen, GitBranch, Github, Loader2, RefreshCw,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

export function GitHubView() {
  const [checked, setChecked] = useState(false)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#09090B]">
      <div className="border-b border-zinc-800/50 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <Github className="w-4.5 h-4.5 text-zinc-300" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-100">GitHub</h1>
            <p className="text-xs text-zinc-500">Repo management, branches, issues, PRs, and worktrees</p>
          </div>
          <Badge variant="warning" className="ml-auto text-[10px]">Scaffolded — backend pending</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl space-y-6">

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-300 mb-1">GitHub integration is scaffolded</p>
                <p className="text-xs text-amber-300/70 leading-relaxed">
                  The UI structure and API routes are scaffolded. Full backend implementation
                  (repo list, branch management, PR creation, issue tracking, worktree execution)
                  is pending a future build pass.
                </p>
                <p className="text-xs text-amber-300/50 mt-2">
                  No fake success. No fake data. This shows honest scaffold state.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {[
              { icon: GitBranch, title: 'Repo list', desc: 'View cloned repos, branch status, and remote info', status: 'planned' },
              { icon: BookOpen,  title: 'Issues & PRs', desc: 'Browse open issues and pull requests', status: 'planned' },
              { icon: GitBranch, title: 'Branch management', desc: 'Create, switch, and delete branches', status: 'planned' },
              { icon: RefreshCw, title: 'Worktree execution', desc: 'Run missions in isolated git worktrees', status: 'planned' },
            ].map(item => (
              <div key={item.title} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <item.icon className="w-4 h-4 text-zinc-600" />
                  <span className="text-sm font-medium text-zinc-300">{item.title}</span>
                  <Badge variant="default" className="ml-auto text-[10px]">{item.status}</Badge>
                </div>
                <p className="text-xs text-zinc-600">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs font-semibold text-zinc-400 mb-2">Worktree concept (scaffolded)</p>
            <ul className="space-y-1.5 text-xs text-zinc-600">
              <li>• Create isolated task folder (git worktree)</li>
              <li>• Branch per mission — isolate risky changes</li>
              <li>• Run mission inside worktree, review diff</li>
              <li>• Commit locally, then optionally push/PR</li>
              <li>• Never auto-push — always manual approval</li>
            </ul>
            <p className="mt-3 text-[11px] text-zinc-700 italic">
              Worktree execution scaffolded, not enabled. Requires daemon worktree backend.
            </p>
          </div>

          <div className="text-center">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setChecked(true)}
              disabled={checked}
            >
              {checked ? <span className="text-emerald-400">Noted ✓</span> : (
                <><Loader2 className="w-3.5 h-3.5 opacity-50" /> Coming in a future build pass</>
              )}
            </Button>
          </div>

        </div>
      </ScrollArea>
    </div>
  )
}
