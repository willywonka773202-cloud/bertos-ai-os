import type { NextRequest } from 'next/server'
import { getAssistantProviderStatuses, runAssistant } from '@/lib/bertos/coding/assistant'
import type { ProviderRoutingMode } from '@/lib/bertos/coding/provider-routing'
import { appendTurn } from '@/lib/bertos/coding/threads'
import { CodingOSError } from '@/lib/bertos/coding/types'
import { codingError, ok, readBody } from '@/lib/bertos/coding/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const providers = await getAssistantProviderStatuses()
    return ok({ providers, anyOnline: providers.some(p => p.online) })
  } catch (error) {
    return codingError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody<{ message?: string; projectId?: string; threadId?: string; providerId?: string; routingMode?: ProviderRoutingMode; allowPaid?: boolean }>(req)
    if (!body.message?.trim()) throw new CodingOSError('invalid-input', 'A message is required.')
    const result = await runAssistant({
      message: body.message,
      projectId: body.projectId,
      providerId: body.providerId,
      routingMode: body.routingMode,
      allowPaid: Boolean(body.allowPaid),
    })

    // Persist the turn to a durable thread (creating one if needed).
    let threadId = body.threadId
    try {
      const thread = await appendTurn({
        threadId: body.threadId,
        projectId: body.projectId,
        projectSlug: result.projectSlug,
        userMessage: body.message,
        assistant: {
          reply: result.reply, intent: result.intent, llmUsed: result.llmUsed, providerName: result.providerName,
          outputId: result.outputId, agentRunId: result.agentRunId,
          createdTaskIds: result.createdTaskIds, memoryProposalIds: result.memoryProposalIds,
        },
      })
      threadId = thread.threadId
    } catch {
      // thread persistence is best-effort; the answer still returns
    }

    return ok({ result, threadId }, 201)
  } catch (error) {
    return codingError(error)
  }
}
