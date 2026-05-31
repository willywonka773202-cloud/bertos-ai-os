'use client'
import { useEffect, useState } from 'react'
import { ArrowRight, Bot, Check, Cloud, FolderGit2, HardDrive, Rocket, ShieldCheck, Sparkles, Terminal } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'
import { getJson } from './types'

interface Step {
  done: boolean
  title: string
  body: string
  icon: typeof Bot
  cta?: { label: string; href: string }
  tone: 'cyan' | 'amber' | 'emerald' | 'violet' | 'bronze'
}

export function OnboardingView() {
  const [projects, setProjects] = useState(0)
  const [providerOnline, setProviderOnline] = useState<boolean | null>(null)
  const [readiness, setReadiness] = useState<any>(null)

  useEffect(() => {
    void getJson<{ projects: unknown[] }>('/api/bertos/projects').then(d => setProjects(d.projects?.length ?? 0))
    void getJson<{ anyOnline: boolean }>('/api/bertos/coding/assistant').then(d => setProviderOnline(Boolean(d.anyOnline)))
    void getJson<{ readiness: any }>('/api/bertos/coding/readiness').then(d => setReadiness(d.readiness))
  }, [])

  const storage = readiness?.storage
  const steps: Step[] = [
    {
      done: true, icon: Sparkles, tone: 'cyan',
      title: 'Welcome to BertOS',
      body: 'A local-first, AI-native coding operating system. Register your repos, chat with a project-aware AI, forge patches behind approval, and keep every run, output, task, and decision in one sanctuary.',
    },
    {
      done: Boolean(storage), icon: storage?.durable ? HardDrive : Cloud, tone: 'bronze',
      title: 'Storage',
      body: storage
        ? `${storage.notes}${storage.warning ? ` ⚠️ ${storage.warning}` : ''}`
        : 'Local-first by default — data persists under data/bertos on your machine. Hosted deployments use ephemeral storage until a durable adapter is configured.',
      cta: { label: 'View readiness', href: '/settings' },
    },
    {
      done: providerOnline === true, icon: Bot, tone: 'violet',
      title: 'Connect an AI provider',
      body: providerOnline
        ? 'A provider is online — the AI Command Center will use it.'
        : 'No provider online yet. BertOS still works in local deterministic mode. Configure Ollama (local), Claude/Codex CLI, Gemini, or a Hermes endpoint — keys live in env only, never in memory.',
      cta: { label: 'Configure providers', href: '/settings' },
    },
    {
      done: projects > 0, icon: FolderGit2, tone: 'amber',
      title: 'Register your first project',
      body: projects > 0 ? `${projects} project(s) registered.` : 'Point BertOS at a local repo. Path safety is enforced and sensitive paths are rejected.',
      cta: { label: 'Open Cockpit', href: '/cockpit' },
    },
    {
      done: false, icon: Terminal, tone: 'cyan',
      title: 'Run your first action',
      body: 'In the Cockpit, ask the AI Command Center to "Explain this repo" or run the Explain workflow. It creates a grounded output, a run with lane logs, and (when useful) memory proposals.',
      cta: { label: 'Go to Cockpit', href: '/cockpit' },
    },
    {
      done: false, icon: ShieldCheck, tone: 'emerald',
      title: 'Understand the safety model',
      body: 'Patch applies, git push, deploys, deletions, paid APIs, and durable memory writes all require explicit approval at the Guardian Gates. Commands are allowlisted; sensitive files are blocked.',
      cta: { label: 'Approval Center', href: '/approvals' },
    },
  ]

  const completed = steps.filter(s => s.done).length

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
        <RouteHero
          eyebrow="first run"
          title="Get started with BertOS"
          subtitle="A six-step setup to turn BertOS into your daily AI coding OS. Local-first, safe by default, honest about what is and isn't configured."
          seal={<Rocket className="h-5 w-5" />}
          status="active"
          metrics={[
            { label: 'Setup', value: `${completed}/${steps.length}`, detail: 'steps complete', tone: completed >= 4 ? 'emerald' : 'amber' },
            { label: 'Mode', value: readiness?.auth?.hostedMode ? 'hosted demo' : 'local', detail: 'runtime', tone: 'cyan' },
            { label: 'Provider', value: providerOnline === null ? '…' : providerOnline ? 'online' : 'local', detail: 'AI engine', tone: providerOnline ? 'emerald' : 'amber' },
            { label: 'Storage', value: storage?.durable ? 'durable' : 'ephemeral', detail: storage?.mode ?? '…', tone: storage?.durable ? 'emerald' : 'amber' },
          ]}
        />

        {readiness?.auth?.hostedMode && (
          <ChamberCard tone="amber" className="mb-4 p-3 text-sm text-amber-200">
            <strong>Hosted demo mode.</strong> {readiness.auth.note} Use local mode for private repos.
          </ChamberCard>
        )}

        <div className="space-y-3">
          {steps.map((step, i) => (
            <ChamberCard key={step.title} tone={step.tone}>
              <div className="flex items-start gap-3">
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${step.done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 bg-black/30 text-zinc-500'}`}>
                  {step.done ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">Step {i + 1}</span>
                    <h3 className="text-sm font-semibold text-zinc-100">{step.title}</h3>
                    {step.done && <Badge variant="success">done</Badge>}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">{step.body}</p>
                  {step.cta && (
                    <a href={step.cta.href} className="mt-2 inline-flex">
                      <Button size="sm" variant="secondary">{step.cta.label} <ArrowRight className="h-3.5 w-3.5" /></Button>
                    </a>
                  )}
                </div>
              </div>
            </ChamberCard>
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          <a href="/cockpit"><Button><Terminal className="h-4 w-4" /> Enter the Cockpit</Button></a>
        </div>
      </div>
    </ScrollArea>
  )
}
