import type {
  AutomationRun,
  AutomationRunAction,
  AutomationAction,
  AgentTask,
} from '@/lib/bertos/types'
import { fetchLocalDaemonBridge } from '@/lib/bertos/browser-daemon'
import { buildStarterAutomationTaskDescription, isStarterAutomationAction } from '@/lib/bertos/automation/starters'

// ─── Action executor ────────────────────────────────────────────────────────

type RunActionUpdater = (runId: string, actionId: string, updates: Partial<AutomationRunAction>) => void
type RunUpdater       = (runId: string, updates: Partial<AutomationRun>) => void
type LogAppender      = (runId: string, line: string) => void
type GeneratedTaskMode = AgentTask['mode']

export interface AutopilotRunnerDeps {
  updateRun:       RunUpdater
  updateRunAction: RunActionUpdater
  appendRunLog:    LogAppender
  markRuleLastRun: (ruleId: string) => void
}

export function buildVisualEvolutionTaskDescription(runTitle: string) {
  return [
    `Generated from Autopilot run "${runTitle}".`,
    '',
    'Build the next BertOS visual evolution sprint.',
    '',
    'Goal:',
    '- Make BertOS feel more advanced than the current shell through one focused, production-quality visual upgrade.',
    '- Prefer real 3D depth, motion, lighting, interaction feedback, or spatial UI clarity over decorative clutter.',
    '- Keep the app operational and honest: no fake provider output, no fake command results, and no dead controls.',
    '',
    'Suggested targets:',
    '- components/bertos/olympus for global 3D stage and interaction depth.',
    '- components/bertos/dashboard or components/bertos/autopilot for visible command-center polish.',
    '- app/globals.css only for scoped visual tokens, animations, and responsive fixes.',
    '',
    'Implementation contract:',
    '- Use existing BertOS components and stores instead of creating a duplicate visual system.',
    '- Use Three.js for new 3D scene work when the change is truly 3D.',
    '- Keep mobile usable and respect prefers-reduced-motion.',
    '- Do not read .env files, do not touch Sylistly, do not push, do not deploy.',
    '- Validate with npm run typecheck, npm run build, and npm run bertos:safety before marking complete.',
    '',
    'Done when:',
    '- One scoped visual upgrade is implemented and reviewable.',
    '- The affected route still communicates real working, missing-setup, or approval-required states.',
    '- Validation results are reported exactly.',
  ].join('\n')
}

async function execDaemonCmd(executable: string, args: string[], timeoutMs = 60000): Promise<{ ok: boolean; output: string }> {
  try {
    const res = await fetchLocalDaemonBridge('/api/local-daemon/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ executable, args, timeoutMs }),
    })
    const data = await res.json() as { exitCode?: number; stdout?: string; stderr?: string; error?: string }
    const output = (data.stdout ?? '') + (data.stderr ? `\n[stderr] ${data.stderr}` : '')
    return { ok: (data.exitCode ?? 1) === 0, output: output.trim() || data.error || '(no output)' }
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : 'Daemon unreachable. Start npm run bertos:daemon.' }
  }
}

async function execProviderHealth(): Promise<{ ok: boolean; output: string }> {
  try {
    const res = await fetch('/api/providers/status')
    const data = await res.json() as { providers?: { id: string; name: string; status: string; latency?: number }[] }
    const providers = data.providers ?? []
    const lines = providers.map(p => `${p.status === 'online' ? 'PASS' : 'FAIL'} ${p.name}${p.latency ? ` (${p.latency}ms)` : ''}`)
    const online  = providers.filter(p => p.status === 'online').length
    return {
      ok: online > 0,
      output: lines.join('\n') || 'No provider data returned.',
    }
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : 'Provider status check failed.' }
  }
}

// ─── Per-action handlers ────────────────────────────────────────────────────

const ACTION_HANDLERS: Record<AutomationAction, () => Promise<{ ok: boolean; output: string }>> = {
  'check-provider-health':         () => execProviderHealth(),
  'run-typecheck':                 () => execDaemonCmd('npm', ['run', 'typecheck'], 90000),
  'run-build':                     () => execDaemonCmd('npm', ['run', 'build'], 180000),
  'run-lint':                      () => execDaemonCmd('npm', ['run', 'lint'], 60000),
  'run-tests':                     () => execDaemonCmd('npm', ['test', '--', '--passWithNoTests'], 120000),
  'git-status':                    () => execDaemonCmd('git', ['status', '--short']),
  'git-diff-stat':                 () => execDaemonCmd('git', ['diff', '--stat']),
  // These actions create app artifacts and are handled specially in executeRun.
  'create-agent-plan':             async () => ({ ok: true, output: '[create-agent-plan] Agent task queued. See Agent Console.' }),
  'create-visual-evolution-task':  async () => ({ ok: true, output: '[create-visual-evolution-task] Visual evolution build task queued. See Agent Console.' }),
  'create-workspace-debug-task':   async () => ({ ok: true, output: '[create-workspace-debug-task] Workspace task queued.' }),
  'create-project-health-report':  async () => ({ ok: true, output: '[create-project-health-report] Health report summary appended to run logs.' }),
  'create-daily-brief-task':       async () => ({ ok: true, output: '[create-daily-brief-task] Daily brief automation planning task queued.' }),
  'create-inbox-triage-task':      async () => ({ ok: true, output: '[create-inbox-triage-task] Inbox triage automation planning task queued.' }),
  'create-weekly-review-task':     async () => ({ ok: true, output: '[create-weekly-review-task] Weekly review automation planning task queued.' }),
  'create-content-pipeline-task':  async () => ({ ok: true, output: '[create-content-pipeline-task] Content pipeline automation planning task queued.' }),
  'create-connector-setup-task':   async () => ({ ok: true, output: '[create-connector-setup-task] Connector setup planning task queued.' }),
}

