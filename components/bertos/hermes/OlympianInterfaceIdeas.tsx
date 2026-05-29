'use client'

import type { ReactNode } from 'react'
import {
  Bot,
  Code2,
  Columns3,
  Crown,
  Feather,
  FlaskConical,
  Landmark,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/bertos/cn'
import { HologramPanel } from './HologramPanel'
import { RomanDivider } from './RomanDivider'
import { StatusOrb } from './StatusOrb'

type OlympianIdea = {
  id: string
  title: string
  subtitle: string
  detail: string
  icon: ReactNode
  routeLabel: string
  onOpen: () => void
  tone: 'gold' | 'sky' | 'sage' | 'violet'
}

const toneStyles: Record<OlympianIdea['tone'], string> = {
  gold: 'border-[rgba(212,180,131,0.22)] bg-[rgba(212,180,131,0.055)] text-[#F0E8D0]',
  sky: 'border-[rgba(122,188,214,0.20)] bg-[rgba(122,188,214,0.05)] text-cyan-100',
  sage: 'border-emerald-300/18 bg-emerald-300/5 text-emerald-100',
  violet: 'border-violet-300/18 bg-violet-300/5 text-violet-100',
}

export function OlympianInterfaceIdeas({
  onOpenBuilder,
  onOpenWorkspace,
  onOpenAgents,
  onOpenEvolution,
}: {
  onOpenBuilder: () => void
  onOpenWorkspace: () => void
  onOpenAgents: () => void
  onOpenEvolution: () => void
}) {
  const ideas: OlympianIdea[] = [
    {
      id: 'temple-builder',
      title: 'Temple Builder',
      subtitle: 'A marble mission hall for compiling safe coding work.',
      detail: 'Pillared task stages, gold validation gates, and a central altar for the current patch mission.',
      icon: <Landmark className="h-5 w-5" />,
      routeLabel: 'Open Builder',
      onOpen: onOpenBuilder,
      tone: 'gold',
    },
    {
      id: 'seraph-workspace',
      title: 'Seraph Workspace',
      subtitle: 'An angelic file deck with guarded edit and patch review lanes.',
      detail: 'Winged side rails, bright diff halos, and explicit daemon safety seals before any write path.',
      icon: <Feather className="h-5 w-5" />,
      routeLabel: 'Open Workspace',
      onOpen: onOpenWorkspace,
      tone: 'sky',
    },
    {
      id: 'olympian-legion',
      title: 'Olympian Legion',
      subtitle: 'Agent teams presented as gods, heralds, architects, and sentries.',
      detail: 'Each team gets a crest, live/planned proof states, and a handoff path instead of vague availability.',
      icon: <Crown className="h-5 w-5" />,
      routeLabel: 'Open Agents',
      onOpen: onOpenAgents,
      tone: 'violet',
    },
    {
      id: 'oracle-ascension',
      title: 'Oracle Ascension',
      subtitle: 'Evolution Lab as a sunlit ascent from scan to reviewed patch.',
      detail: 'A vertical temple stair maps discover, plan, implement, review, and approve as visible stages.',
      icon: <Sun className="h-5 w-5" />,
      routeLabel: 'Open Evolution',
      onOpen: onOpenEvolution,
      tone: 'sage',
    },
  ]

  return (
    <HologramPanel tone="bronze" className="p-0">
      <div className="relative overflow-hidden p-4 md:p-5">
        <div className="pointer-events-none absolute inset-0 hermes-grid-fine opacity-20" />
        <div className="pointer-events-none absolute inset-x-10 top-0 h-40 bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgba(240,232,208,0.13),transparent_68%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 border-r border-[rgba(212,180,131,0.10)] bg-[linear-gradient(90deg,rgba(212,180,131,0.08),transparent)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 border-l border-[rgba(212,180,131,0.10)] bg-[linear-gradient(270deg,rgba(212,180,131,0.08),transparent)]" />

        <div className="relative z-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4">
              <OlympianSeal />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.34em] text-[rgba(212,180,131,0.76)]">
                  <span className="h-1 w-1 rotate-45 bg-current" />
                  interface pantheon
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-hermes-gradient md:text-2xl">
                  Olympian and Angelic BertOS Concepts
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#8A7860]">
                  More interface directions for the Greek temple structure: marble columns, wing-light rails, sacred proof seals, and route-specific command chambers that still reflect real BertOS state.
                </p>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-[10px] uppercase tracking-[0.18em] text-[#8A7860]">
              <div className="rounded-lg border border-[rgba(212,180,131,0.14)] bg-black/20 px-3 py-2">
                <Columns3 className="mx-auto mb-1 h-4 w-4 text-[#D4B483]" />
                pillars
              </div>
              <div className="rounded-lg border border-[rgba(122,188,214,0.16)] bg-black/20 px-3 py-2">
                <Feather className="mx-auto mb-1 h-4 w-4 text-cyan-100" />
                wings
              </div>
              <div className="rounded-lg border border-emerald-300/14 bg-black/20 px-3 py-2">
                <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-emerald-200" />
                proof
              </div>
            </div>
          </div>

          <RomanDivider label="concept routes" className="mt-5" />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {ideas.map(idea => (
              <button
                key={idea.id}
                onClick={idea.onOpen}
                className={cn(
                  'group relative overflow-hidden rounded-lg border p-4 text-left transition',
                  'hover:-translate-y-0.5 hover:border-[rgba(240,232,208,0.28)] hover:bg-[rgba(240,232,208,0.055)]',
                  toneStyles[idea.tone],
                )}
              >
                <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-30" />
                <span className="pointer-events-none absolute -top-10 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full bg-current opacity-[0.045] blur-xl" />
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-current/20 bg-black/20">
                    <span className="absolute inset-y-1 left-1 w-px bg-current/25" />
                    <span className="absolute inset-y-1 right-1 w-px bg-current/25" />
                    {idea.icon}
                  </div>
                  <StatusOrb state="idle" size="sm" />
                </div>
                <h3 className="text-sm font-semibold text-[#F0E8D0]">{idea.title}</h3>
                <p className="mt-1 text-xs font-medium text-[#C8B080]">{idea.subtitle}</p>
                <p className="mt-3 min-h-[4.5rem] text-xs leading-relaxed text-[#6A5A3A]">{idea.detail}</p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-current/70">
                    {idea.routeLabel}
                  </span>
                  <Sparkles className="h-3.5 w-3.5 opacity-60 transition group-hover:opacity-100" />
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="rounded-lg border border-[rgba(212,180,131,0.12)] bg-black/20 p-3">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[rgba(212,180,131,0.68)]">
                <ScrollText className="h-3.5 w-3.5" />
                next visual pass
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#7A684B]">
                Carry this style into route heroes: stronger temple silhouettes, slimmer sacred registers, clearer proof seals, and brighter celestial accents where actions are live.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={onOpenBuilder} className="gap-1.5 border border-[rgba(212,180,131,0.35)] bg-[rgba(212,180,131,0.10)] text-[#D4B483] hover:bg-[rgba(212,180,131,0.18)]">
                <Code2 className="h-3.5 w-3.5" />
                Build Mission
              </Button>
              <Button size="sm" variant="outline" onClick={onOpenAgents} className="gap-1.5">
                <Bot className="h-3.5 w-3.5" />
                Agent Pantheon
              </Button>
              <Button size="sm" variant="outline" onClick={onOpenEvolution} className="gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" />
                Evolve UI
              </Button>
            </div>
          </div>
        </div>
      </div>
    </HologramPanel>
  )
}

function OlympianSeal() {
  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <div className="absolute inset-0 rounded-full border border-[rgba(212,180,131,0.35)] bg-[rgba(212,180,131,0.07)] shadow-[0_0_34px_rgba(212,180,131,0.12)]" />
      <div className="absolute -left-3 top-5 h-6 w-8 rounded-l-full border-y border-l border-[rgba(122,188,214,0.28)]" />
      <div className="absolute -right-3 top-5 h-6 w-8 rounded-r-full border-y border-r border-[rgba(122,188,214,0.28)]" />
      <div className="absolute inset-2 rounded-full border border-[rgba(240,232,208,0.18)]" />
      <Landmark className="relative h-7 w-7 text-[#F0E8D0]" />
    </div>
  )
}
