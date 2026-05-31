import { Award, Lock } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'

export function AchievementChip({
  title,
  description,
  unlocked,
  className,
}: {
  title: string
  description?: string
  unlocked?: boolean
  className?: string
}) {
  const Icon = unlocked ? Award : Lock
  return (
    <div
      title={description}
      className={cn(
        'inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px]',
        unlocked
          ? 'border-[rgba(212,180,131,0.30)] bg-[rgba(212,180,131,0.09)] text-[#D4B483]'
          : 'border-[rgba(60,48,32,0.70)] bg-[rgba(10,8,5,0.55)] text-[#5A4A2A]',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate font-medium">{title}</span>
    </div>
  )
}
