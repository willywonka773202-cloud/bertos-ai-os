'use client'

import { useMemo, useState } from 'react'
import { ClipboardCopy, ClipboardList, ShieldCheck, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PLAYBOOK_TEMPLATES } from '@/lib/bertos/command-center'
import { SelfCodingSafetyContract } from '@/components/bertos/shared/SelfCodingSafetyContract'

export function PlaybooksView() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(PLAYBOOK_TEMPLATES[0].id)
  const selected = useMemo(() => PLAYBOOK_TEMPLATES.find(playbook => playbook.id === selectedId) ?? PLAYBOOK_TEMPLATES[0], [selectedId])

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(selected.prompt)
    toast.success(`${selected.title} prompt copied.`)
  }

  return (
    <div className="flex h-full bg-[#0A0A0B]">
      <aside className="hidden w-72 shrink-0 border-r border-zinc-800/50 bg-zinc-950/70 md:block">
        <div className="border-b border-zinc-800/50 p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-violet-400" />
            <h1 className="text-sm font-semibold text-zinc-100">Playbooks</h1>
          </div>
          <p className="mt-1 text-xs text-zinc-600">Safe auto-triage foundations and copyable workflows.</p>
        </div>
        <ScrollArea className="h-[calc(100%-73px)]">
          <div className="space-y-2 p-3">
            {PLAYBOOK_TEMPLATES.map(playbook => (
              <button
                key={playbook.id}
                onClick={() => setSelectedId(playbook.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedId === playbook.id
                    ? 'border-violet-500/40 bg-violet-500/10'
                    : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-200">{playbook.title}</span>
                  <Badge variant={playbook.risk === 'safe' ? 'success' : 'warning'} className="text-[9px]">{playbook.risk}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] text-zinc-600">{playbook.description}</p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="mx-auto max-w-4xl space-y-5 p-6">
            <section className="rounded-2xl border border-zinc-800/50 bg-zinc-900/25 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <h2 className="text-xl font-bold text-zinc-100">{selected.title}</h2>
                  </div>
                  <p className="max-w-2xl text-sm leading-relaxed text-zinc-500">{selected.description}</p>
                </div>
                <Badge variant={selected.risk === 'safe' ? 'success' : 'warning'}>{selected.risk}</Badge>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/25 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-zinc-100">Steps</h3>
                </div>
                <div className="space-y-2">
                  {selected.steps.map((step, index) => (
                    <div key={step} className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[11px] font-semibold text-violet-300">{index + 1}</div>
                      <p className="text-sm text-zinc-400">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-800/50 bg-zinc-950 p-4">
                  <div className="text-sm font-semibold text-zinc-100">Best agent</div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">{selected.bestAgent}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {selected.requiredTools.map(tool => <Badge key={tool} variant="default" className="text-[10px]">{tool}</Badge>)}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="text-sm font-semibold text-amber-100">Execution policy</div>
                  <p className="mt-2 text-xs leading-relaxed text-amber-200/75">
                    These playbooks are templates only. They do not run autonomous actions, apply patches, merge code,
                    or call paid providers unless you explicitly route them through Builder or Agents.
                  </p>
                </div>
                <Button className="w-full" onClick={() => void copyPrompt()}>
                  <ClipboardCopy className="h-4 w-4" />Copy playbook prompt
                </Button>
                <Button className="w-full" variant="outline" onClick={() => router.push('/builder')}>
                  Use in Builder
                </Button>
              </div>
            </section>

            <SelfCodingSafetyContract compact />

            <section className="rounded-xl border border-zinc-800/50 bg-zinc-950 p-4">
              <div className="mb-2 text-sm font-semibold text-zinc-100">Prompt</div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black/40 p-3 text-xs leading-relaxed text-zinc-400">
                {selected.prompt}
              </pre>
            </section>
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}
