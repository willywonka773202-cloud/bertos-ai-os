import type { PermissionGate, PluginDefinition } from '../plugins/types'
import type { OutputArtifact } from '../outputs/types'
import type { RuntimeSkillDefinition } from '../skills/types'
import type { AgentRun } from '../workflows/types'
import type { MemoryProposal } from '../memory/types'

export interface ParsedSkillInvocation {
  raw: string
  command: string
  args: Record<string, string | boolean>
  pluginMentions: string[]
  inputText: string
}

export interface SkillInvocationRunInput {
  text: string
  skillId?: string
  project?: string
  client?: string
  approvedPermissions?: string[]
  dryRun?: boolean
}

export interface SkillInvocationRunResult {
  invocation: ParsedSkillInvocation
  skill: RuntimeSkillDefinition
  plugins: PluginDefinition[]
  permissionGates: PermissionGate[]
  setupWarnings: string[]
  agentRun: AgentRun
  output: OutputArtifact
  memoryProposal?: MemoryProposal
}
