'use client'

import { useEffect, type ReactNode } from 'react'
import { Mythic3DStage, type MythicStageVariant } from './Mythic3DStage'
import { FloatingModel } from './FloatingModel'

export function OlympusShell({
  children,
  variant,
}: {
  children: ReactNode
  variant: MythicStageVariant
}) {
  useEffect(() => {
    const selector = 'button, [role="tab"], .olympus-live-control, input, textarea, select'
    let frame = 0

    const handlePointerMove = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>(selector)
      if (!target) return
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect()
        if (!rect.width || !rect.height) return
        const x = ((event.clientX - rect.left) / rect.width) * 100
        const y = ((event.clientY - rect.top) / rect.height) * 100
        const tiltX = (50 - y) / 9
        const tiltY = (x - 50) / 10
        target.style.setProperty('--olympus-control-x', `${Math.max(0, Math.min(100, x)).toFixed(1)}%`)
        target.style.setProperty('--olympus-control-y', `${Math.max(0, Math.min(100, y)).toFixed(1)}%`)
        target.style.setProperty('--olympus-tilt-x', `${tiltX.toFixed(2)}deg`)
        target.style.setProperty('--olympus-tilt-y', `${tiltY.toFixed(2)}deg`)
      })
    }

    const handlePointerLeave = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>(selector)
      if (!target) return
      target.style.removeProperty('--olympus-tilt-x')
      target.style.removeProperty('--olympus-tilt-y')
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerout', handlePointerLeave, { passive: true })
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerout', handlePointerLeave)
    }
  }, [])

  return (
    <div className="olympus-shell relative flex h-dvh overflow-hidden bg-[#05030A] text-[#F0EAD8]">
      <Mythic3DStage variant={variant} />
      <div className="olympus-control-aura" aria-hidden="true">
        <FloatingModel variant="goldenRing" size="sm" className="olympus-control-aura__model olympus-control-aura__model--one" delay={0.2} speed={0.9} />
        <FloatingModel variant="neuralCube" size="sm" className="olympus-control-aura__model olympus-control-aura__model--two" delay={1.1} speed={1.2} />
        <FloatingModel variant="laurel" size="sm" className="olympus-control-aura__model olympus-control-aura__model--three" delay={1.8} speed={1.0} />
      </div>
      <div className="relative z-10 flex min-h-0 flex-1">{children}</div>
    </div>
  )
}
