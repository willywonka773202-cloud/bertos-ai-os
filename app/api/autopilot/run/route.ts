import { NextRequest, NextResponse } from 'next/server'
import type { AutomationAction } from '@/store/bertos/automations'

export const runtime = 'nodejs'

interface IncomingAction {
  id: string
  action: AutomationAction
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

async function execDaemonRun(
  origin: string,
  executable: string,
  args: string[],
  timeoutMs = 60000
): Promise<{ stdout: string; stderr: string; exitCode: number | null; error?: string }> {
  try {
    const res = await fetch(`${origin}/api/local-daemon/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ executable, args, timeoutMs }),
      signal: AbortSignal.timeout(timeoutMs + 5000),
    })
    if (!res.ok) {
      const err = await res.text()
      return { stdout: '', stderr: '', exitCode: null, error: `Daemon error ${res.status}: ${err.slice(0, 200)}` }
    }
    const data = await res.json() as { stdout?: string; stderr?: string; exitCode?: number | null; error?: string }
    return {
      stdout: data.stdout ?? '',
      stderr: data.stderr ?? '',
      exitCode: data.exitCode ?? null,
      error: data.error,
    }
  } catch (err) {
    return {
      stdout: '',
      stderr: '',
      exitCode: null,
      error: err instanceof Error ? err.message : 'Daemon unreachable',
    }
  }
}

async function checkProviderHealth(origin: string): Promise<string> {
  try {
    const res = await fetch(`${origin}/api/providers/status`, { cache: 'no-store' })
    if (!res.ok) return `Provider status endpoint returned ${res.status}`
    const d = await res.json() as {
      ollama?: { online: boolean; defaultModel: string; mode: string; error?: string }
      localDaemon?: { online: boolean; tools?: Array<{ id: string; label: string; installed: boolean; loginStatus: string }> }
      apiProviders?: { enabled: boolean; anthropic: boolean; openai: boolean; gemini: boolean }
    }
    const lines: string[] = []
    if (d.ollama) {
      lines.push(`Ollama: ${d.ollama.online ? '✓ online' : '✗ offline'} (${d.ollama.mode}, model: ${d.ollama.defaultModel})${d.ollama.error ? ` — ${d.ollama.error}` : ''}`)
    }
    if (d.localDaemon?.tools) {
      for (const t of d.localDaemon.tools) {
        const ok = t.installed && t.loginStatus === 'available'
        lines.push(`${t.label}: ${ok ? '✓ available' : '✗ unavailable'}${!t.installed ? ' (not installed)' : t.loginStatus !== 'available' ? ` (${t.loginStatus})` : ''}`)
      }
    }
    if (d.apiProviders?.enabled) {
      lines.push(`Anthropic API: ${d.apiProviders.anthropic ? '✓ key set' : '✗ key missing'}`)
      lines.push(`OpenAI API: ${d.apiProviders.openai ? '✓ key set' : '✗ key missing'}`)
      lines.push(`Gemini API: ${d.apiProviders.gemini ? '✓ key set' : '✗ key missing'}`)
    } else {
      lines.push('API providers: disabled (enable in Settings → Providers)')
    }
    return lines.join('\n') || 'No providers found'
  } catch (err) {
    return `Failed to reach providers/status: ${err instanceof Error ? err.message : 'unknown'}`
  }
}

export async function POST(req: NextRequest) {
  let body: { runId: string; ruleId?: string; actions: IncomingAction[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { runId, actions } = body
  const origin = new URL(req.url).origin
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* closed */ }
      }

      try {
        send({ type: 'log', message: `Starting run ${runId} with ${actions.length} action(s)` })

        for (const actionDef of actions) {
          const { id: actionId, action } = actionDef
          const t0 = Date.now()
          send({ type: 'action-start', actionId, action })

          try {
            let output = ''
            let failed = false
            let approvalRequired = false

            if (action === 'check-provider-health') {
              output = await checkProviderHealth(origin)

            } else if (action === 'git-status') {
              const r = await execDaemonRun(origin, 'git', ['status', '--short'])
              if (r.error) { output = r.error; failed = true }
              else output = r.stdout.trim() || 'Working tree clean'

            } else if (action === 'git-diff-stat') {
              const r = await execDaemonRun(origin, 'git', ['diff', '--stat'])
              if (r.error) { output = r.error; failed = true }
              else output = r.stdout.trim() || 'No unstaged changes'

            } else if (action === 'run-typecheck') {
              send({ type: 'log', message: 'Running npm run typecheck (may take up to 3min)...' })
              const r = await execDaemonRun(origin, 'npm', ['run', 'typecheck'], 180000)
              if (r.error) { output = r.error; failed = true }
              else {
                const exitOk = r.exitCode === 0
                output = [
                  `Exit code: ${r.exitCode ?? 'unknown'}`,
                  r.stdout.trim(),
                  r.stderr.trim(),
                ].filter(Boolean).join('\n')
                if (!exitOk) failed = true
              }

            } else if (action === 'run-build') {
              send({ type: 'log', message: 'Running npm run build (may take up to 5min)...' })
              const r = await execDaemonRun(origin, 'npm', ['run', 'build'], 300000)
              if (r.error) { output = r.error; failed = true }
              else {
                const exitOk = r.exitCode === 0
                output = [
                  `Exit code: ${r.exitCode ?? 'unknown'}`,
                  r.stdout.slice(-4000).trim(),
                  r.stderr.trim(),
                ].filter(Boolean).join('\n')
                if (!exitOk) failed = true
              }

            } else if (action === 'run-lint') {
              send({ type: 'log', message: 'Running npm run lint...' })
              const r = await execDaemonRun(origin, 'npm', ['run', 'lint'], 180000)
              if (r.error) { output = r.error; failed = true }
              else {
                const exitOk = r.exitCode === 0
                output = [
                  `Exit code: ${r.exitCode ?? 'unknown'}`,
                  r.stdout.trim(),
                  r.stderr.trim(),
                ].filter(Boolean).join('\n')
                if (!exitOk) failed = true
              }

            } else if (action === 'run-tests') {
              send({ type: 'log', message: 'Running npm test...' })
              const r = await execDaemonRun(origin, 'npm', ['test'], 180000)
              if (r.error) { output = r.error; failed = true }
              else {
                output = [
                  `Exit code: ${r.exitCode ?? 'unknown'}`,
                  r.stdout.trim(),
                  r.stderr.trim(),
                ].filter(Boolean).join('\n')
                if (r.exitCode !== 0) failed = true
              }

            } else if (action === 'create-project-health-report') {
              // Collect recent git + typecheck data and format a report summary
              const [statusR, diffR] = await Promise.all([
                execDaemonRun(origin, 'git', ['status', '--short']),
                execDaemonRun(origin, 'git', ['log', '--oneline', '-5']),
              ])
              output = [
                '=== Project Health Report ===',
                `Generated: ${new Date().toISOString()}`,
                '',
                '--- Git Status ---',
                statusR.stdout.trim() || 'Working tree clean',
                '',
                '--- Recent Commits ---',
                diffR.stdout.trim() || 'No commits found',
              ].join('\n')

            } else if (action === 'create-agent-plan' || action === 'create-workspace-debug-task') {
              // These require user approval before any agent action is created
              approvalRequired = true
              output = `Action "${action}" requires your approval. Review and click Approve in the Autopilot panel to create the agent task.`
            }

            const durationMs = Date.now() - t0

            if (approvalRequired) {
              send({
                type: 'approval-required',
                actionId,
                action,
                message: output,
                durationMs,
              })
              send({ type: 'run-blocked', message: 'Run paused — awaiting approval for ' + action })
              send({ type: 'log', message: `⚠️ Approval required for ${action}` })
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
              return
            }

            if (failed) {
              send({ type: 'action-failed', actionId, action, error: output, durationMs })
              send({ type: 'log', message: `✗ ${action} failed in ${formatMs(durationMs)}` })
            } else {
              send({ type: 'action-complete', actionId, action, output, durationMs })
              send({ type: 'log', message: `✓ ${action} completed in ${formatMs(durationMs)}` })
            }
          } catch (err) {
            const durationMs = Date.now() - t0
            const error = err instanceof Error ? err.message : 'Unexpected error'
            send({ type: 'action-failed', actionId, action, error, durationMs })
            send({ type: 'log', message: `✗ ${action} threw: ${error}` })
          }
        }

        const successCount = actions.length
        const summary = `${successCount} action(s) executed.`
        send({ type: 'run-complete', summary })
        send({ type: 'log', message: `Run complete: ${summary}` })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Run error'
        send({ type: 'run-failed', error: msg })
        send({ type: 'log', message: `Run failed: ${msg}` })
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
