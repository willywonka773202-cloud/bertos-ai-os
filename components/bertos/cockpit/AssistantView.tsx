'use client'
import { useCallback, useEffect, useState } from 'react'
import { Bot, MessageSquarePlus, Trash2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RouteHero } from '@/components/bertos/hermes'
import { AICommandCenter, type ChatMsg } from './AICommandCenter'
import { getJson, type CockpitProject } from './types'

interface ThreadMessage { role: 'user' | 'assistant'; content: string; intent?: string; llmUsed?: boolean; providerName?: string; outputId?: string; agentRunId?: string; createdTaskIds?: string[]; memoryProposalIds?: string[] }
interface Thread { threadId: string; title: string; providerMode: string; updatedAt: string; messages: ThreadMessage[]; projectSlug?: string }

function toChatMsgs(messages: ThreadMessage[]): ChatMsg[] {
  return messages.map(m => m.role === 'user'
    ? { role: 'user', content: m.content }
    : { role: 'assistant', content: m.content, result: { reply: m.content, intent: m.intent ?? 'general', llmUsed: Boolean(m.llmUsed), providerName: m.providerName, degraded: !m.llmUsed, outputId: m.outputId, agentRunId: m.agentRunId, createdTaskIds: m.createdTaskIds ?? [], memoryProposalIds: m.memoryProposalIds ?? [], groundedIn: [] } })
}

export function AssistantView() {
  const [project, setProject] = useState<CockpitProject | null>(null)
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | undefined>()
  const [initialMessages, setInitialMessages] = useState<ChatMsg[]>([])
  const [chatKey, setChatKey] = useState(0)

  const loadThreads = useCallback(async (projectId?: string) => {
    const params = projectId ? `?projectId=${projectId}` : ''
    const d = await getJson<{ threads: Thread[] }>(`/api/bertos/coding/threads${params}`)
    setThreads(d.threads ?? [])
  }, [])

  useEffect(() => {
    void getJson<{ project: CockpitProject | null }>('/api/bertos/coding/overview').then(d => {
      setProject(d.project ?? null)
      void loadThreads(d.project?.projectId)
    })
  }, [loadThreads])

  const newThread = () => { setActiveThreadId(undefined); setInitialMessages([]); setChatKey(k => k + 1) }
  const openThread = async (threadId: string) => {
    const d = await getJson<{ thread: Thread }>(`/api/bertos/coding/threads/${threadId}`)
    if (d.thread) { setActiveThreadId(threadId); setInitialMessages(toChatMsgs(d.thread.messages)); setChatKey(k => k + 1) }
  }
  const removeThread = async (threadId: string) => {
    await fetch(`/api/bertos/coding/threads/${threadId}`, { method: 'DELETE' })
    if (threadId === activeThreadId) newThread()
    await loadThreads(project?.projectId)
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <RouteHero
          eyebrow="main ai interface"
          title="AI Assistant"
          subtitle="Your project-aware AI for everyday coding. Grounded in the active project — every prompt creates a run and an output, and conversations are saved as threads."
          seal={<Bot className="h-5 w-5" />}
          status="active"
          metrics={[
            { label: 'Active project', value: project?.name ?? 'none', detail: project ? project.slug : 'register one', tone: project ? 'cyan' : 'amber' },
            { label: 'Threads', value: threads.length, detail: 'saved conversations', tone: 'bronze' },
            { label: 'Records', value: 'run + output', detail: 'per prompt', tone: 'emerald' },
            { label: 'Safety', value: 'approval-gated', detail: 'no auto actions', tone: 'violet' },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
          <div className="space-y-2">
            <Button size="sm" className="w-full" onClick={newThread}><MessageSquarePlus className="h-3.5 w-3.5" /> New thread</Button>
            <div className="space-y-1.5 rounded-xl border border-zinc-800 bg-black/20 p-2">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-600">Recent threads</p>
              {threads.length === 0 ? (
                <p className="px-1 py-2 text-xs text-zinc-600">No saved threads yet. Ask something to start one.</p>
              ) : threads.map(t => (
                <div key={t.threadId} className={`group flex items-center gap-1 rounded-lg border px-2 py-1.5 ${activeThreadId === t.threadId ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-transparent hover:border-zinc-700'}`}>
                  <button onClick={() => openThread(t.threadId)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-xs text-zinc-300">{t.title}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[9px] text-zinc-600">
                      <Badge variant={t.providerMode === 'llm' ? 'success' : t.providerMode === 'local' ? 'warning' : 'default'}>{t.providerMode}</Badge>
                      {t.messages?.length ?? 0} msgs
                    </span>
                  </button>
                  <button onClick={() => removeThread(t.threadId)} className="shrink-0 text-zinc-700 opacity-0 transition group-hover:opacity-100 hover:text-red-300"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </div>
          <AICommandCenter
            key={chatKey}
            projectId={project?.projectId}
            projectName={project?.name}
            threadId={activeThreadId}
            initialMessages={initialMessages}
            onThreadChange={id => { setActiveThreadId(id); void loadThreads(project?.projectId) }}
            heightClass="max-h-[560px]"
          />
        </div>
      </div>
    </ScrollArea>
  )
}
