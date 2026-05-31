import { createMemoryProposal } from '../memory/registry'
import { createOutputArtifact } from '../outputs/registry'
import { evaluatePermissionGate, getPlugin, normalizePermissionName, resolvePluginMentions } from '../plugins/registry'
import type { PermissionGate, PluginDefinition } from '../plugins/types'
import { createAgentRun, saveAgentRun } from '../runs/registry'
import { getSkill } from '../skills/registry'
import { makeRuntimeId, nowIso } from '../runtime-store'
import type { AgentRunLane } from '../workflows/types'
import type { ParsedSkillInvocation, SkillInvocationRunInput, SkillInvocationRunResult } from './types'

function parseArgs(text: string) {
  const args: Record<string, string | boolean> = {}
  const pattern = /([a-zA-Z][\w-]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text))) {
    args[match[1]] = match[2] ?? match[3] ?? match[4] ?? true
  }
  return args
}

export function parseSkillInvocation(text: string, fallbackCommand?: string): ParsedSkillInvocation {
  const raw = text.trim()
  const command = raw.match(/\/[a-z0-9-]+/i)?.[0] ?? fallbackCommand
  if (!command) throw new Error('Invocation must include a slash command such as /youtube-researcher.')
  const pluginMentions = Array.from(new Set(raw.match(/@[a-z0-9-]+/gi) ?? []))
  const inputText = raw
    .replace(command, '')
    .replace(/@[a-z0-9-]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { raw, command, args: parseArgs(raw), pluginMentions, inputText }
}

async function resolvePlugins(skillPluginIds: string[], mentions: string[]) {
  const mentioned = await resolvePluginMentions(mentions.join(' '))
  const required = await Promise.all(skillPluginIds.map(id => getPlugin(id)))
  const byId = new Map<string, PluginDefinition>()
  for (const plugin of [...required, ...mentioned]) {
    if (plugin) byId.set(plugin.id, plugin)
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
}

function lane(role: string, inputContract: string, outputContract: string, resultSummary: string, errors: string[] = []): AgentRunLane {
  const now = nowIso()
  return {
    laneId: makeRuntimeId('lane'),
    role,
    inputContract,
    outputContract,
    status: errors.length ? 'failed' : 'completed',
    startedAt: now,
    completedAt: now,
    resultSummary,
    outputIds: [],
    errors,
  }
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

export async function runSkillInvocation(input: SkillInvocationRunInput): Promise<SkillInvocationRunResult> {
  const explicitSkill = input.skillId ? await getSkill(input.skillId) : null
  const invocation = parseSkillInvocation(input.text || explicitSkill?.command || '', explicitSkill?.command)
  const skill = explicitSkill ?? await getSkill(invocation.command)
  if (!skill) throw new Error(`Unknown skill command: ${invocation.command}`)

  const plugins = await resolvePlugins(skill.requiredPlugins, invocation.pluginMentions)
  const setupWarnings = plugins
    .filter(plugin => plugin.setupStatus !== 'ready')
    .map(plugin => `${plugin.mention} is ${plugin.setupStatus}; using degraded mode: ${plugin.degradedMode}`)
  const approved = new Set(input.approvedPermissions ?? [])
  const approvedCanonical = new Set(Array.from(approved).map(permission => normalizePermissionName(permission)))
  const permissionGates: PermissionGate[] = []
  for (const plugin of plugins) {
    for (const permission of plugin.permissions) {
      const canonical = normalizePermissionName(permission)
      permissionGates.push(evaluatePermissionGate({
        action: `invoke ${skill.command} with ${plugin.mention}`,
        permission,
        pluginId: plugin.id,
        approved: approved.has(permission) || approved.has(`${plugin.id}:${permission}`) || approvedCanonical.has(canonical) || approved.has(`${plugin.id}:${canonical}`),
      }))
    }
  }
  for (const permission of skill.approvalRequiredFor) {
    const canonical = normalizePermissionName(permission)
    permissionGates.push(evaluatePermissionGate({
      action: `invoke ${skill.command}`,
      permission,
      approved: approved.has(permission) || approvedCanonical.has(canonical),
    }))
  }

  const blocked = permissionGates.filter(gate => gate.status === 'blocked')
  const approvals = permissionGates.filter(gate => gate.status === 'approval-required')
  const agentRun = createAgentRun({
    title: `${skill.name} invocation`,
    skillIds: [skill.id],
    pluginIds: plugins.map(plugin => plugin.id),
    lanes: [
      lane('parse', 'Slash command plus @mentions.', 'Parsed command, args, and freeform input.', `Parsed ${invocation.command} with ${invocation.pluginMentions.length} plugin mention(s).`),
      lane('plugin-resolution', 'Skill required plugins and user @mentions.', 'Plugin setup and degraded-mode report.', setupWarnings.length ? setupWarnings.join(' ') : 'All resolved plugins are ready or local.'),
      lane('permission-review', 'Skill/plugin permissions.', 'Approval gates and blocked actions.', blocked.length ? blocked.map(gate => gate.reason).join(' ') : approvals.length ? `${approvals.length} action(s) require approval before execution.` : 'No risky action was executed.'),
    ],
    logs: [
      `Command: ${invocation.command}`,
      `Dry run: ${input.dryRun ? 'yes' : 'no'}`,
      ...setupWarnings,
      ...permissionGates.map(gate => `${gate.status}: ${gate.reason}`),
    ],
  })
  agentRun.status = blocked.length ? 'failed' : approvals.length ? 'needs-approval' : 'completed'
  agentRun.updatedAt = nowIso()

  const output = await createOutputArtifact({
    type: skill.outputTypes[0] ?? 'skill_invocation_report',
    title: `${skill.name} Invocation Report`,
    skillId: skill.id,
    pluginIds: plugins.map(plugin => plugin.id),
    agentRunId: agentRun.agentRunId,
    project: input.project,
    client: input.client,
    sourceLinks: unique(Object.values(invocation.args).map(value => typeof value === 'string' && /^https?:\/\//i.test(value) ? value : undefined)),
    tags: unique(['skill-run', skill.id, ...plugins.map(plugin => plugin.id)]),
    status: approvals.length ? 'draft' : blocked.length ? 'failed' : 'ready',
    content: [
      `# ${skill.name} Invocation Report`,
      '',
      `Command: ${invocation.command}`,
      `Agent: ${skill.defaultAgent}`,
      `Status: ${agentRun.status}`,
      '',
      '## Input',
      invocation.inputText || 'No freeform input.',
      '',
      '## Plugins',
      ...plugins.map(plugin => `- ${plugin.mention}: ${plugin.setupStatus}${plugin.setupStatus === 'ready' ? '' : ` (${plugin.degradedMode})`}`),
      '',
      '## Permission Gates',
      ...(permissionGates.length ? permissionGates.map(gate => `- ${gate.status}: ${gate.reason}`) : ['- No permission gates triggered.']),
      '',
      '## Safety',
      input.dryRun
        ? 'This was a local dry run. BertOS created records only and did not call external, paid, publishing, email, calendar, delete, deploy, or push actions.'
        : 'BertOS executed only local-safe registry actions. Risky actions remain gated.',
    ].join('\n'),
    metadata: {
      invocation: invocation as unknown as any,
      setupWarnings,
      permissionGates: permissionGates as unknown as any,
    },
  })

  let memoryProposal
  if (skill.permissions.includes('propose_memory')) {
    memoryProposal = await createMemoryProposal({
      kind: 'episodic',
      title: `${skill.name} invocation`,
      content: `Ran ${skill.command}. Output ${output.outputId ?? output.artifactId} was created. Status: ${agentRun.status}.`,
      project: input.project,
      client: input.client,
      source: 'tool-output',
      sourceRef: output.outputId ?? output.artifactId,
      tags: ['skill-run', skill.id],
      reason: 'Skill invocation summary for review.',
    })
  }

  agentRun.outputIds = [output.outputId ?? output.artifactId]
  agentRun.memoryProposalIds = memoryProposal ? [memoryProposal.proposalId] : []
  agentRun.lanes = agentRun.lanes.map(item => item.role === 'permission-review' ? { ...item, outputIds: agentRun.outputIds } : item)
  await saveAgentRun(agentRun)

  return { invocation, skill, plugins, permissionGates, setupWarnings, agentRun, output, memoryProposal }
}
