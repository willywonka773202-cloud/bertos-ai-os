import { NextRequest, NextResponse } from 'next/server'
import { buildLanePrompt } from '@/lib/bertos/agent-orchestrator'
import { askWithProviderRouter, getVerifiedProviderStatuses } from '@/lib/bertos/providers/router'
import { routePrompt } from '@/lib/bertos/router'
import type { AgentExecutionLane, AIModel } from '@/lib/bertos/types'

export const runtime = 'nodejs'

interface OrchestrateRequest {
  prompt?: string
  run?: boolean
  allowCliAgents?: boolean
  maxParallelLanes?: number
}

function laneCanRun(lane: AgentExecutionLane, onlineProviders: Set<string>, allowCliAgents: boolean) {
  if (lane.risk !== 'safe') return false
  if (!lane.canRunInParallel) return false
  if (!onlineProviders.has(lane.provider)) return false
  if (lane.requiresDaemon && !allowCliAgents) return false
  return true
}

export async function POST(req: NextRequest) {
  let body: OrchestrateRequest
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  const prompt = body.prompt?.trim()
  if (!prompt) return NextResponse.json({ ok: false, error: 'prompt is required.' }, { status: 400 })

  const decision = routePrompt(prompt, 'auto')
  const plan = decision.orchestration
  if (!plan) return NextResponse.json({ ok: false, error: 'Could not build orchestration plan.' }, { status: 500 })

  const statuses = await getVerifiedProviderStatuses()
  const onlineProviders = new Set(statuses.filter(status => status.online).map(status => status.providerId))
  const allowCliAgents = Boolean(body.allowCliAgents)
  const maxParallelLanes = Math.max(1, Math.min(body.maxParallelLanes ?? plan.maxParallelLanes, 4))
  const runnableLanes = plan.lanes
    .filter(lane => laneCanRun(lane, onlineProviders, allowCliAgents))
    .slice(0, maxParallelLanes)

  if (!body.run) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      decision,
      plan,
      runnableLaneIds: runnableLanes.map(lane => lane.id),
      skippedLanes: plan.lanes
        .filter(lane => !runnableLanes.some(runnable => runnable.id === lane.id))
        .map(lane => ({
          id: lane.id,
          provider: lane.provider,
          reason: lane.risk !== 'safe'
            ? 'approval-gated'
            : lane.requiresDaemon && !allowCliAgents
              ? 'CLI/daemon lane requires allowCliAgents=true'
              : !onlineProviders.has(lane.provider)
                ? 'provider unavailable'
                : 'not selected for this run',
        })),
    })
  }

  if (runnableLanes.length === 0) {
    return NextResponse.json({
      ok: false,
      decision,
      plan,
      error: 'No safe online parallel lanes are runnable. Start providers or pass allowCliAgents=true for read-only CLI lanes.',
    }, { status: 409 })
  }

  const started = Date.now()
  const results = await Promise.all(runnableLanes.map(async lane => {
    const lanePrompt = buildLanePrompt(plan, lane.id, prompt)
    const result = await askWithProviderRouter(lanePrompt, lane.provider as AIModel, {
      mode: 'chat',
      purpose: 'chat',
      maxTokens: lane.budget.maxOutputTokens,
      laneId: lane.id,
      safeMode: true,
      disableInventoryShortcut: true,
    })
    return {
      laneId: lane.id,
      laneLabel: lane.label,
      provider: lane.provider,
      ok: result.ok,
      text: result.text,
      latencyMs: result.latencyMs,
      fallbackUsed: result.fallbackUsed,
      selectedProvider: result.selectedProvider,
      error: result.error,
    }
  }))

  return NextResponse.json({
    ok: results.some(result => result.ok),
    durationMs: Date.now() - started,
    decision,
    plan,
    results,
  })
}
