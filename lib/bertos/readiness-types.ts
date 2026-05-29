export type PublishReadinessStatus = 'ready' | 'warning' | 'blocked' | 'info'

export interface PublishReadinessCheck {
  id: string
  title: string
  description: string
  status: PublishReadinessStatus
  detail: string
  actionHref?: string
  actionLabel?: string
}

export interface PublishReadinessSection {
  id: string
  title: string
  description: string
  checks: PublishReadinessCheck[]
}

export interface PublishReadinessSummary {
  score: number
  ready: number
  warning: number
  blocked: number
  info: number
  total: number
}

export interface PublishReadinessReport {
  ok: boolean
  generatedAt: string
  environment: {
    deployment: 'vercel' | 'local' | 'unknown'
    appUrl: string
    nodeEnv: string
    vercelUrl?: string
  }
  counts: {
    skills: number
    plugins: number
    readyPlugins: number
    outputs: number
    pendingMemoryProposals: number
  }
  summary: PublishReadinessSummary
  sections: PublishReadinessSection[]
}
