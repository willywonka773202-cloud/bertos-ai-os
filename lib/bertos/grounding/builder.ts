import { searchMemory } from '../memory/registry'
import { searchOutputArtifacts } from '../outputs/registry'
import { makeRuntimeId, nowIso } from '../runtime-store'
import { saveGroundingPack } from './registry'
import type { GroundingPack, GroundingSource, GroundingSourceType } from './types'

function tokenEstimate(text: string) {
  return Math.max(1, Math.ceil(text.length / 4))
}

function source(
  input: Omit<GroundingSource, 'sourceId' | 'tokenEstimate' | 'staleStatus'> & { staleStatus?: GroundingSource['staleStatus'] },
): GroundingSource {
  return {
    ...input,
    sourceId: makeRuntimeId('groundsrc'),
    tokenEstimate: tokenEstimate(input.excerpt),
    staleStatus: input.staleStatus ?? 'unknown',
  }
}

export async function buildGroundingPack(options: {
  taskReason: string
  query: string
  project?: string
  client?: string
  sourceUrls?: string[]
  pastedSources?: Array<{ name: string; sourceType?: GroundingSourceType; sourceUrl?: string; excerpt: string; rightsUsageNotes?: string }>
  includeMemory?: boolean
  includeOutputs?: boolean
  limit?: number
  persist?: boolean
}): Promise<GroundingPack> {
  const sources: GroundingSource[] = []
  const limit = options.limit ?? 12

  for (const item of options.pastedSources ?? []) {
    sources.push(source({
      sourceType: item.sourceType ?? 'example',
      sourceName: item.name,
      sourceUrl: item.sourceUrl,
      excerpt: item.excerpt,
      relevanceScore: 80,
      rightsUsageNotes: item.rightsUsageNotes ?? 'User-provided grounding. Use for context; do not imply ownership beyond provided rights.',
      memoryScope: options.client ? 'client' : options.project ? 'project' : 'session',
      taskReason: options.taskReason,
      staleStatus: 'fresh',
    }))
  }

  for (const url of options.sourceUrls ?? []) {
    sources.push(source({
      sourceType: url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' : 'web',
      sourceName: url,
      sourceUrl: url,
      excerpt: `Source URL supplied for grounding: ${url}`,
      relevanceScore: 60,
      rightsUsageNotes: 'URL supplied for reference. Fetching or quoting depends on configured tools and copyright-safe limits.',
      memoryScope: 'session',
      taskReason: options.taskReason,
      staleStatus: 'unknown',
    }))
  }

  if (options.includeMemory !== false) {
    const records = await searchMemory({ q: options.query, project: options.project, client: options.client, limit: Math.max(3, Math.floor(limit / 2)) })
    for (const record of records) {
      sources.push(source({
        sourceType: record.client ? 'client' : record.project ? 'project' : 'memory',
        sourceName: record.title,
        sourceUrl: record.sourceRef,
        excerpt: record.content,
        relevanceScore: 70,
        rightsUsageNotes: `Local BertOS memory, confidence=${record.confidence}, sensitivity=${record.sensitivity}.`,
        memoryScope: record.client ? 'client' : record.project ? 'project' : 'global',
        taskReason: options.taskReason,
        staleStatus: 'unknown',
      }))
    }
  }

  if (options.includeOutputs !== false) {
    const outputs = await searchOutputArtifacts({ query: options.query, project: options.project, client: options.client, limit: Math.max(3, Math.floor(limit / 2)) })
    for (const output of outputs) {
      sources.push(source({
        sourceType: 'output',
        sourceName: output.title,
        sourceUrl: output.files[0]?.path,
        excerpt: output.summary ?? `${output.type} output with tags: ${output.tags.join(', ')}`,
        relevanceScore: 55,
        rightsUsageNotes: 'Previous BertOS output. Reuse only when project/client scope matches.',
        memoryScope: output.client ? 'client' : output.project ? 'project' : 'global',
        taskReason: options.taskReason,
        staleStatus: 'unknown',
      }))
    }
  }

  const selected = sources
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit)

  const pack: GroundingPack = {
    groundingPackId: makeRuntimeId('ground'),
    project: options.project,
    client: options.client,
    query: options.query,
    taskReason: options.taskReason,
    sources: selected,
    createdAt: nowIso(),
    tokenEstimate: selected.reduce((sum, item) => sum + item.tokenEstimate, 0),
    staleStatus: selected.some(item => item.staleStatus === 'stale') ? 'stale' : 'unknown',
  }

  if (options.persist === false) return pack
  return saveGroundingPack(pack)
}

export function enforceGroundingSourceLinks(pack: GroundingPack) {
  const missing = pack.sources.filter(source => ['youtube', 'readwise', 'web'].includes(source.sourceType) && !source.sourceUrl)
  return {
    ok: missing.length === 0,
    missing,
    message: missing.length ? 'Grounded external content requires source URLs.' : 'Grounding sources include required links.',
  }
}
