'use client'

import { AIIntegrationOrbit } from './AIIntegrationOrbit'
import { FloatingModel, type FloatingModelVariant } from './FloatingModel'
import { OlympusThreeField } from './OlympusThreeField'
import { ParticleField } from './ParticleField'

export type MythicStageVariant =
  | 'home'
  | 'dashboard'
  | 'agents'
  | 'terminal'
  | 'files'
  | 'settings'
  | 'memory'
  | 'automation'
  | 'generic'

const STAGE_MODELS: Record<MythicStageVariant, Array<{ variant: FloatingModelVariant; className: string; size: 'sm' | 'md' | 'lg' | 'xl'; delay: number; speed: number }>> = {
  home: [
    { variant: 'wingedHelmet', className: 'left-[7%] top-[12%]', size: 'lg', delay: 0.2, speed: 1.1 },
    { variant: 'goldenRing', className: 'right-[8%] top-[16%]', size: 'xl', delay: 1.1, speed: 0.8 },
    { variant: 'column', className: 'left-[2%] bottom-[9%]', size: 'lg', delay: 0.8, speed: 1.3 },
    { variant: 'neuralCube', className: 'right-[17%] bottom-[13%]', size: 'md', delay: 1.6, speed: 1.0 },
  ],
  dashboard: [
    { variant: 'goldenRing', className: 'right-[10%] top-[12%]', size: 'xl', delay: 0.4, speed: 0.8 },
    { variant: 'wingedHelmet', className: 'left-[8%] top-[18%]', size: 'lg', delay: 1.0, speed: 1.2 },
    { variant: 'caduceus', className: 'right-[4%] bottom-[16%]', size: 'lg', delay: 1.8, speed: 1.1 },
    { variant: 'column', className: 'left-[3%] bottom-[11%]', size: 'lg', delay: 0.7, speed: 1.5 },
  ],
  agents: [
    { variant: 'marbleBust', className: 'left-[8%] top-[14%]', size: 'lg', delay: 0.6, speed: 1.0 },
    { variant: 'neuralCube', className: 'right-[12%] top-[17%]', size: 'lg', delay: 1.2, speed: 0.9 },
    { variant: 'laurel', className: 'right-[6%] bottom-[12%]', size: 'md', delay: 1.9, speed: 1.4 },
    { variant: 'orb', className: 'left-[17%] bottom-[12%]', size: 'md', delay: 0.1, speed: 1.2 },
  ],
  terminal: [
    { variant: 'caduceus', className: 'right-[8%] top-[14%]', size: 'xl', delay: 0.1, speed: 0.9 },
    { variant: 'tablet', className: 'left-[7%] top-[22%]', size: 'lg', delay: 0.9, speed: 1.1 },
    { variant: 'goldenRing', className: 'right-[20%] bottom-[11%]', size: 'lg', delay: 1.6, speed: 0.7 },
    { variant: 'neuralCube', className: 'left-[16%] bottom-[14%]', size: 'md', delay: 2.1, speed: 1.2 },
  ],
  files: [
    { variant: 'scroll', className: 'left-[8%] top-[18%]', size: 'lg', delay: 0.4, speed: 1.1 },
    { variant: 'tablet', className: 'right-[8%] top-[16%]', size: 'lg', delay: 1.3, speed: 1.0 },
    { variant: 'column', className: 'right-[4%] bottom-[9%]', size: 'xl', delay: 0.9, speed: 1.6 },
    { variant: 'goldenRing', className: 'left-[16%] bottom-[13%]', size: 'md', delay: 1.7, speed: 0.8 },
  ],
  settings: [
    { variant: 'goldenRing', className: 'left-[8%] top-[14%]', size: 'xl', delay: 0.1, speed: 0.7 },
    { variant: 'tablet', className: 'right-[8%] top-[18%]', size: 'lg', delay: 1.4, speed: 1.0 },
    { variant: 'laurel', className: 'left-[18%] bottom-[12%]', size: 'md', delay: 2.0, speed: 1.2 },
    { variant: 'caduceus', className: 'right-[6%] bottom-[12%]', size: 'lg', delay: 0.8, speed: 1.1 },
  ],
  memory: [
    { variant: 'marbleBust', className: 'right-[8%] top-[16%]', size: 'lg', delay: 0.2, speed: 1.0 },
    { variant: 'scroll', className: 'left-[9%] top-[19%]', size: 'lg', delay: 1.0, speed: 1.2 },
    { variant: 'laurel', className: 'right-[17%] bottom-[13%]', size: 'md', delay: 1.7, speed: 1.1 },
    { variant: 'orb', className: 'left-[17%] bottom-[11%]', size: 'md', delay: 2.1, speed: 1.3 },
  ],
  automation: [
    { variant: 'neuralCube', className: 'left-[7%] top-[16%]', size: 'lg', delay: 0.3, speed: 0.9 },
    { variant: 'goldenRing', className: 'right-[9%] top-[13%]', size: 'xl', delay: 1.0, speed: 0.7 },
    { variant: 'caduceus', className: 'left-[14%] bottom-[12%]', size: 'md', delay: 1.7, speed: 1.2 },
    { variant: 'tablet', className: 'right-[8%] bottom-[13%]', size: 'lg', delay: 0.8, speed: 1.1 },
  ],
  generic: [
    { variant: 'orb', className: 'right-[12%] top-[16%]', size: 'lg', delay: 0.2, speed: 1.1 },
    { variant: 'column', className: 'left-[4%] bottom-[10%]', size: 'lg', delay: 1.0, speed: 1.4 },
    { variant: 'goldenRing', className: 'left-[10%] top-[19%]', size: 'md', delay: 1.8, speed: 0.8 },
    { variant: 'neuralCube', className: 'right-[17%] bottom-[12%]', size: 'md', delay: 0.6, speed: 1.1 },
  ],
}

export function Mythic3DStage({ variant = 'generic' }: { variant?: MythicStageVariant }) {
  const models = STAGE_MODELS[variant] ?? STAGE_MODELS.generic

  return (
    <div className={`olympus-stage olympus-stage--${variant}`} aria-hidden="true">
      <div className="olympus-cosmos" />
      <div className="olympus-marble-noise" />
      <OlympusThreeField variant={variant} />
      <ParticleField count={34} />
      <div className="olympus-grid-depth" />
      <div className="olympus-greek-key olympus-greek-key--top" />
      <div className="olympus-greek-key olympus-greek-key--bottom" />
      <div className="olympus-light-sweep" />
      <div className="olympus-constellation">
        <span className="constellation-line constellation-line--one" />
        <span className="constellation-line constellation-line--two" />
        <span className="constellation-line constellation-line--three" />
        <span className="constellation-dot constellation-dot--one" />
        <span className="constellation-dot constellation-dot--two" />
        <span className="constellation-dot constellation-dot--three" />
        <span className="constellation-dot constellation-dot--four" />
      </div>
      <div className="absolute right-[6%] top-[22%] hidden opacity-70 xl:block">
        <AIIntegrationOrbit compact />
      </div>
      {models.map((model, index) => (
        <FloatingModel key={`${model.variant}-${index}`} {...model} />
      ))}
    </div>
  )
}
