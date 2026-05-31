export type StudioAssetType = 'image' | 'video' | 'audio' | 'reference' | 'prompt' | 'thumbnail'
export type StudioAssetStatus = 'generated' | 'selected' | 'edited' | 'final'

export interface StudioAsset {
  assetId: string
  type: StudioAssetType
  prompt?: string
  model?: string
  provider?: string
  sourceLinks: string[]
  files: string[]
  preview?: string
  favorite: boolean
  collection?: string
  status: StudioAssetStatus
  createdBy: 'human' | 'agent'
  metadata: Record<string, unknown>
  createdAt: string
}

export type { PublishingPlatformVariant, PublishingQueueItem, PublishingQueueStatus } from '../publishing/types'
