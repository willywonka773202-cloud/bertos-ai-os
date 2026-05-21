import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { AutomationAction } from '@/lib/bertos/types'
import { fetchLocalDaemonStatus, fetchLocalRepoStatus, runLocalDaemonCommand } from '@/lib/bertos/local-daemon'
import { getOllamaConfig } from '@/lib/bertos/runtime'

export interface AutomationActionResult {
  action: AutomationAction
  status: 'completed' | 'failed' | 'skipped'
  output?: string
  error?: string
  durationMs: number
}

export interface AutomationRunResult {
  ok: boolean
  status: 'completed' | 'failed' | 'blocked'
  results: AutomationActionResult[]
  logs: string[]
  durationMs: number
  summary: string
}

const SAFE_ACTIONS = new Set<AutomationAction>([
  'check-provider-health',
  'run-typecheck',
  'run-build',
  'run-lint',
  'run-tests',
  'git-status',
  'git-diff-stat',
  'create-project-health-report',
])

const APPROVAL_ONLY_ACTIONS = new Set<AutomationAction>([
  'create-agent-plan',
  'create-workspace-debug-task',
])

const DAEMON_DEPENDENT_ACTIONS = new Set<AutomationAction>([
  'run-typecheck',
  'run-build',
  'run-lint',
  'run-tests',
  'git-status',
  'git-diff-stat',
  'create-project-health-report',
])

async function readPackageScripts() {
  try {
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    const parsed = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { scripts?: Record<string, string> }
    return parsed.scripts ?? {}
  } catch {
    return {}
  }
}

export function isAutomationActionSafe(action: AutomationAction) {
  return SAFE_ACTIONS.has(action)
}

export function isAutomationActionApprovalOnly(action: AutomationAction) {
  return APPROVAL_ONLY_ACTIONS.has(action)
}

export function isAutomationActionDaemonDependent(action: AutomationAction) {
  return DAEMON_DEPENDENT_ACTIONS.has(action)
}

