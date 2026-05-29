'use client'

import { useMemo, useState } from 'react'
import {
  Bot,
  Brain,
  ClipboardCopy,
  ExternalLink,
  KanbanSquare,
  MessageSquare,
  Play,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/bertos/cn'
import {
  HERMES_POWER_LANES,
  HERMES_POWER_PROMPTS,
  HERMES_POWER_SOURCES,
  buildHermesOperatingSystemPrompt,
  type HermesPowerPrompt,
} from '@/lib/bertos/hermes-power-pack'
import { useUIStore } from '@/store/bertos/ui'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'

function buildInitialValues(prompt: HermesPowerPrompt) {
  return Object.fromEntries(prompt.variables.map(variable => [variable, '']))
}

function compilePrompt(prompt: HermesPowerPrompt, values: Record<string, string>) {
  return prompt.variables.reduce((content, variable) => {
    const value = values[variable]?.trim() || `[${variable}]`
    return content.replace(new RegExp(`{{${variable}}}`, 'g'), value)
  }, prompt.content)
}

export function HermesPowerView() {
  const router = useRouter()
  const { selectedModel, setActiveView, setPendingAgentTask } = useUIStore()
  const [selectedPromptId, setSelectedPromptId] = useState(HERMES_POWER_PROMPTS[0]?.id ?? '')
  const selectedPrompt = useMemo(
    () => HERMES_POWER_PROMPTS.find(prompt => prompt.id === selectedPromptId) ?? HERMES_POWER_PROMPTS[0],
    [selectedPromptId],
  )
  const [valuesByPrompt, setValuesByPrompt] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(HERMES_POWER_PROMPTS.map(prompt => [prompt.id, buildInitialValues(prompt)])),
  )

  const values = valuesByPrompt[selectedPrompt.id] ?? buildInitialValues(selectedPrompt)
  const compiledPrompt = useMemo(() => compilePrompt(selectedPrompt, values), [selectedPrompt, values])
  const filledCount = selectedPrompt.variables.filter(variable => values[variable]?.trim()).length
  const ready = selectedPrompt.variables.length === 0 || filledCount === selectedPrompt.variables.length

  const updateValue = (variable: string, value: string) => {
    setValuesByPrompt(current => ({
      ...current,
      [selectedPrompt.id]: {
        ...(current[selectedPrompt.id] ?? buildInitialValues(selectedPrompt)),
        [variable]: value,
      },
    }))
  }

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(compiledPrompt)
    toast.success('Hermes prompt copied.')
  }

  const launchChat = () => {
    try {
      window.localStorage.setItem('bertos-chat-draft', compiledPrompt)
    } catch {
      void navigator.clipboard.writeText(compiledPrompt)
      toast.warning('Could not stage chat draft. Prompt copied instead.')
      return
    }
    setActiveView('chat')
    router.push('/chat')
    toast.success('Prompt launched in Oracle.')
  }

  const stageAgentTask = () => {
    setPendingAgentTask({
      title: selectedPrompt.title,
      description: compiledPrompt.slice(0, 1000),
    })
    setActiveView('agents')
    router.push('/agents')
    toast.success('Agent task staged.')
  }

  const copyOperatingSystemPrompt = async () => {
    await navigator.clipboard.writeText(buildHermesOperatingSystemPrompt())
    toast.success('Operating system prompt copied.')
  }

  const openLane = (route: string) => {
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
    <div className="flex h-full min-h-0 overflow-hidden">
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full min-h-0">
          <div className="mx-auto max-w-6xl space-y-5 p-6">
            <RouteHero
              eyebrow="hermes operating system"
              title="Hermes Power Agent"
              subtitle="A usable control room for memory, super goals, morning briefs, model routing, swarms, content factory, video setup, and backup planning. Unverified tools stay setup-gated."
              status="nominal"
              seal={<Bot className="h-5 w-5" />}
              metrics={[
                { label: 'Lanes', value: HERMES_POWER_LANES.length, detail: 'operating paths', tone: 'cyan' },
                { label: 'Power Prompts', value: HERMES_POWER_PROMPTS.length, detail: 'ready to run', tone: 'bronze' },
                { label: 'Selected', value: selectedPrompt.title, detail: ready ? 'ready' : `${filledCount}/${selectedPrompt.variables.length} filled`, tone: ready ? 'emerald' : 'amber' },
                { label: 'Provider', value: selectedModel, detail: 'chat target', tone: 'zinc' },
              ]}
            />

            <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
              <ChamberCard tone="bronze" eyebrow="operating lanes" title="Power Lanes">
                <div className="grid gap-3 md:grid-cols-2">
                  {HERMES_POWER_LANES.map(lane => (
                    <button
                      key={lane.id}
                      onClick={() => openLane(lane.route)}
                      className="rounded-xl border border-[rgba(212,180,131,0.12)] bg-[rgba(8,7,5,0.62)] p-3 text-left transition hover:border-[rgba(212,180,131,0.28)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-zinc-100">{lane.title}</h3>
                          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-zinc-500">{lane.useFor}</p>
                        </div>
                        <Badge variant={lane.status === 'planned' ? 'default' : lane.status === 'paid-gated' ? 'error' : 'warning'} className="text-[9px]">
                          {lane.status}
                        </Badge>
                      </div>
                      <p className="mt-3 line-clamp-2 text-[11px] leading-relaxed text-amber-100/60">{lane.safety}</p>
                    </button>
                  ))}
                </div>
              </ChamberCard>

              <ChamberCard tone="cyan" eyebrow="prompt forge" title="Build A Hermes Action">
                <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    {HERMES_POWER_PROMPTS.map(prompt => (
                      <button
                        key={prompt.id}
                        onClick={() => setSelectedPromptId(prompt.id)}
                        className={cn(
                          'w-full rounded-lg border p-3 text-left transition',
                          selectedPrompt.id === prompt.id
                            ? 'border-cyan-300/35 bg-cyan-300/10'
                            : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700',
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

                  <div className="space-y-3">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                      <div className="mb-3 flex items-center gap-2">
                        <Wand2 className="h-4 w-4 text-cyan-300" />
                        <h3 className="text-sm font-semibold text-zinc-100">{selectedPrompt.title}</h3>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedPrompt.variables.map(variable => (
                          <label key={variable} className="space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{variable}</span>
                            <textarea
                              value={values[variable] ?? ''}
                              onChange={event => updateValue(variable, event.target.value)}
                              placeholder={`Enter ${variable}`}
                              rows={variable === 'sources' || variable === 'knownInputs' || variable === 'repoNotes' ? 5 : 3}
                              className="w-full resize-y rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 text-xs leading-relaxed text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-cyan-300/30"
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800 bg-black/35 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-zinc-200">Compiled prompt</span>
                        <Badge variant={ready ? 'success' : 'warning'} className="text-[9px]">
                          {ready ? 'ready' : 'draft'}
                        </Badge>
                      </div>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-500">
                        {compiledPrompt}
                      </pre>
                    </div>
                  </div>
                </div>
              </ChamberCard>
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <ChamberCard tone="zinc" eyebrow="research basis" title="Resources">
                <div className="grid gap-2 md:grid-cols-2">
                  {HERMES_POWER_SOURCES.map(source => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 transition hover:border-zinc-700"
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
                    This workspace launches prompts and stages tasks. It does not call Hermes, publish content, render video, or write backup files until those connectors are explicitly configured and approved.
                  </p>
                </div>
              </ChamberCard>
            </section>
          </div>
        </ScrollArea>
      </main>

      <aside className="hidden min-h-0 w-[292px] shrink-0 border-l border-zinc-200 bg-[#F8F5EE] text-zinc-950 shadow-[-20px_0_60px_rgba(0,0,0,0.25)] xl:flex xl:flex-col">
        <div className="border-b border-zinc-200 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-[#F8F5EE]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Hermes Rail</h2>
              <p className="text-[11px] text-zinc-500">Light column controls</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Current action</div>
            <div className="mt-2 text-sm font-semibold">{selectedPrompt.title}</div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">{selectedPrompt.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {selectedPrompt.tags.map(tag => (
                <span key={tag} className="rounded-md bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-600">{tag}</span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Readiness</span>
              <span className={cn('h-2 w-2 rounded-full', ready ? 'bg-emerald-500' : 'bg-amber-500')} />
            </div>
            <div className="mt-2 text-2xl font-bold">{filledCount}/{selectedPrompt.variables.length}</div>
            <p className="mt-1 text-xs text-zinc-600">Required fields filled</p>
          </div>

          <div className="space-y-2">
            <Button className="w-full border-zinc-950 bg-zinc-950 text-white hover:bg-zinc-800" onClick={launchChat}>
              <MessageSquare className="h-4 w-4" />Run in Chat
            </Button>
            <Button className="w-full border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100" variant="outline" onClick={stageAgentTask}>
              <KanbanSquare className="h-4 w-4" />Stage Agent Task
            </Button>
            <Button className="w-full border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100" variant="outline" onClick={() => void copyPrompt()}>
              <ClipboardCopy className="h-4 w-4" />Copy Prompt
            </Button>
            <Button className="w-full border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100" variant="outline" onClick={() => void copyOperatingSystemPrompt()}>
              <Play className="h-4 w-4" />Copy OS Prompt
            </Button>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Brain className="h-4 w-4 text-amber-700" />
              <span className="text-xs font-semibold text-amber-950">Best first move</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-900">
              Start with soul.md, then run one Super Goal. That gives Hermes enough stable context to make the rest of the system useful.
            </p>
          </div>
        </div>
      </aside>
    </div>
  )
}
