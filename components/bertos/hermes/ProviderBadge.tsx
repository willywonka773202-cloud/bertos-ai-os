import { Bot, Cpu, Globe, Lock, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { getModelLabel } from '@/lib/bertos/router'

function providerTone(model: string) {
  if (model.includes('gemini')) return 'border-blue-300/25 bg-blue-300/10 text-blue-200'
  if (model.includes('claude')) return 'border-violet-300/25 bg-violet-300/10 text-violet-200'
  if (model.includes('codex') || model.includes('openai')) return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200'
  if (model.includes('hermes')) return 'border-amber-300/25 bg-amber-300/10 text-amber-200'
  if (model === 'auto') return 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200'
  return 'border-orange-300/25 bg-orange-300/10 text-orange-200'
}

function providerIcon(model: string) {
  if (model === 'auto') return <Sparkles className="h-3.5 w-3.5" />
  if (model.includes('gemini')) return <Globe className="h-3.5 w-3.5" />
  if (model.includes('claude')) return <Cpu className="h-3.5 w-3.5" />
  if (model.includes('codex') || model.includes('openai')) return <Zap className="h-3.5 w-3.5" />
  if (model.includes('hermes')) return <Lock className="h-3.5 w-3.5" />
  return <Bot className="h-3.5 w-3.5" />
}

export function ProviderBadge({
  model,
  label,
  disabled = false,
  className,
}: {
  model: string
  label?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        providerTone(model),
        disabled && 'opacity-55 grayscale',
        className,
      )}
    >
      {providerIcon(model)}
      {label ?? getModelLabel(model)}
    </span>
  )
}
