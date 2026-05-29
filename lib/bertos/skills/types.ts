export type BertosSkillId =
  | 'context-pack-assembly'
  | 'mission-compiler'
  | 'workspace-patch-review'
  | 'provider-status-audit'
  | 'agent-team-handoff'
  | 'memory-capture'
  | 'content-factory'
  | 'source-grounded-research'
  | 'browser-route-smoke'
  | 'video-pipeline-planner'
  | 'telegram-control-gate'
  | 'youtube-researcher'
  | 'second-brain'
  | 'excalidraw-diagrams'
  | 'paper-canvas'
  | 'motion-graphics'
  | 'gen-media-studio'
  | 'inbox-deal-manager'
  | 'publishing-queue'

export type BertosSkillCategory =
  | 'workspace'
  | 'mission'
  | 'providers'
  | 'agents'
  | 'memory'
  | 'content'
  | 'research'
  | 'qa'
  | 'integrations'

export type BertosSkillStatus =
  | 'available'
  | 'requires-setup'
  | 'planned'
  | 'experimental'
  | 'paid-gated'
  | 'external-only'

export type BertosSkillExecutionMode =
  | 'local'
  | 'daemon'
  | 'copy-prompt'
  | 'external'
  | 'paid-api'
  | 'planned'

export type BertosSkillCapability =
  | 'context'
  | 'prompt-build'
  | 'patch-review'
  | 'file-write'
  | 'terminal'
  | 'provider-audit'
  | 'team-handoff'
  | 'memory-write'
  | 'content-draft'
  | 'research'
  | 'browser-smoke'
  | 'video-planning'
  | 'notifications'
  | 'approval-gate'

export interface BertosSkillDefinition {
  id: BertosSkillId
  name: string
  category: BertosSkillCategory
  status: BertosSkillStatus
  executionMode: BertosSkillExecutionMode
  description: string
  bestUse: string
  capabilities: BertosSkillCapability[]
  requiredTools: string[]
  ownedSurfaces: string[]
  relatedPlugins: string[]
  canRunNow: string
  requiresDaemon?: boolean
  requiresExplicitApproval?: boolean
  canModifyFiles?: boolean
  canSpendMoney?: boolean
  setupHint?: string
  safetyNotes: string[]
}

export type SkillMemoryAccess =
  | 'none'
  | 'read_core'
  | 'read_project'
  | 'read_project_write_proposals'
  | 'read_client_scoped_write_proposals'

export type SkillPermission =
  | 'read_external_sources'
  | 'read_memory'
  | 'write_outputs'
  | 'propose_memory'
  | 'run_local_tools'
  | 'use_paid_api'
  | 'send_email'
  | 'schedule_calendar'
  | 'publish'
  | 'delete_files'
  | 'overwrite_files'

export interface RuntimeSkillDefinition {
  id: string
  name: string
  version: string
  command: `/${string}`
  description: string
  requiredPlugins: string[]
  optionalPlugins: string[]
  defaultAgent: string
  outputTypes: string[]
  memoryAccess: SkillMemoryAccess
  permissions: SkillPermission[]
  approvalRequiredFor: string[]
  body: string
  source: 'built-in' | 'runtime'
  filePath?: string
  examples: string[]
  updatedAt?: string
}

export interface SkillPatchDraft {
  patchId: string
  skillId: string
  instruction: string
  currentVersion: string
  proposedVersion: string
  proposedMarkdown: string
  diffSummary: string[]
  createdAt: string
  status: 'draft' | 'approved' | 'rejected' | 'applied'
}

export type SkillDefinition = RuntimeSkillDefinition
