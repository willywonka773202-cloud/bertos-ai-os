import type { MemoryConfidence, MemoryKind } from '../types'
import { containsSecret } from './safety'

export interface ProposeMemoryInput {
  projectSlug?: string
  kind: MemoryKind
  title: string
  content: string
  reason: string
  confidence?: MemoryConfidence
  sourceRunId?: string
  sourceOutputId?: string
  tags?: string[]
}

/**
 * Create a review-only memory proposal from a coding workflow/assistant run.
 * Never writes memory directly; secrets are blocked before proposing.
 * Returns the proposalId, or null if blocked/failed (best-effort).
 */
export async function proposeCodingMemory(input: ProposeMemoryInput): Promise<string | null> {
  if (containsSecret(input.content) || containsSecret(input.title)) {
    return null
  }
  try {
    const { createMemoryProposal } = await import('../memory/registry')
    const proposal = await createMemoryProposal({
      kind: input.kind,
      title: input.title.slice(0, 160),
      content: input.content.slice(0, 4000),
      scope: input.projectSlug ? 'project' : 'global',
      project: input.projectSlug,
      source: 'tool-output',
      sourceRef: input.sourceRunId ?? input.sourceOutputId,
      confidence: input.confidence ?? 'needs-review',
      tags: input.tags ?? ['coding-os'],
      reason: input.reason,
    })
    return (proposal as { proposalId?: string; id?: string })?.proposalId
      ?? (proposal as { id?: string })?.id
      ?? null
  } catch {
    return null
  }
}
