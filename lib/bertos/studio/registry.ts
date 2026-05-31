import { makeRuntimeId, nowIso, readJsonFile, runtimePath, writeJsonFile } from '../runtime-store'
import type { PublishingQueueItem } from '../publishing/types'
import type { StudioAsset } from './types'

const ASSETS_FILE = runtimePath('studio', 'assets.json')
const PUBLISHING_QUEUE_FILE = runtimePath('publishing', 'queue.json')

export async function listStudioAssets() {
  return readJsonFile<StudioAsset[]>(ASSETS_FILE, [])
}

export async function createStudioAsset(input: Partial<StudioAsset> & Pick<StudioAsset, 'type'>) {
  const asset: StudioAsset = {
    assetId: makeRuntimeId('asset'),
    type: input.type,
    prompt: input.prompt,
    model: input.model,
    provider: input.provider,
    sourceLinks: input.sourceLinks ?? [],
    files: input.files ?? [],
    preview: input.preview,
    favorite: input.favorite ?? false,
    collection: input.collection,
    status: input.status ?? 'generated',
    createdBy: input.createdBy ?? 'agent',
    metadata: input.metadata ?? {},
    createdAt: nowIso(),
  }
  const assets = await listStudioAssets()
  await writeJsonFile(ASSETS_FILE, [asset, ...assets])
  return asset
}

export async function updateStudioAsset(assetId: string, input: Partial<Pick<StudioAsset, 'favorite' | 'status' | 'collection' | 'preview' | 'metadata'>>) {
  const assets = await listStudioAssets()
  const existing = assets.find(asset => asset.assetId === assetId)
  if (!existing) throw new Error(`Studio asset not found: ${assetId}`)
  const updated: StudioAsset = {
    ...existing,
    favorite: input.favorite ?? existing.favorite,
    status: input.status ?? existing.status,
    collection: input.collection ?? existing.collection,
    preview: input.preview ?? existing.preview,
    metadata: input.metadata ? { ...existing.metadata, ...input.metadata } : existing.metadata,
  }
  await writeJsonFile(ASSETS_FILE, assets.map(asset => asset.assetId === assetId ? updated : asset))
  return updated
}

export async function listPublishingQueue() {
  return readJsonFile<PublishingQueueItem[]>(PUBLISHING_QUEUE_FILE, [])
}

export async function createPublishingQueueItem(input: {
  idea: string
  caption?: string
  platformVariants?: PublishingQueueItem['platformVariants']
  sourceOutputIds?: string[]
  approvalRequired?: boolean
}) {
  const now = nowIso()
  const item: PublishingQueueItem = {
    queueItemId: makeRuntimeId('pub'),
    idea: input.idea.trim(),
    caption: input.caption?.trim() || input.idea.trim(),
    platformVariants: input.platformVariants ?? {},
    status: 'idea',
    approvalRequired: input.approvalRequired ?? true,
    sourceOutputIds: input.sourceOutputIds ?? [],
    createdAt: now,
    updatedAt: now,
  }
  const queue = await listPublishingQueue()
  await writeJsonFile(PUBLISHING_QUEUE_FILE, [item, ...queue])
  return item
}

export async function updatePublishingQueueItem(
  queueItemId: string,
  input: Partial<Pick<PublishingQueueItem, 'idea' | 'caption' | 'platformVariants' | 'status' | 'approvalRequired' | 'sourceOutputIds' | 'scheduledFor'>> & {
    approved?: boolean
    approvalReason?: string
  },
) {
  const queue = await listPublishingQueue()
  const existing = queue.find(item => item.queueItemId === queueItemId)
  if (!existing) throw new Error(`Publishing queue item not found: ${queueItemId}`)
  if ((input.status === 'scheduled' || input.status === 'published') && (input.approved !== true || !input.approvalReason?.trim())) {
    throw new Error('Scheduling or publishing requires explicit approval and approvalReason.')
  }
  const updated: PublishingQueueItem = {
    ...existing,
    idea: input.idea?.trim() || existing.idea,
    caption: input.caption?.trim() || existing.caption,
    platformVariants: input.platformVariants ?? existing.platformVariants,
    status: input.status ?? existing.status,
    approvalRequired: input.status === 'published' || input.status === 'scheduled' ? false : input.approvalRequired ?? existing.approvalRequired,
    sourceOutputIds: input.sourceOutputIds ?? existing.sourceOutputIds,
    scheduledFor: input.scheduledFor ?? existing.scheduledFor,
    approvedAt: input.status === 'published' || input.status === 'scheduled' ? nowIso() : existing.approvedAt,
    approvalReason: input.approvalReason?.trim() ?? existing.approvalReason,
    updatedAt: nowIso(),
  }
  await writeJsonFile(PUBLISHING_QUEUE_FILE, queue.map(item => item.queueItemId === queueItemId ? updated : item))
  return updated
}
