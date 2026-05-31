export type GroundingSourceType =
  | 'youtube'
  | 'readwise'
  | 'memory'
  | 'output'
  | 'brand'
  | 'project'
  | 'client'
  | 'upload'
  | 'web'
  | 'example'
  | 'local-file'

export type GroundingStaleStatus = 'fresh' | 'aging' | 'stale' | 'unknown'

export interface GroundingSource {
  sourceId: string
  sourceType: GroundingSourceType
  sourceName: string
  sourceUrl?: string
  excerpt: string
  relevanceScore: number
  rightsUsageNotes: string
  memoryScope: 'global' | 'project' | 'client' | 'session'
  taskReason: string
  tokenEstimate: number
  staleStatus: GroundingStaleStatus
}

export interface GroundingPack {
  groundingPackId: string
  storagePath?: string
  project?: string
  client?: string
  query?: string
  taskReason: string
  sources: GroundingSource[]
  createdAt: string
  tokenEstimate: number
  staleStatus: GroundingStaleStatus
}

export interface GroundingPackListOptions {
  project?: string
  client?: string
  query?: string
  limit?: number
}
