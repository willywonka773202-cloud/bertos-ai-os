import type { MemoryConfidence, MemoryKind, MemorySensitivity, MemorySource } from '../types'

export interface MarkdownMemoryRecord {
  id: string
  kind: MemoryKind
  title: string
  content: string
  scope: 'global' | 'project' | 'client' | 'session'
  project?: string
  client?: string
  source: MemorySource
  sourceRef?: string
  confidence: MemoryConfidence
  sensitivity: MemorySensitivity
  tags: string[]
  filePath?: string
  createdAt: string
  updatedAt: string
}

export type MemoryProposalRiskFlag =
  | 'secret-blocked'
  | 'private-content'
  | 'private-inbox'
  | 'untrusted-import'
  | 'unverified-claim'
  | 'client-scoped'
  | 'project-scoped'
  | 'needs-source-review'
  | 'safe'

export interface MemoryProposal {
  proposalId: string
  kind: MemoryKind
  title: string
  proposedContent: string
  /**
   * Backward-compatible alias used by existing UI/API consumers.
   * New code should prefer proposedContent.
   */
  content: string
  scope: 'global' | 'project' | 'client' | 'session'
  project?: string
  client?: string
  source: MemorySource
  sourceRef?: string
  confidence: MemoryConfidence
  sensitivity: MemorySensitivity
  tags: string[]
  reason: string
  riskFlags: MemoryProposalRiskFlag[]
  targetFile: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  reviewedAt?: string
  reviewedBy?: string
}
