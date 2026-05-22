'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClipboardCopy, KanbanSquare, Plus, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AGENT_ROSTER,
  BUILDER_MODE_OPTIONS,
  TASK_TYPE_OPTIONS,
  buildSelfCodingPrompt,
  type CommandCenterAgentId,
  type CommandCenterMode,
  type CommandCenterTaskType,
} from '@/lib/bertos/command-center'

type TaskStatus =
  | 'Draft'
  | 'Prompt Generated'
  | 'Sent to External Agent'
  | 'In Progress'
  | 'Needs Review'
  | 'Blocked'
  | 'Complete'

interface CommandCenterTask {
  id: string
  title: string
  status: TaskStatus
  agentId: CommandCenterAgentId
  taskType: CommandCenterTaskType
  mode: CommandCenterMode
  createdAt: string
  nextAction: string
  prompt: string
}

const STORAGE_KEY = 'bertos-command-center-tasks'
const STATUSES: TaskStatus[] = ['Draft', 'Prompt Generated', 'Sent to External Agent', 'In Progress', 'Needs Review', 'Blocked', 'Complete']

const seedTasks: CommandCenterTask[] = [
  {
    id: 'seed-builder-loop',
    title: 'Use Builder for the next scoped self-coding task',
    status: 'Draft',
    agentId: 'codex-cli',
    taskType: 'bug-fix',
    mode: 'external-prompt',
    createdAt: new Date().toISOString(),
    nextAction: 'Open Builder, compile a scoped prompt, then copy to the chosen agent.',
    prompt: buildSelfCodingPrompt({
      title: 'Use Builder for the next scoped self-coding task',
      description: 'Create a focused BertOS task prompt, choose a provider, and validate after implementation.',
      taskType: 'bug-fix',
      mode: 'external-prompt',
      agentId: 'codex-cli',
    }),
  },
]

function loadTasks() {
  if (typeof window === 'undefined') return seedTasks
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedTasks
    const parsed = JSON.parse(raw) as CommandCenterTask[]
    return Array.isArray(parsed) ? parsed : seedTasks
  } catch {
    return seedTasks
  }
}

export function TasksView() {
  const [tasks, setTasks] = useState<CommandCenterTask[]>(seedTasks)
  const [query, setQuery] = useState('')
  const [title, setTitle] = useState('')
  const [taskType, setTaskType] = useState<CommandCenterTaskType>('bug-fix')
  const [agentId, setAgentId] = useState<CommandCenterAgentId>('codex-cli')
  const [mode, setMode] = useState<CommandCenterMode>('external-prompt')

  useEffect(() => {
    setTasks(loadTasks())
  }, [])

  const persist = (items: CommandCenterTask[]) => {
    setTasks(items)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      toast.error('Could not save tasks to localStorage.')
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tasks
    return tasks.filter(task =>
      task.title.toLowerCase().includes(q) ||
      task.status.toLowerCase().includes(q) ||
      task.agentId.toLowerCase().includes(q) ||
      task.taskType.toLowerCase().includes(q),
    )
  }, [tasks, query])

  const createTask = () => {
    const taskTitle = title.trim() || 'New BertOS task'
    const prompt = buildSelfCodingPrompt({
      title: taskTitle,
      description: 'Complete this BertOS task as a scoped, reviewable implementation.',
      taskType,
      mode,
      agentId,
    })
    const task: CommandCenterTask = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: taskTitle,
      status: 'Draft',
      agentId,
      taskType,
      mode,
      createdAt: new Date().toISOString(),
      nextAction: mode === 'external-prompt' ? 'Copy the prompt to the selected external agent.' : 'Open Builder and refine the task before running checks.',
      prompt,
    }
    persist([task, ...tasks])
    setTitle('')
    toast.success('Task created.')
  }

  const updateStatus = (id: string, status: TaskStatus) => {
    persist(tasks.map(task => task.id === id ? { ...task, status } : task))
  }

  const copyPrompt = async (task: CommandCenterTask) => {
    await navigator.clipboard.writeText(task.prompt)
    toast.success('Task prompt copied.')
  }

  return (
    <div className="flex h-full bg-[#09090B]">
      <aside className="hidden w-80 shrink-0 border-r border-zinc-800/50 bg-zinc-950/70 lg:block">
        <div className="border-b border-zinc-800/50 p-4">
          <div className="flex items-center gap-2">
            <KanbanSquare className="h-4 w-4 text-violet-400" />
            <h1 className="text-sm font-semibold text-zinc-100">Tasks</h1>
          </div>
          <p className="mt-1 text-xs text-zinc-600">Local task tracker for prompts, reviews, and self-coding work.</p>
        </div>
        <div className="space-y-3 p-4">
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="Task title"
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-violet-500/60"
          />
          <select
            value={taskType}
            onChange={event => setTaskType(event.target.value as CommandCenterTaskType)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none"
          >
            {TASK_TYPE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <select
            value={agentId}
            onChange={event => setAgentId(event.target.value as CommandCenterAgentId)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none"
          >
            {AGENT_ROSTER.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
          <select
            value={mode}
            onChange={event => setMode(event.target.value as CommandCenterMode)}
            className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none"
          >
            {BUILDER_MODE_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <Button onClick={createTask} className="w-full">
            <Plus className="h-4 w-4" />Create task
          </Button>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200/75">
            Tasks are localStorage only. They help track external-agent prompts and reviews, but they do not run code or apply patches by themselves.
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden">
        <div className="border-b border-zinc-800/50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                <h2 className="text-xl font-bold text-zinc-100">BertOS Task Board</h2>
              </div>
              <p className="max-w-2xl text-sm text-zinc-500">
                Track self-coding tasks from draft prompt to external agent, review, validation, and completion.
              </p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search tasks"
                className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-700"
              />
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100%-105px)]">
          <div className="grid min-w-[920px] gap-3 p-4 xl:grid-cols-7">
            {STATUSES.map(status => {
              const group = filtered.filter(task => task.status === status)
              return (
                <section key={status} className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-zinc-300">{status}</h3>
                    <Badge variant="default" className="text-[10px]">{group.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {group.length === 0 && <div className="rounded-lg border border-dashed border-zinc-800 p-3 text-[11px] text-zinc-700">No tasks</div>}
                    {group.map(task => {
                      const agent = AGENT_ROSTER.find(item => item.id === task.agentId)
                      return (
                        <article key={task.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <h4 className="text-xs font-semibold text-zinc-100">{task.title}</h4>
                            <button onClick={() => void copyPrompt(task)} className="text-zinc-600 hover:text-zinc-300" title="Copy task prompt">
                              <ClipboardCopy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="space-y-1 text-[11px] text-zinc-600">
                            <div>{agent?.name ?? task.agentId}</div>
                            <div>{TASK_TYPE_OPTIONS.find(item => item.id === task.taskType)?.label ?? task.taskType}</div>
                            <div>{new Date(task.createdAt).toLocaleDateString()}</div>
                          </div>
                          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{task.nextAction}</p>
                          <select
                            value={task.status}
                            onChange={event => updateStatus(task.id, event.target.value as TaskStatus)}
                            className="mt-3 h-8 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-[11px] text-zinc-400 outline-none"
                          >
                            {STATUSES.map(item => <option key={item} value={item}>{item}</option>)}
                          </select>
                        </article>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}