// ─── Main run executor ─────────────────────────────────────────────────────

export async function executeRun(
  run: AutomationRun,
  deps: AutopilotRunnerDeps,
  opts: { onAgentPlan?: (title: string, description: string, mode?: GeneratedTaskMode) => void } = {}
): Promise<void> {
  const { updateRun, updateRunAction, appendRunLog, markRuleLastRun } = deps

  updateRun(run.id, { status: 'running', startedAt: new Date().toISOString() })
  appendRunLog(run.id, `[autopilot] Run started: ${run.title}`)

  const results: Array<{ action: AutomationAction; ok: boolean; output: string }> = []
  let anyFailed = false

  for (const runAction of run.actions) {
    const t0 = Date.now()
    updateRunAction(run.id, runAction.id, { status: 'running', startedAt: new Date().toISOString() })
    appendRunLog(run.id, `[action] ${runAction.action} started`)

    try {
      let result: { ok: boolean; output: string }

      // Special-case: create-project-health-report synthesises previous results
      if (runAction.action === 'create-project-health-report') {
        const lines = [
          '=== Project Health Report ===',
          ...results.map(r => `${r.ok ? 'PASS' : 'FAIL'} ${r.action}:\n${r.output.split('\n').slice(0, 6).join('\n')}`),
          '=============================',
        ]
        result = { ok: !anyFailed, output: lines.join('\n\n') }
      } else if (runAction.action === 'create-agent-plan' && opts.onAgentPlan) {
        const goal = results.map(r => `${r.action}: ${r.output.split('\n')[0]}`).join(' | ')
        opts.onAgentPlan(
          `Autopilot Agent Plan`,
          `Generated from autopilot run "${run.title}".\n\nContext:\n${goal}\n\nAnalyse the above and produce a step-by-step implementation plan. Report what was found.`
        )
        result = { ok: true, output: 'Agent task queued in Agent Console.' }
      } else if (runAction.action === 'create-visual-evolution-task' && opts.onAgentPlan) {
        opts.onAgentPlan(
          'BertOS Visual Evolution Sprint',
          buildVisualEvolutionTaskDescription(run.title),
          'build',
        )
        result = { ok: true, output: 'Visual evolution build task queued in Agent Console.' }
      } else if (isStarterAutomationAction(runAction.action) && opts.onAgentPlan) {
        opts.onAgentPlan(
          run.title,
          buildStarterAutomationTaskDescription(runAction.action, run.title),
          'plan',
        )
        result = { ok: true, output: `${runAction.action} queued in Agent Console.` }
      } else {
        result = await ACTION_HANDLERS[runAction.action]()
      }

      results.push({ action: runAction.action, ok: result.ok, output: result.output })
      if (!result.ok) anyFailed = true

      const durationMs = Date.now() - t0
      updateRunAction(run.id, runAction.id, {
        status: result.ok ? 'completed' : 'failed',
        finishedAt: new Date().toISOString(),
        durationMs,
        output: result.output.slice(0, 2000),
        error: result.ok ? undefined : result.output.slice(0, 500),
      })
      appendRunLog(run.id, `[action] ${runAction.action} ${result.ok ? 'OK' : 'FAILED'} (${durationMs}ms)`)
      if (!result.ok) appendRunLog(run.id, result.output.split('\n').slice(0, 4).join('\n'))
    } catch (err) {
      anyFailed = true
      const msg = err instanceof Error ? err.message : String(err)
      updateRunAction(run.id, runAction.id, {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        error: msg,
      })
      appendRunLog(run.id, `[error] ${runAction.action}: ${msg}`)
    }
  }

  const summary = results.map(r => `${r.ok ? 'PASS' : 'FAIL'} ${r.action}`).join(' | ')
  updateRun(run.id, {
    status: anyFailed ? 'failed' : 'completed',
    finishedAt: new Date().toISOString(),
    summary,
  })
  appendRunLog(run.id, `[autopilot] Run finished: ${summary}`)

  if (run.ruleId) markRuleLastRun(run.ruleId)
}
