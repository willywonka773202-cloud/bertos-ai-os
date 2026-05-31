'use client'

import { Bot, Compass, Cpu, Sparkles, Zap } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/bertos/cn'
import { getPrimaryAgentEngines, type AgentEngineId } from '@/lib/bertos/agent-engines'
import { useUIStore } from '@/store/bertos/ui'

const ENGINE_ICONS: Record<AgentEngineId, typeof Sparkles> = {
  bertos: Sparkles,
  codex: Zap,
  claude: Cpu,
  gemini: Compass,
  'gemini-native': Compass,
  ollama: Bot,
  hermes: Sparkles,
  openclaw: Bot,
  qwen: Bot,
  openai: Zap,
}

const ENGINE_LOGOS: Partial<Record<AgentEngineId, string>> = {
  codex: '/brand-icons/codex.svg',
  claude: '/brand-icons/claude.svg',
  gemini: '/brand-icons/gemini.svg',
  ollama: '/brand-icons/ollama.svg',
  hermes: '/brand-icons/hermes.svg',
}

const ENGINES = getPrimaryAgentEngines()

export function EngineTopNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const setActiveView = useUIStore(state => state.setActiveView)

  return (
    <nav aria-label="Agent engines" className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-wrap items-center gap-1 py-1">
        {ENGINES.map(engine => {
          const Icon = ENGINE_ICONS[engine.id]
          const active = pathname === engine.route || pathname.startsWith(`${engine.route}/`)
          return (
            <button
              key={engine.id}
              type="button"
              title={engine.label}
              onClick={() => {
                setActiveView('agents')
                router.push(engine.route)
              }}
              className={cn(
                'group flex h-8 shrink-0 items-center gap-2 rounded-lg border px-2.5 text-xs transition',
                !active && 'hover:-translate-y-px',
                compact && 'px-2',
              )}
              style={{
                borderColor: active ? engine.theme.border : 'rgba(255,255,255,0.08)',
                background: active ? engine.theme.surface2 : 'rgba(255,255,255,0.035)',
                color: active ? engine.theme.text : engine.theme.muted,
                boxShadow: active ? `0 0 24px ${engine.theme.shadow}` : undefined,
              }}
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[10px] font-black"
                style={{
                  borderColor: engine.theme.border,
                  background: `linear-gradient(135deg, ${engine.theme.accent}22, ${engine.theme.accent2}18)`,
                  color: engine.theme.accent,
                }}
              >
                {ENGINE_LOGOS[engine.id] ? (
                  <img src={ENGINE_LOGOS[engine.id]} alt="" className="h-5 w-5 rounded-[5px]" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </span>
              <span className={cn('font-semibold', compact && 'hidden sm:inline')}>{engine.shortLabel}</span>
              {engine.paidGated && (
                <span
                  className="rounded border px-1 py-0.5 text-[8px] font-semibold uppercase"
                  style={{ borderColor: engine.theme.border, color: engine.theme.accent }}
                >
                  paid
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
