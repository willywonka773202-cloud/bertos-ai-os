import type { CSSProperties } from 'react'
import { cn } from '@/lib/bertos/cn'

export type OlympusBrand = 'claude' | 'codex' | 'ollama' | 'hermes' | 'bertos'

type BrandMeta = {
  label: string
  role: string
  status: string
  asset?: string
  initials: string
  tone: string
}

export const OLYMPUS_BRANDS: Record<OlympusBrand, BrandMeta> = {
  bertos: {
    label: 'BERTOS Core',
    role: 'Divine Compute Interface',
    status: 'Core Awake',
    asset: '/icon.svg',
    initials: 'B',
    tone: '#F6C453',
  },
  claude: {
    label: 'Claude',
    role: 'Reasoning Oracle',
    status: 'Oracle Online',
    asset: '/brand-icons/claude.svg',
    initials: 'C',
    tone: '#D97757',
  },
  codex: {
    label: 'Codex',
    role: 'Code Architect',
    status: 'Compiling',
    asset: '/brand-icons/codex.svg',
    initials: '<>',
    tone: '#10B981',
  },
  ollama: {
    label: 'Ollama',
    role: 'Local Model Forge',
    status: 'Local',
    asset: '/brand-icons/ollama.svg',
    initials: 'O',
    tone: '#E8E6D8',
  },
  hermes: {
    label: 'Hermes',
    role: 'Messenger Core',
    status: 'Routing',
    asset: '/brand-icons/hermes.svg',
    initials: 'H',
    tone: '#8C5CFF',
  },
}

export function BrandSigil({
  brand,
  size = 'md',
  showLabel = false,
  status = false,
  className,
}: {
  brand: OlympusBrand
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showLabel?: boolean
  status?: boolean
  className?: string
}) {
  const meta = OLYMPUS_BRANDS[brand]
  const sizeClass = {
    xs: 'h-7 w-7',
    sm: 'h-9 w-9',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  }[size]

  return (
    <div
      className={cn('olympus-brand group/sigil inline-flex items-center gap-2.5', className)}
      style={{ '--brand-glow': meta.tone } as CSSProperties}
    >
      <span className={cn('olympus-brand__mark', sizeClass)} aria-hidden="true">
        {meta.asset ? (
          <img src={meta.asset} alt="" className="h-[72%] w-[72%] rounded-md object-contain" />
        ) : (
          <span className="font-mono text-[10px] font-black">{meta.initials}</span>
        )}
      </span>
      {showLabel && (
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-[#F0E8D0]">{meta.label}</span>
          <span className="block truncate text-[9px] uppercase tracking-[0.18em] text-[#9A8A68]">{meta.role}</span>
          {status && (
            <span className="mt-1 inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-[color:var(--brand-glow)]">
              <span className="h-1 w-1 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
              {meta.status}
            </span>
          )}
        </span>
      )}
    </div>
  )
}
