import type { BertosSkillId } from '../skills/types'

export type BertosPluginId =
  | 'local-daemon'
  | 'workspace-bridge'
  | 'provider-router'
  | 'github-repo-local'
  | 'browser-skills'
  | 'telegram-control'
  | 'hermes-nous'
  | 'devin-external'
  | 'fcc-proxy'
  | 'qwen-experimental'
  | 'openclaw'
  | 'google-antigravity'
  | 'google-managed-agents'
  | 'hyperframes'
  | 'remotion'
  | 'youtube'
  | 'readwise'
  | 'gmail'
  | 'calendar'
  | 'buffer'
  | 'fal'
  | 'paper'
  | 'excalidraw'
  | 'browser'
  | 'filesystem'
  | 'memory'
  | 'outputs'

export type BertosPluginCategory =
  | 'core'
  | 'workspace'
  | 'providers'
  | 'repo'
  | 'qa'
  | 'messaging'
  | 'external-agent'
  | 'content'
  | 'migration'

export type BertosPluginStatus =
  | 'available'
  | 'requires-setup'
  | 'planned'
  | 'experimental'
  | 'paid-gated'
  | 'external-only'

export type BertosPluginSource =
  | 'internal'
  | 'local-daemon'
  | 'cli'
  | 'remote-api'
  | 'external-service'
  | 'planned-local'
  | 'planned-cloud'

export type BertosPluginCapability =
  | 'file-system'
  | 'terminal'
  | 'patch-apply'
  | 'git-status'
  | 'provider-routing'
  | 'chat'
  | 'browser-automation'
  | 'notifications'
  | 'remote-agent'
  | 'paid-routing'
  | 'video-render'
  | 'research'
  | 'copy-prompt'
  | 'approval-gate'

export type PluginSetupStatus = 'ready' | 'missing_credentials' | 'planned' | 'disabled'

export type PluginPermission =
  | 'read_external_sources'
  | 'send_email'
  | 'schedule_calendar'
  | 'publish'
  | 'use_paid_api'
  | 'generate_likeness'
  | 'run_local_tools'
  | 'read_local_files'
  | 'write_local_files'
  | 'delete_files'
  | 'overwrite_files'
  | 'write_outputs'
  | 'read_memory'
  | 'write_memory_proposals'

export type PluginToolRisk = 'safe' | 'approval-required' | 'blocked'

export interface BertosPluginDefinition {
  id: BertosPluginId
  name: string
  category: BertosPluginCategory
  status: BertosPluginStatus
  source: BertosPluginSource
  description: string
  bestUse: string
  capabilities: BertosPluginCapability[]
  relatedSkillIds: BertosSkillId[]
  ownedSurfaces: string[]
  requiredCommands: string[]
  requiredEnvVars: string[]
  canRunNow: string
  setupHint?: string
  docsUrl?: string
  canModifyFiles?: boolean
  canPushCode?: boolean
  canSpendMoney?: boolean
  requiresExplicitApproval?: boolean
  blockedActions: string[]
  safetyNotes: string[]
}

export interface PermissionGate {
  gateId: string
  action: string
  permission: PluginPermission | string
  status: 'allowed' | 'approval-required' | 'blocked' | 'open' | 'approved' | 'denied' | 'not-required'
  pluginId?: string
  reason?: string
  id?: string
  label?: string
  description?: string
  required?: boolean
}

export interface PluginTool {
  id: string
  name: string
  description: string
  risk: PluginToolRisk
  capabilities?: BertosPluginCapability[]
  requiredPermissions?: PermissionGate[]
  requiresExplicitApproval?: boolean
}

export interface PluginDefinition {
  id: BertosPluginId | string
  mention: `@${string}`
  name: string
  purpose: string
  credentialsRequired: string[]
  tools: PluginTool[]
  relatedSkills: string[]
  permissions: Array<PluginPermission | string>
  setupStatus: PluginSetupStatus
  safetyRules: string[]
  exampleUse: string
  degradedMode: string
}
