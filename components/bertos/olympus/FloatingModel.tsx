import type { CSSProperties } from 'react'
import { cn } from '@/lib/bertos/cn'

export type FloatingModelVariant =
  | 'orb'
  | 'wingedHelmet'
  | 'caduceus'
  | 'marbleBust'
  | 'column'
  | 'goldenRing'
  | 'neuralCube'
  | 'scroll'
  | 'laurel'
  | 'tablet'

export function FloatingModel({
  variant,
  className,
  delay = 0,
  speed = 1,
  size = 'md',
}: {
  variant: FloatingModelVariant
  className?: string
  delay?: number
  speed?: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const sizeClass = {
    sm: 'h-20 w-20',
    md: 'h-28 w-28',
    lg: 'h-40 w-40',
    xl: 'h-56 w-56',
  }[size]

  return (
    <div
      className={cn('olympus-model pointer-events-none absolute', sizeClass, className)}
      style={{ '--model-delay': `${delay}s`, '--model-speed': String(speed) } as CSSProperties}
      aria-hidden="true"
    >
      <div className={cn('olympus-model__body', `olympus-model--${variant}`)}>
        {variant === 'wingedHelmet' && (
          <>
            <span className="helmet-wing helmet-wing--left" />
            <span className="helmet-wing helmet-wing--right" />
            <span className="helmet-crown" />
          </>
        )}
        {variant === 'caduceus' && (
          <>
            <span className="caduceus-staff" />
            <span className="caduceus-serpent caduceus-serpent--one" />
            <span className="caduceus-serpent caduceus-serpent--two" />
            <span className="caduceus-wings" />
          </>
        )}
        {variant === 'marbleBust' && (
          <>
            <span className="bust-head" />
            <span className="bust-neck" />
            <span className="bust-base" />
          </>
        )}
        {variant === 'column' && (
          <>
            <span className="column-cap column-cap--top" />
            <span className="column-shaft" />
            <span className="column-cap column-cap--bottom" />
          </>
        )}
        {variant === 'goldenRing' && (
          <>
            <span className="ring ring--one" />
            <span className="ring ring--two" />
            <span className="ring-core" />
          </>
        )}
        {variant === 'neuralCube' && (
          <>
            <span className="cube-face cube-face--front" />
            <span className="cube-face cube-face--side" />
            <span className="cube-face cube-face--top" />
          </>
        )}
        {variant === 'scroll' && (
          <>
            <span className="scroll-rod scroll-rod--left" />
            <span className="scroll-paper" />
            <span className="scroll-rod scroll-rod--right" />
          </>
        )}
        {variant === 'laurel' && (
          <>
            <span className="laurel-arc laurel-arc--left" />
            <span className="laurel-arc laurel-arc--right" />
            <span className="laurel-core" />
          </>
        )}
        {variant === 'tablet' && (
          <>
            <span className="tablet-face" />
            <span className="tablet-line tablet-line--one" />
            <span className="tablet-line tablet-line--two" />
            <span className="tablet-line tablet-line--three" />
          </>
        )}
      </div>
    </div>
  )
}
