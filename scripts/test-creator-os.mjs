#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Module from 'node:module'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bertos-creator-os-'))
process.env.BERTOS_DATA_ROOT = tempRoot
const require = createRequire(import.meta.url)

function compileTs(module, filename) {
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      paths: { '@/*': ['./*'] },
      baseUrl: root,
    },
  }).outputText
  module._compile(output, filename)
}

Module._extensions['.ts'] = compileTs

function req(relativePath) {
  return require(path.join(root, relativePath))
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS ${message}`)
  }
}

const {
  parseSkillMarkdown,
  listSkills,
} = req('lib/bertos/skills/registry.ts')
const {
  listPlugins,
  evaluatePermissionGate,
} = req('lib/bertos/plugins/registry.ts')
const {
  createOutputArtifact,
  searchOutputArtifacts,
} = req('lib/bertos/outputs/registry.ts')
const {
  createMemoryProposal,
  approveMemoryProposal,
  listMemoryProposals,
  updateMemoryProposal,
} = req('lib/bertos/memory/registry.ts')
const {
  buildGroundingPack,
  enforceGroundingSourceLinks,
} = req('lib/bertos/grounding/builder.ts')
const {
  runWorkflow,
} = req('lib/bertos/workflows/runner.ts')
const {
  parseSkillInvocation,
  runSkillInvocation,
} = req('lib/bertos/invocations/runner.ts')
const {
  createAndSaveAutomationCandidate,
  listAutomationCandidates,
} = req('lib/bertos/automation/creator-os.ts')
const {
  createStudioAsset,
  updateStudioAsset,
  createPublishingQueueItem,
  updatePublishingQueueItem,
} = req('lib/bertos/studio/registry.ts')
const {
  buildPublishReadinessReport,
} = req('lib/bertos/readiness.ts')
const {
  buildAiOsBenchmarkReport,
  AI_OS_BENCHMARK_FEATURES,
} = req('lib/bertos/ai-os-benchmark.ts')
const {
  runReflection,
} = req('lib/bertos/automation/reflection.ts')
const {
  ensureBertOSRuntime,
} = req('lib/bertos/runtime-init.ts')
const {
  runtimePath,
} = req('lib/bertos/runtime-store.ts')

const runtimeInit = await ensureBertOSRuntime()
assert(runtimeInit.directories.length > 0, 'runtime initializer creates local-first directories')
assert(fs.existsSync(path.join(tempRoot, 'memory', 'user_profile.md')), 'runtime initializer creates core memory markdown files')
assert(fs.existsSync(path.join(tempRoot, 'plugins', 'registry.json')), 'runtime initializer creates plugin override registry')
let traversalBlocked = false
try {
  runtimePath('..', 'outside')
} catch {
  traversalBlocked = true
}
assert(traversalBlocked, 'runtimePath blocks path traversal outside data root')

const parsed = parseSkillMarkdown(`---
id: test-skill
name: Test Skill
version: 1.0.0
command: /test-skill
description: Test skill.
required_plugins: [memory]
optional_plugins: [outputs]
default_agent: test-agent
output_types: [content_ideas]
memory_access: read_project_write_proposals
permissions: [read_memory, write_outputs]
approval_required_for: [memory_write]
---

## Purpose
Test.

## Examples
- /test-skill run
`)

assert(parsed.id === 'test-skill', 'skill.md parser reads frontmatter')
assert(parsed.examples.length === 1, 'skill parser extracts examples')

const skills = await listSkills()
assert(skills.some(skill => skill.id === 'youtube-researcher'), 'built-in skills include YouTube Researcher')

const plugins = await listPlugins()
assert(plugins.some(plugin => plugin.id === 'gmail' && plugin.setupStatus === 'planned'), 'Gmail plugin is setup-gated')
assert(evaluatePermissionGate({ action: 'send sponsorship reply', permission: 'send_email' }).status === 'approval-required', 'email send requires approval')
assert(evaluatePermissionGate({ action: 'use paid media provider', permission: 'paid_api' }).status === 'approval-required', 'paid_api alias requires approval')
assert(evaluatePermissionGate({ action: 'schedule social post', permission: 'publishing' }).status === 'approval-required', 'publishing alias requires approval')
assert(evaluatePermissionGate({ action: 'publish queued post', permission: 'publish' }).status === 'approval-required', 'publish permission requires approval')
assert(evaluatePermissionGate({ action: 'schedule calendar event', permission: 'schedule_calendar' }).status === 'approval-required', 'schedule permission requires approval')
assert(evaluatePermissionGate({ action: 'delete generated asset', permission: 'delete_files' }).status === 'approval-required', 'delete permission requires approval')
assert(evaluatePermissionGate({ action: 'read .env.local', permission: 'read_local_files', approved: true }).status === 'blocked', 'secret-like action stays blocked')

const output = await createOutputArtifact({
  type: 'content_ideas',
  title: 'Creator OS Test Output',
  content: '# Ideas\n\n- Test idea',
  skillId: 'second-brain',
  pluginIds: ['memory', 'outputs'],
  tags: ['test'],
})
assert(Boolean(output.outputId), 'output artifact receives an id')
assert(output.files.length === 1, 'output artifact writes a primary content file')
assert(fs.existsSync(path.join(root, output.files[0].path)), 'output artifact primary content file exists on disk')
assert((await searchOutputArtifacts({ query: 'Creator OS' })).length === 1, 'output registry search finds artifact')

const proposal = await createMemoryProposal({
  kind: 'episodic',
  title: 'Creator OS test memory',
  content: 'This is a safe test memory proposal.',
  source: 'tool-output',
  tags: ['test'],
})
assert(proposal.confidence === 'needs-review', 'tool-output memory proposal defaults to needs-review')
assert(proposal.proposedContent === 'This is a safe test memory proposal.', 'memory proposal stores proposedContent')
assert(Array.isArray(proposal.riskFlags) && proposal.riskFlags.length > 0, 'memory proposal includes risk flags')
assert(typeof proposal.targetFile === 'string' && proposal.targetFile.includes('creator-os-test-memory'), 'memory proposal includes targetFile')
assert((await listMemoryProposals('pending')).length === 1, 'memory proposal list shows pending item')
const editedProposal = await updateMemoryProposal(proposal.proposalId, { proposedContent: 'This is a safe edited memory proposal.' })
assert(editedProposal.proposedContent.includes('edited'), 'pending memory proposal can be edited before approval')
const approved = await approveMemoryProposal(proposal.proposalId)
assert(approved.record?.title === proposal.title, 'approving proposal writes markdown memory record')
assert(approved.record?.content.includes('edited'), 'approving edited proposal writes edited content')
assert(approved.proposal.reviewedBy === 'local-user', 'approved memory proposal stores reviewer')

const pack = await buildGroundingPack({
  taskReason: 'test grounding',
  query: 'Creator OS',
  sourceUrls: ['https://youtube.com/watch?v=test'],
})
assert(pack.sources.length > 0, 'grounding pack includes supplied source URL')
assert(enforceGroundingSourceLinks(pack).ok, 'grounding link enforcement passes with URLs')

const invocation = parseSkillInvocation('/youtube-researcher @youtube video_url=https://youtube.com/watch?v=test output_count=3')
assert(invocation.command === '/youtube-researcher' && invocation.pluginMentions.includes('@youtube'), 'slash command parser extracts skill and plugin mention')
assert(invocation.args.video_url === 'https://youtube.com/watch?v=test', 'slash command parser extracts key/value args')

const skillRun = await runSkillInvocation({
  text: '/youtube-researcher @youtube video_url=https://youtube.com/watch?v=test',
  project: 'bertos',
  dryRun: true,
})
assert(skillRun.agentRun.outputIds.length === 1, 'skill invocation creates an agent run output')
assert(skillRun.setupWarnings.length >= 1, 'skill invocation reports setup/degraded state for missing external plugin')

const workflow = await runWorkflow({
  workflowId: 'content-idea-digest',
  prompt: 'Create a creator OS digest.',
  project: 'bertos',
})
assert(workflow.workflowRun.outputIds.length === 1, 'workflow run creates output')
assert(workflow.workflowRun.memoryProposalIds.length === 1, 'workflow run creates memory proposal')

const candidate = await createAndSaveAutomationCandidate({
  sourceRunId: skillRun.agentRun.agentRunId,
  skillChain: ['youtube-researcher'],
  pluginIds: ['youtube', 'outputs'],
})
assert(candidate.sourceRunId === skillRun.agentRun.agentRunId, 'automation promotion stores source run id')
assert((await listAutomationCandidates()).some(item => item.automationCandidateId === candidate.automationCandidateId), 'automation candidates persist locally')

const studioAsset = await createStudioAsset({ type: 'thumbnail', prompt: 'Test thumbnail prompt', provider: 'local-placeholder' })
const selectedAsset = await updateStudioAsset(studioAsset.assetId, { favorite: true, status: 'final' })
assert(selectedAsset.favorite && selectedAsset.status === 'final', 'studio asset can be favorited and finalized locally')

const queueItem = await createPublishingQueueItem({ idea: 'Test publishing idea', approvalRequired: true })
let publishBlocked = false
try {
  await updatePublishingQueueItem(queueItem.queueItemId, { status: 'published' })
} catch {
  publishBlocked = true
}
assert(publishBlocked, 'publishing queue blocks published status without approval')
const scheduledQueueItem = await createPublishingQueueItem({ idea: 'Test scheduled publishing idea', approvalRequired: true })
let scheduleBlocked = false
try {
  await updatePublishingQueueItem(scheduledQueueItem.queueItemId, { status: 'scheduled' })
} catch {
  scheduleBlocked = true
}
assert(scheduleBlocked, 'publishing queue blocks scheduled status without approval')
const scheduledItem = await updatePublishingQueueItem(scheduledQueueItem.queueItemId, {
  status: 'scheduled',
  approved: true,
  approvalReason: 'smoke-test schedule approval',
})
assert(scheduledItem.status === 'scheduled' && scheduledItem.approvalRequired === false, 'publishing queue allows approved schedule with reason')
let publishWithoutReasonBlocked = false
try {
  await updatePublishingQueueItem(queueItem.queueItemId, { status: 'published', approved: true })
} catch {
  publishWithoutReasonBlocked = true
}
assert(publishWithoutReasonBlocked, 'publishing queue requires an approval reason')
const publishedItem = await updatePublishingQueueItem(queueItem.queueItemId, {
  status: 'published',
  approved: true,
  approvalReason: 'smoke-test explicit approval',
})
assert(publishedItem.status === 'published' && publishedItem.approvalRequired === false, 'publishing queue allows approved publish with reason')

const reflection = await runReflection({ cadence: 'daily', project: 'bertos' })
assert(reflection.output.outputId && reflection.memoryProposal.status === 'pending', 'reflection creates output and pending memory proposal')
assert(reflection.memoryProposal.confidence === 'needs-review', 'reflection memory proposal requires review')

const readiness = await buildPublishReadinessReport()
assert(readiness.ok && readiness.summary.total > 0, 'publish readiness report builds')
assert(readiness.sections.some(section => section.id === 'deployment'), 'publish readiness includes deployment section')
assert(readiness.sections.some(section => section.id === 'creator-os'), 'publish readiness includes Creator OS section')
assert(readiness.summary.blocked === 0, 'publish readiness has no blocked checks in smoke environment')

const benchmark = await buildAiOsBenchmarkReport()
assert(benchmark.ok && benchmark.summary.total >= 40, 'AI OS benchmark report tracks at least 40 features')
assert(benchmark.features.length === AI_OS_BENCHMARK_FEATURES.length, 'AI OS benchmark uses canonical feature matrix')
assert(benchmark.sources.some(source => source.id === 'open-webui'), 'AI OS benchmark includes Open WebUI source grounding')
assert(benchmark.sources.some(source => source.id === 'langgraph'), 'AI OS benchmark includes LangGraph source grounding')
assert(benchmark.layers.some(layer => layer.id === 'models'), 'AI OS benchmark includes model routing layer')
assert(benchmark.layers.some(layer => layer.id === 'safety'), 'AI OS benchmark includes safety layer')
assert(benchmark.priorityGaps.every(feature => feature.status !== 'implemented'), 'AI OS priority gaps exclude completed features')

if (process.exitCode === 1) process.exit(1)
