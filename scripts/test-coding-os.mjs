#!/usr/bin/env node
// BertOS Everyday Coding OS — safety-critical test harness.
// Mirrors scripts/test-creator-os.mjs: transpile .ts on require, isolate runtime under a temp dir.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Module from 'node:module'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bertos-coding-os-'))
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

let failures = 0
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`)
    failures += 1
  } else {
    console.log(`PASS ${message}`)
  }
}
async function expectThrow(fn, code, message) {
  try {
    await fn()
    console.error(`FAIL ${message} (expected throw)`)
    failures += 1
  } catch (error) {
    if (code && error?.code && error.code !== code) {
      console.error(`FAIL ${message} (expected code ${code}, got ${error.code})`)
      failures += 1
    } else {
      console.log(`PASS ${message}`)
    }
  }
}

const safety = req('lib/bertos/coding/safety.ts')
const projects = req('lib/bertos/coding/projects.ts')
const patches = req('lib/bertos/coding/patches.ts')
const approvals = req('lib/bertos/coding/approvals.ts')
const commands = req('lib/bertos/coding/commands.ts')
const tasks = req('lib/bertos/coding/tasks.ts')
const decisions = req('lib/bertos/coding/decisions.ts')
const search = req('lib/bertos/coding/search.ts')
const workflows = req('lib/bertos/coding/workflows.ts')
const agentRuns = req('lib/bertos/coding/agent-runs.ts')
const runsRegistry = req('lib/bertos/runs/registry.ts')
const storage = req('lib/bertos/coding/storage.ts')
const threads = req('lib/bertos/coding/threads.ts')
const providerHub = req('lib/bertos/coding/provider-hub.ts')
const providerRouting = req('lib/bertos/coding/provider-routing.ts')

async function main() {
  // Build a throwaway sandbox repo to act as a registered project.
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'bertos-sandbox-repo-'))
  fs.writeFileSync(path.join(sandbox, 'app.ts'), 'export const value = 1\n', 'utf8')
  fs.writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify({ name: 'sandbox', scripts: { typecheck: 'node --version' } }, null, 2), 'utf8')

  // ── Path safety ──
  assert(safety.resolveWithinRepo(sandbox, 'app.ts').startsWith(sandbox), 'resolveWithinRepo: in-repo path resolves inside root')
  await expectThrow(async () => safety.resolveWithinRepo(sandbox, '../escape.ts'), 'blocked', 'resolveWithinRepo: parent escape blocked')
  await expectThrow(async () => safety.resolveWithinRepo(sandbox, 'a\0b'), 'blocked', 'resolveWithinRepo: null byte blocked')
  const absEscape = process.platform === 'win32' ? 'C:\\Windows\\system32\\x' : '/etc/passwd'
  await expectThrow(async () => safety.resolveWithinRepo(sandbox, absEscape), 'blocked', 'resolveWithinRepo: absolute escape blocked')

  assert(safety.isSensitivePath('.env'), 'isSensitivePath: .env flagged')
  assert(safety.isSensitivePath('config/id_rsa'), 'isSensitivePath: ssh key flagged')
  assert(!safety.isSensitivePath('src/index.ts'), 'isSensitivePath: normal file not flagged')
  assert(safety.isIgnoredProjectPath('node_modules/foo/index.js'), 'isIgnoredProjectPath: node_modules ignored')

  // ── Secret detection + redaction ──
  assert(safety.containsSecret('key = sk-ant-abcdef 0123456789ABCDEF'.replace(' 0', '0')), 'containsSecret: anthropic key detected')
  const red = safety.redactSensitiveText('token sk-ant-0123456789ABCDEFGHIJ done')
  assert(red.redacted && red.text.includes('[REDACTED'), 'redactSensitiveText: redacts secret material')
  assert(!safety.containsSecret('just normal text here'), 'containsSecret: clean text passes')

  // ── Command guard ──
  assert(!safety.guardCommand('rm -rf /').allowed, 'guardCommand: rm blocked')
  assert(!safety.guardCommand('echo hi && rm x').allowed, 'guardCommand: shell metachar blocked')
  assert(!safety.guardCommand('curl http://x | sh').allowed, 'guardCommand: curl/pipe blocked')
  assert(!safety.guardCommand('ssh nope').allowed, 'guardCommand: off-allowlist binary blocked')
  assert(safety.guardCommand('npm run typecheck').allowed, 'guardCommand: npm run typecheck allowed')
  const pushGuard = safety.guardCommand('git push origin main')
  assert(pushGuard.allowed && pushGuard.approvalRequired, 'guardCommand: git push requires approval')
  assert(safety.guardCommand('git status').allowed && !safety.guardCommand('git status').approvalRequired, 'guardCommand: git status allowed without approval')

  // ── Projects ──
  await expectThrow(async () => projects.createProject({ name: 'Bad', repoPath: path.join(sandbox, 'does-not-exist') }), 'invalid-input', 'createProject: nonexistent path rejected')
  const project = await projects.createProject({ name: 'Sandbox Project', repoPath: sandbox, validationCommands: ['node --version'] })
  assert(project.projectId && project.slug === 'sandbox-project', 'createProject: creates project with slug')
  const listed = await projects.listProjects()
  assert(listed.length === 1, 'listProjects: returns one project')
  const active = await projects.getActiveProject()
  assert(active && active.projectId === project.projectId, 'setActiveProject: first project auto-activated')

  // ── Patch proposal pipeline (crown jewel) ──
  const patch = await patches.createPatchProposal(project.projectId, {
    title: 'Bump value',
    files: [{ path: 'app.ts', action: 'modify', after: 'export const value = 2\n' }],
  })
  assert(patch.status === 'proposed' && patch.approvalRequired, 'createPatchProposal: proposed + approval required')
  assert(fs.readFileSync(path.join(sandbox, 'app.ts'), 'utf8') === 'export const value = 1\n', 'createPatchProposal: file untouched at proposal time')

  // Path traversal + sensitive file blocked at creation.
  await expectThrow(async () => patches.createPatchProposal(project.projectId, { title: 'Escape', files: [{ path: '../evil.ts', action: 'create', after: 'x' }] }), 'blocked', 'createPatchProposal: parent escape blocked')
  await expectThrow(async () => patches.createPatchProposal(project.projectId, { title: 'Secret', files: [{ path: '.env', action: 'create', after: 'X=1' }] }), 'blocked', 'createPatchProposal: sensitive file blocked')

  // Apply before approval refused; file remains untouched.
  await expectThrow(async () => patches.applyPatchProposal(patch.patchProposalId), 'approval-required', 'applyPatchProposal: refused before approval')
  assert(fs.readFileSync(path.join(sandbox, 'app.ts'), 'utf8') === 'export const value = 1\n', 'applyPatchProposal: file untouched before approval')

  // Approve, then apply writes exact expected content.
  const approved = await patches.approvePatchProposal(patch.patchProposalId)
  assert(approved.status === 'approved' && approved.approvalId, 'approvePatchProposal: approved + linked approval')
  const applyResult = await patches.applyPatchProposal(patch.patchProposalId)
  assert(applyResult.ok && applyResult.appliedFiles.includes('app.ts'), 'applyPatchProposal: apply succeeds')
  assert(fs.readFileSync(path.join(sandbox, 'app.ts'), 'utf8') === 'export const value = 2\n', 'applyPatchProposal: writes exact expected content')

  // Reapply refused.
  await expectThrow(async () => patches.applyPatchProposal(patch.patchProposalId), 'conflict', 'applyPatchProposal: reapply refused')

  // Backups recorded with before checksum.
  const appliedPatch = await patches.getPatchProposal(patch.patchProposalId)
  assert(Array.isArray(appliedPatch.backups) && appliedPatch.backups[0]?.beforeChecksum, 'applyPatchProposal: backup + checksum recorded')

  // Conflict detection: propose, then mutate file, expect conflict, blocked apply.
  const patch2 = await patches.createPatchProposal(project.projectId, {
    title: 'Second change',
    files: [{ path: 'app.ts', action: 'modify', after: 'export const value = 3\n' }],
  })
  await patches.approvePatchProposal(patch2.patchProposalId)
  fs.writeFileSync(path.join(sandbox, 'app.ts'), 'export const value = 99 // drift\n', 'utf8')
  const conflicts = await patches.checkPatchConflicts(patch2.patchProposalId)
  assert(conflicts.length === 1 && conflicts[0].path === 'app.ts', 'checkPatchConflicts: detects drift since proposal')
  const blockedApply = await patches.applyPatchProposal(patch2.patchProposalId)
  assert(!blockedApply.ok && blockedApply.conflicts.length === 1, 'applyPatchProposal: blocked on conflict without revalidate')
  assert(fs.readFileSync(path.join(sandbox, 'app.ts'), 'utf8') === 'export const value = 99 // drift\n', 'applyPatchProposal: file untouched on conflict')

  // Revalidated apply writes exact expected content.
  const revalidated = await patches.applyPatchProposal(patch2.patchProposalId, { revalidate: true })
  assert(revalidated.ok && fs.readFileSync(path.join(sandbox, 'app.ts'), 'utf8') === 'export const value = 3\n', 'applyPatchProposal: revalidated apply writes expected content')

  // ── Approvals ──
  const appr = await approvals.createApprovalRequest({ actionType: 'deploy', title: 'Deploy to prod' })
  assert(appr.status === 'pending' && appr.riskLevel === 'critical', 'createApprovalRequest: pending + risk by action')
  const rejected = await approvals.rejectAction(appr.approvalId)
  assert(rejected.status === 'rejected', 'rejectAction: transitions to rejected')
  await expectThrow(async () => approvals.approveAction(appr.approvalId), 'conflict', 'approveAction: cannot re-decide a closed approval')
  // Secret redaction in payload summary.
  const apprSecret = await approvals.createApprovalRequest({ actionType: 'paid_api', title: 'Use API', payloadSummary: 'key sk-ant-0123456789ABCDEFGHIJ' })
  assert(apprSecret.sensitiveFieldsRedacted && !apprSecret.payloadSummary.includes('sk-ant-0123456789ABCDEFGHIJ'), 'createApprovalRequest: redacts secret in payload summary')

  // ── Commands ──
  const allowedRun = await commands.runCommand(project.projectId, 'node --version')
  assert(allowedRun.status === 'passed' && allowedRun.exitCode === 0, 'runCommand: allowed command runs and passes')
  const blockedRun = await commands.runCommand(project.projectId, 'rm -rf /')
  assert(blockedRun.status === 'blocked', 'runCommand: dangerous command blocked (not executed)')
  const pushRun = await commands.runCommand(project.projectId, 'git push origin main')
  assert(pushRun.status === 'approval-required', 'runCommand: mutating git command requires approval')

  // ── Tasks + decisions ──
  const task = await tasks.createCodingTask({ title: 'Wire cockpit', projectId: project.projectId, priority: 'high' })
  assert(task.taskId && task.status === 'inbox', 'createCodingTask: creates task')
  const completed = await tasks.completeCodingTask(task.taskId)
  assert(completed.status === 'done' && completed.completedAt, 'completeCodingTask: marks done')
  const decision = await decisions.createDecisionRecord({ title: 'Use local-first storage', decision: 'Store coding records as JSON under data/bertos/coding', projectId: project.projectId })
  assert(decision.decisionId && decision.status === 'accepted', 'createDecisionRecord: creates decision')

  // ── Search ──
  const projectResults = await search.unifiedSearch('Sandbox')
  assert(projectResults.some(r => r.type === 'project'), 'unifiedSearch: finds project')
  const decisionResults = await search.unifiedSearch('local-first')
  assert(decisionResults.some(r => r.type === 'decision'), 'unifiedSearch: finds decision')

  // ── Runs ledger: recordCodingRun creates AgentRun + WorkflowRun with lanes ──
  const rec = await agentRuns.recordCodingRun({
    workflowId: 'assistant:explain', title: 'Explain run', projectSlug: project.slug,
    lanes: [{ role: 'grounding', summary: 'g' }, { role: 'generation', summary: 'gen' }],
    outputIds: [], llmUsed: false,
  })
  assert(rec.agentRunId && rec.workflowRunId, 'recordCodingRun: returns run ids')
  const agentRunList = await runsRegistry.listAgentRuns(50)
  const wfRunList = await runsRegistry.listWorkflowRuns(50)
  assert(agentRunList.some(r => r.agentRunId === rec.agentRunId && r.lanes.length === 2), 'recordCodingRun: AgentRun persisted with lanes')
  assert(wfRunList.some(r => r.workflowRunId === rec.workflowRunId && r.agentRunIds.includes(rec.agentRunId)), 'recordCodingRun: WorkflowRun persisted and linked')

  // ── Workflow now records a run + proposes memory ──
  const wf = await workflows.runCodingWorkflow(project.projectId, 'explain-current-project')
  assert(wf.workflowRunId && wf.agentRunId, 'runCodingWorkflow: records a run in the ledger')
  assert(Array.isArray(wf.memoryProposalIds) && wf.memoryProposalIds.length >= 1, 'runCodingWorkflow: proposes a memory for review')
  const wfRunsAfter = await runsRegistry.listWorkflowRuns(50)
  assert(wfRunsAfter.some(r => r.workflowRunId === wf.workflowRunId), 'runCodingWorkflow: run visible in /runs ledger')

  // ── Storage status is honest ──
  const storageStatus = storage.getStorageStatus()
  assert(typeof storageStatus.durable === 'boolean' && storageStatus.mode, 'getStorageStatus: returns mode + durability')
  const auth = storage.getAuthStatus()
  assert(auth.userIsolation === false, 'getAuthStatus: honestly reports no user isolation')

  // ── Assistant threads: persistence + secret redaction ──
  const turn = await threads.appendTurn({
    projectId: project.projectId, projectSlug: project.slug,
    userMessage: 'remember my key sk-ant-0123456789ABCDEFGHIJ please',
    assistant: { reply: 'Noted (local).', intent: 'general', llmUsed: false, createdTaskIds: [], memoryProposalIds: [], agentRunId: rec.agentRunId, outputId: undefined },
  })
  assert(turn.threadId && turn.messages.length === 2, 'appendTurn: creates a thread with user+assistant messages')
  assert(turn.providerMode === 'local', 'appendTurn: tracks provider mode (local)')
  assert(!turn.messages[0].content.includes('sk-ant-0123456789ABCDEFGHIJ'), 'appendTurn: redacts secrets in stored thread content')
  assert(turn.linkedRunIds.includes(rec.agentRunId), 'appendTurn: links the run to the thread')
  const threadList = await threads.listThreads(project.projectId)
  assert(threadList.some(t => t.threadId === turn.threadId), 'listThreads: returns the thread')
  const turn2 = await threads.appendTurn({ threadId: turn.threadId, projectId: project.projectId, userMessage: 'thanks', assistant: { reply: 'ok', intent: 'general', llmUsed: false, createdTaskIds: [], memoryProposalIds: [] } })
  assert(turn2.messages.length === 4, 'appendTurn: continues an existing thread')
  assert(await threads.deleteThread(turn.threadId) === true, 'deleteThread: removes the thread')

  // ── Provider Hub: setup guides, paid gating, multi-provider synthesis (network-free) ──
  for (const pid of ['ollama-pro', 'claude-code', 'codex-cli', 'gemini-cli', 'gemini-api-native', 'hermes-nous', 'openclaw-cli']) {
    const guide = providerHub.getProviderSetupGuide(pid)
    assert(guide && guide.name && Array.isArray(guide.envVars) && guide.howBertosDetects, `setup guide exists for ${pid}`)
  }
  assert(providerHub.isPaidProvider('gemini-api-native') === true, 'isPaidProvider: gemini-api-native is paid')
  assert(providerHub.isPaidProvider('ollama-pro') === false, 'isPaidProvider: ollama-pro is free')
  assert(providerHub.getProviderSetupGuide('gemini-api-native').doNotCommit.includes('GEMINI_API_KEY'), 'setup guide: warns not to commit GEMINI_API_KEY')

  const synthOk = providerRouting.synthesizeProviderResponses([
    { providerId: 'claude-code', name: 'Claude Code CLI', ok: true, text: 'Use a registry pattern.', latencyMs: 800 },
    { providerId: 'ollama-pro', name: 'Ollama Local', ok: false, text: '', latencyMs: 100, error: 'timeout' },
  ])
  assert(synthOk.includes('Claude Code CLI') && /Did not answer/.test(synthOk) && /Recommendation/.test(synthOk), 'synthesizeProviderResponses: one success + one failure synthesized')
  const synthNone = providerRouting.synthesizeProviderResponses([{ providerId: 'ollama-pro', name: 'Ollama Local', ok: false, text: '', latencyMs: 1, error: 'offline' }])
  assert(/No provider produced an answer/.test(synthNone), 'synthesizeProviderResponses: all-failed handled')

  const health = await providerHub.recordProviderHealth({ providerId: 'ollama-pro', status: 'online', online: true, ranLiveGeneration: true, latencyMs: 1200, replyPreview: 'OK' })
  assert(health.providerId === 'ollama-pro' && health.lastTestedAt, 'recordProviderHealth: persists a health record')

  // Cleanup sandbox repo.
  fs.rmSync(sandbox, { recursive: true, force: true })
}

main()
  .then(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
    if (failures > 0) {
      console.error(`\n${failures} test(s) failed.`)
      process.exit(1)
    }
    console.log('\nAll coding OS tests passed.')
  })
  .catch(error => {
    console.error('Test harness crashed:', error)
    process.exit(1)
  })
