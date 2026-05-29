'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Bot,
  Brain,
  CalendarDays,
  ClipboardCopy,
  ExternalLink,
  Film,
  Github,
  KanbanSquare,
  Library,
  Network,
  ShieldCheck,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/bertos/cn'
import {
  HERMES_POWER_LANES,
  HERMES_POWER_PROMPTS,
  HERMES_POWER_SOURCES,
  buildHermesOperatingSystemPrompt,
  type HermesPowerStatus,
} from '@/lib/bertos/hermes-power-pack'
import { ChamberCard } from '@/components/bertos/hermes/ChamberCard'
import { useUIStore } from '@/store/bertos/ui'

const STATUS_VARIANT: Record<HermesPowerStatus, 'success' | 'warning' | 'default' | 'error'> = {
  live: 'success',
  'copy-prompt': 'warning',
  planned: 'default',
  'paid-gated': 'error',
}

const LANE_ICONS: Record<string, ReactNode> = {
  'memory-soul': <Brain className="h-4 w-4" />,
  'goal-loop': <Target className="h-4 w-4" />,
  'background-brief': <CalendarDays className="h-4 w-4" />,
  'model-pantheon': <Network className="h-4 w-4" />,
  'agent-swarm': <KanbanSquare className="h-4 w-4" />,
  'research-content': <Library className="h-4 w-4" />,
  'video-studio': <Film className="h-4 w-4" />,
  'snapshot-backup': <Github className="h-4 w-4" />,
}

export function HermesPowerPanel() {
  const router = useRouter()
  const { setActiveView } = useUIStore()
  const [selectedPromptId, setSelectedPromptId] = useState(HERMES_POWER_PROMPTS[0]?.id ?? '')
  const selectedPrompt = useMemo(
    () => HERMES_POWER_PROMPTS.find(prompt => prompt.id === selectedPromptId) ?? HERMES_POWER_PROMPTS[0],
    [selectedPromptId],
  )

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied.`)
  }

  const openRoute = (route: string) => {
    const view =
      route === '/memory' ? 'memory' :
      route === '/prompts' ? 'prompts' :
      route === '/brief' ? 'brief' :
      route === '/compare' ? 'compare' :
      route === '/agents' ? 'agents' :
      route === '/playbooks' ? 'playbooks' :
      route === '/github' ? 'github' :
      route === '/coding' || route === '/builder' ? 'coding' :
      'dashboard'
    setActiveView(view)
    router.push(route)
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[#E8DDB8]">
            <Bot className="h-5 w-5 text-[#D4B483]" />
            Hermes Power Pack
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-[#5A4A2A]">
            Source-backed operating lanes from the Hermes videos, guarded by BertOS safety gates and honest setup states.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void copyText(buildHermesOperatingSystemPrompt(), 'Operating system prompt')}
        >
          <ClipboardCopy className="h-3.5 w-3.5" />
          OS Prompt
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <ChamberCard tone="bronze" className="p-0">
          <div className="grid gap-3 md:grid-cols-2">
            {HERMES_POWER_LANES.map(lane => (
              <div key={lane.id} className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(8,7,5,0.62)] p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(212,180,131,0.22)] bg-[rgba(212,180,131,0.08)] text-[#D4B483]">
                    {LANE_ICONS[lane.id] ?? <Sparkles className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-100">{lane.title}</h3>
                      <Badge variant={STATUS_VARIANT[lane.status]} className="text-[9px]">
                        {lane.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{lane.useFor}</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-[11px] leading-relaxed text-zinc-600">
                  <div><span className="text-zinc-400">Why:</span> {lane.whyItMatters}</div>
                  <div><span className="text-amber-200/75">Gate:</span> {lane.safety}</div>
                  <div><span className="text-cyan-200/75">Next:</span> {lane.nextStep}</div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] text-zinc-700">{lane.source}</span>
                  <Button size="sm" variant="ghost" onClick={() => openRoute(lane.route)}>
                    Open
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ChamberCard>

        <div className="space-y-4">
          <ChamberCard tone="cyan" eyebrow="copy prompt launcher" title="Power Prompt">
            <div className="space-y-2">
              {HERMES_POWER_PROMPTS.map(prompt => (
                <button
                  key={prompt.id}
                  onClick={() => setSelectedPromptId(prompt.id)}
                  className={cn(
                    'w-full rounded-lg border p-2 text-left transition',
                    selectedPrompt?.id === prompt.id
                      ? 'border-cyan-300/30 bg-cyan-300/10'
                      : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-zinc-200">{prompt.title}</span>
                    <Badge variant="default" className="text-[9px]">{prompt.category}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-zinc-600">{prompt.description}</p>
                </button>
              ))}
            </div>
            {selectedPrompt && (
              <div className="mt-3 rounded-lg border border-zinc-800 bg-black/30 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-zinc-200">{selectedPrompt.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selectedPrompt.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="rounded border border-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-600">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => void copyText(selectedPrompt.content, selectedPrompt.title)}>
                    <ClipboardCopy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 font-mono text-[10px] leading-relaxed text-zinc-500">
                  {selectedPrompt.content}
                </pre>
              </div>
            )}
          </ChamberCard>

          <ChamberCard tone="zinc" eyebrow="research basis" title="Resources Checked">
            <div className="space-y-2">
              {HERMES_POWER_SOURCES.map(source => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 transition hover:border-zinc-700"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                    <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                    {source.label}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">{source.note}</p>
                </a>
              ))}
            </div>
          </ChamberCard>

          <ChamberCard tone="bronze">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <p className="text-xs leading-relaxed text-zinc-500">
                The power path is memory first, then goals, background briefs, role-based swarms, source-grounded content, and verified creative pipelines. Paid providers and unverified tools stay gated.
              </p>
            </div>
          </ChamberCard>
        </div>
      </div>
    </section>
  )
}
