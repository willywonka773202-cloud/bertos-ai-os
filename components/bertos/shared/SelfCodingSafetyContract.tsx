'use client'

import { ShieldCheck } from 'lucide-react'
import { SELF_CODING_SAFETY_ITEMS } from '@/lib/bertos/command-center'
import { Badge } from '@/components/ui/badge'

interface SelfCodingSafetyContractProps {
  compact?: boolean
  className?: string
}

export function SelfCodingSafetyContract({ compact = false, className = '' }: SelfCodingSafetyContractProps) {
  const items = compact ? SELF_CODING_SAFETY_ITEMS.slice(0, 5) : SELF_CODING_SAFETY_ITEMS

  return (
    <section className={`rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-amber-300" />
        <h3 className="text-sm font-semibold text-amber-100">Self-coding safety contract</h3>
        <Badge variant="warning" className="text-[10px]">approval first</Badge>
      </div>
      <div className="grid gap-2 text-xs leading-relaxed text-amber-200/75 md:grid-cols-2">
        {items.map(item => (
          <div key={item} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/70" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
