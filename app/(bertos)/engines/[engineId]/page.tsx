import { notFound } from 'next/navigation'
import { AgentEngineChatView } from '@/components/bertos/agents/AgentEngineChatView'
import { AGENT_ENGINES, getAgentEngine } from '@/lib/bertos/agent-engines'

export function generateStaticParams() {
  return AGENT_ENGINES.map(engine => ({ engineId: engine.id }))
}

export default async function EnginePage({ params }: { params: Promise<{ engineId: string }> }) {
  const { engineId } = await params
  const engine = getAgentEngine(engineId)
  if (!engine) notFound()
  return <AgentEngineChatView engine={engine} />
}
