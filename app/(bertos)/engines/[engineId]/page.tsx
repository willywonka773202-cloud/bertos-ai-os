import { notFound } from 'next/navigation'
import { AgentEngineChatView } from '@/components/bertos/agents/AgentEngineChatView'
import { OpenClawControlView } from '@/components/bertos/openclaw/OpenClawControlView'
import { getAgentEngine } from '@/lib/bertos/agent-engines'

export const dynamic = 'force-dynamic'

export default async function EnginePage({ params }: { params: Promise<{ engineId: string }> }) {
  const { engineId } = await params
  const engine = getAgentEngine(engineId)
  if (!engine) notFound()
  if (engine.id === 'openclaw') return <OpenClawControlView engine={engine} />
  return <AgentEngineChatView engine={engine} />
}
