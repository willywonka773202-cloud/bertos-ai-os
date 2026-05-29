export type PublishingQueueStatus = 'idea' | 'drafted' | 'reviewed' | 'scheduled' | 'published' | 'archived'

export interface PublishingPlatformVariant {
  caption: string
  notes?: string
  sourceLinks?: string[]
}

export interface PublishingQueueItem {
  queueItemId: string
  idea: string
  caption: string
  platformVariants: Record<string, string | PublishingPlatformVariant>
  status: PublishingQueueStatus
  approvalRequired: boolean
  sourceOutputIds: string[]
  createdAt: string
  updatedAt?: string
  scheduledFor?: string
  approvedAt?: string
  approvalReason?: string
}