async function runCommandAction(action: AutomationAction, executable: string, args: string[], timeoutMs = 120000): Promise<AutomationActionResult> {
  const started = Date.now()
  try {
    const result = await runLocalDaemonCommand(executable, args, { timeoutMs })
    const output = [result.stdout, result.stderr, result.error].filter(Boolean).join('\n').trim()
    const ok = result.ok !== false && (typeof result.exitCode !== 'number' || result.exitCode === 0)
    return {
      action,
      status: ok ? 'completed' : 'failed',
      output: output || '(no output)',
      error: ok ? undefined : output || `${executable} ${args.join(' ')} failed.`,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    return {
      action,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Local daemon command failed.',
      durationMs: Date.now() - started,
    }
  }
}

async function checkProviderHealth(): Promise<AutomationActionResult> {
  const started = Date.now()
  const ollama = getOllamaConfig()
  const daemon = await fetchLocalDaemonStatus(5000)
  const cliOnline = daemon.tools.filter(tool => tool.installed).map(tool => `${tool.label}${tool.version ? ` ${tool.version}` : ''}`)
  const lines = [
    `Ollama: ${ollama.requiresApiKey ? (ollama.apiKey ? 'configured' : 'missing key') : 'local mode'}`,
    `Local daemon: ${daemon.online ? 'online' : 'offline'}`,
    cliOnline.length ? `CLI tools: ${cliOnline.join(', ')}` : 'CLI tools: none detected',
  ]
  return {
    action: 'check-provider-health',
    status: ollama.apiKey || daemon.online ? 'completed' : 'failed',
    output: lines.join('\n'),
    error: ollama.apiKey || daemon.online ? undefined : 'No provider path is currently reachable.',
    durationMs: Date.now() - started,
  }
}

async function createProjectHealthReport(previous: AutomationActionResult[]): Promise<AutomationActionResult> {
  const started = Date.now()
  const repo = await fetchLocalRepoStatus(5000)
  const lines = [
    'Project Health Report',
    repo ? `Branch: ${repo.branch}` : 'Branch: unavailable',
    repo ? `Remote: ${repo.remote}` : 'Remote: unavailable',
    repo ? `Safe repo: ${repo.safeRepo ? 'yes' : 'no'}` : 'Safe repo: unavailable',
    '',
    ...previous.map(result => [
      `${result.status === 'completed' ? 'PASS' : 'FAIL'} ${result.action}`,
      (result.error ?? result.output ?? '').split('\n').slice(0, 6).join('\n'),
    ].join('\n')),
  ]
  return {
    action: 'create-project-health-report',
    status: previous.some(result => result.status === 'failed') ? 'failed' : 'completed',
    output: lines.join('\n'),
    durationMs: Date.now() - started,
  }
}

export async function executeAutomationActions(actions: AutomationAction[]): Promise<AutomationRunResult> {
  const started = Date.now()
  const logs: string[] = []
  const results: AutomationActionResult[] = []
  const scripts = await readPackageScripts()
  const daemon = await fetchLocalDaemonStatus(5000)

  for (const action of actions) {
    if (!SAFE_ACTIONS.has(action)) {
      const approval = APPROVAL_ONLY_ACTIONS.has(action)
      results.push({
        action,
        status: 'skipped',
        error: approval ? `${action} requires user approval and is not executed automatically.` : `${action} is blocked by Autopilot safety policy.`,
        durationMs: 0,
      })
      logs.push(`${action}: skipped (${approval ? 'approval required' : 'blocked'})`)
      continue
    }

    if (DAEMON_DEPENDENT_ACTIONS.has(action) && !daemon.online) {
      const error = 'Skipped because local daemon is offline. Start with npm run bertos:daemon.'
      results.push({
        action,
        status: 'skipped',
        error,
        durationMs: 0,
      })
      logs.push(`${action}: skipped (daemon offline)`)
      continue
    }

    logs.push(`${action}: started`)
    let result: AutomationActionResult
    if (action === 'check-provider-health') result = await checkProviderHealth()
    else if (action === 'run-typecheck') result = await runCommandAction(action, 'npm', ['run', 'typecheck'], 180000)
    else if (action === 'run-build') result = await runCommandAction(action, 'npm', ['run', 'build'], 240000)
    else if (action === 'run-lint') {
      result = scripts.lint
        ? await runCommandAction(action, 'npm', ['run', 'lint'], 180000)
        : { action, status: 'skipped', output: 'npm run lint is not configured.', durationMs: 0 }
    }
    else if (action === 'run-tests') {
      result = scripts.test
        ? await runCommandAction(action, 'npm', ['test'], 180000)
        : { action, status: 'skipped', output: 'npm test is not configured.', durationMs: 0 }
    }
    else if (action === 'git-status') result = await runCommandAction(action, 'git', ['status', '--short'], 60000)
    else if (action === 'git-diff-stat') result = await runCommandAction(action, 'git', ['diff', '--stat'], 60000)
    else result = await createProjectHealthReport(results)

    results.push(result)
    logs.push(`${action}: ${result.status}${result.durationMs ? ` (${result.durationMs}ms)` : ''}`)
  }

  const failed = results.some(result => result.status === 'failed')
  const blocked = results.some(result => result.status === 'skipped' && result.error?.includes('blocked'))
  return {
    ok: !failed && !blocked,
    status: blocked ? 'blocked' : failed ? 'failed' : 'completed',
    results,
    logs,
    durationMs: Date.now() - started,
    summary: results.map(result => `${result.status === 'completed' ? 'PASS' : result.status === 'skipped' ? 'SKIP' : 'FAIL'} ${result.action}`).join(' | '),
  }
}

export async function getAutomationHealth() {
  const scripts = await readPackageScripts()
  const daemon = await fetchLocalDaemonStatus(5000)
  const repo = await fetchLocalRepoStatus(5000)
  return {
    ready: true,
    daemon: {
      online: daemon.online,
      error: daemon.error,
      startCommand: daemon.startCommand,
    },
    packageScripts: {
      typecheck: Boolean(scripts.typecheck),
      build: Boolean(scripts.build),
      lint: Boolean(scripts.lint),
      test: Boolean(scripts.test),
      validate: Boolean(scripts.validate),
      smoke: Boolean(scripts.smoke),
    },
    repo: repo ? {
      detected: true,
      branch: repo.branch,
      remote: repo.remote,
      safeRepo: repo.safeRepo,
      blockedReason: repo.blockedReason,
    } : {
      detected: false,
      safeRepo: false,
    },
    safeActions: Array.from(SAFE_ACTIONS),
    approvalOnlyActions: Array.from(APPROVAL_ONLY_ACTIONS),
  }
}
