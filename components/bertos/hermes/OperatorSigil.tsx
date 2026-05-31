import { Shield } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'OP'
}

export function OperatorSigil({
  name,
  rank,
  size = 'md',
  className,
}: {
  name: string
  rank?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-2xl border border-[rgba(212,180,131,0.28)] bg-[rgba(212,180,131,0.08)] text-[#F0E8D0] shadow-[0_0_32px_rgba(212,180,131,0.12)]',
        size === 'sm' && 'h-9 w-9 text-xs',
        size === 'md' && 'h-12 w-12 text-sm',
        size === 'lg' && 'h-16 w-16 text-base',
        className,
      )}
      title={rank ? `${name} · ${rank}` : name}
    >
      <span className="absolute inset-1 rounded-xl border border-[rgba(122,188,214,0.14)]" />
      <Shield className="absolute h-4/5 w-4/5 text-[rgba(212,180,131,0.11)]" />
      <span className="relative font-semibold tracking-[0.18em]">{initials(name)}</span>
    </div>
  )
}
