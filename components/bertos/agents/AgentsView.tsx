'use client'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Plus, Play, Pause, CheckCircle2, XCircle,
  Clock, Activity, ChevronDown, ChevronUp, Cpu, Globe, Zap, Sparkles,
  Trash2
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useAgentStore } from '@/store/bertos/agents'
import type { AgentTask, AIModel } from '@/lib/bertos/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
const TASK_TEMPLATES = [
  { title: 'BertOS Self-Improve',     description: 'Run full BertOS scan, propose highest-priority improvements, patch + typecheck + build',          model: 'auto' as AIModel,        estimatedTime: '~12 min' },
  { title: 'Refactor Frontend',       description: 'Analyze and modernize all React components, extract reusable logic, improve TypeScript types',    model: 'ollama-pro' as AIModel,  estimatedTime: '~8 min' },
  { title: 'Fix TypeScript Errors',   description: 'Scan codebase for type errors and fix them systematically',                                       model: 'ollama-pro' as AIModel,  estimatedTime: '~3 min' },
  { title: 'Generate Documentation',  description: 'Write comprehensive JSDoc comments for all exported functions',                                   model: 'claude-code' as AIModel, estimatedTime: '~5 min' },
  { title: 'Research Architecture',   description: 'Research best practices for the current tech stack and write recommendations',                     model: 'gemini-cli' as AIModel,  estimatedTime: '~4 min' },
  { title: 'Improve UI Components',   description: 'Review all UI components and suggest accessibility and UX improvements',                           model: 'claude-code' as AIModel, estimatedTime: '~6 min' },
  { title: 'Generate Test Suite',     description: 'Create comprehensive unit and integration tests for the entire codebase',                          model: 'codex-cli' as AIModel,   estimatedTime: '~10 min' },
]

const MODEL_META: Record<string, { icon: React.ReactNode; color: string; variant: 'ollama-pro' | 'claude-code' | 'gemini-cli' | 'codex-cli' | 'auto' | 'default' }> = {
  'ollama-pro':   { icon: <Bot      className="w-3.5 h-3.5" />, color: '#F97316', variant: 'ollama-pro'  },
  'qwen2.5-coder':{ icon: <Bot      className="w-3.5 h-3.5" />, color: '#F97316', variant: 'ollama-pro'  },
  'claude-code':  { icon: <Cpu      className="w-3.5 h-3.5" />, color: '#8B5CF6', variant: 'claude-code' },
  'gemini-cli':   { icon: <Globe    className="w-3.5 h-3.5" />, color: '#3B82F6', variant: 'gemini-cli'  },
  'codex-cli':    { icon: <Zap      className="w-3.5 h-3.5" />, color: '#10B981', variant: 'codex-cli'   },
  auto:           { icon: <Sparkles className="w-3.5 h-3.5" />, color: '#F59E0B', variant: 'auto'        },
}

const STATUS_CONFIG: Record<AgentTask['status'], { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
  pending: { icon: <Clock className="w-3.5 h-3.5" />, color: 'text-zinc-400', bgColor: 'bg-zinc-400', label: 'Pending' },
  running: { icon: <Activity className="w-3.5 h-3.5 animate-pulse" />, color: 'text-violet-400', bgColor: 'bg-violet-400', label: 'Running' },
  paused: { icon: <Pause className="w-3.5 h-3.5" />, color: 'text-amber-400', bgColor: 'bg-amber-400', label: 'Paused' },
  done: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'text-emerald-400', bgColor: 'bg-emerald-400', label: 'Complete' },
  failed: { icon: <XCircle className="w-3.5 h-3.5" />, color: 'text-red-400', bgColor: 'bg-red-400', label: 'Failed' },
}

function TaskCard({ task }: { task: AgentTask }) {
  const { deleteTask, setStatus, addLog, setProgress } = useAgentStore()
  const [expanded, setExpanded] = useState(false)
  const meta = MODEL_META[task.model] ?? MODEL_META['ollama-pro']
  const status = STATUS_CONFIG[task.status]

  const simulate = async () => {
    setStatus(task.id, 'running')
    setProgress(task.id, 15)
    addLog(task.id, { level: 'info', message: 'Routing task to local CLI bridge...' })
    try {
      const providerId = task.model === 'auto' || task.model === 'ollama-pro' ? 'codex-cli' : task.model
      const res = await fetch('/api/local-daemon/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          prompt: `${task.title}\n\n${task.description}\n\nReturn an implementation plan and the exact files you would inspect first. Do not claim edits were made.`,
          timeoutMs: 180000,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'Local CLI task failed.')
      setProgress(task.id, 100)
      setStatus(task.id, 'done')
      addLog(task.id, { level: 'success', message: `${providerId} completed.` })
      if (data.stdout) addLog(task.id, { level: 'info', message: data.stdout.slice(0, 1200) })
    } catch (error) {
      setStatus(task.id, 'failed')
      addLog(task.id, {
        level: 'error',
        message: error instanceof Error ? error.message : 'Agent task failed. Start npm run bertos:daemon and retry.',
      })
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-all duration-300',
        task.status === 'running' && 'border-violet-500/30 bg-violet-500/5',
        task.status === 'done' && 'border-emerald-500/20 bg-emerald-500/5',
        task.status === 'failed' && 'border-red-500/20 bg-red-500/5',
        task.status === 'pending' || task.status === 'paused' ? 'border-zinc-800 bg-zinc-900/50' : ''
      )}
    >
      <div className="flex items-start gap-3">
        {/* Model icon */}
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border"
          style={{ borderColor: `${meta.color}30`, background: `${meta.color}15` }}
        >
          <span style={{ color: meta.color }}>{meta.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-zinc-200">{task.title}</h3>
            <Badge variant={meta.variant} className="text-[9px] h-4 px-1.5">
              {task.model}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500 line-clamp-2">{task.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn('text-xs flex items-center gap-1', status.color)}>
            {status.icon}
            {status.label}
          </span>
          {task.status === 'pending' && (
            <Button size="sm" onClick={simulate}>
              <Play className="w-3 h-3" />
              Run
            </Button>
          )}
          {task.status === 'done' && (
            <Button size="icon-sm" variant="ghost" onClick={() => deleteTask(task.id)} className="text-zinc-600">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {(task.status === 'running' || task.status === 'done') && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-zinc-600">
            <span>Progress</span>
            <span>{task.progress}%</span>
          </div>
          <Progress value={task.progress} />
        </div>
      )}

      {/* Logs toggle */}
      {task.logs.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {task.logs.length} log entries
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-2"
              >
                <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 font-mono text-[11px] space-y-1 max-h-40 overflow-y-auto">
                  {task.logs.map(log => (
                    <div key={log.id} className={cn(
                      'flex items-start gap-2',
                      log.level === 'error' && 'text-red-400',
                      log.level === 'warn' && 'text-amber-400',
                      log.level === 'success' && 'text-emerald-400',
                      log.level === 'info' && 'text-zinc-500',
                    )}>
                      <span className="text-zinc-700 flex-shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}

function AgentStatTile({ label, value, tone, pulse }: { label: string; value: number; tone: 'violet' | 'emerald' | 'amber' | 'red' | 'zinc'; pulse?: boolean }) {
  const toneMap = {
    violet: 'text-violet-300 border-violet-500/20 bg-violet-500/5',
    emerald: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5',
    amber: 'text-amber-300 border-amber-500/20 bg-amber-500/5',
    red: 'text-red-300 border-red-500/20 bg-red-500/5',
    zinc: 'text-zinc-300 border-zinc-800 bg-zinc-900/40',
  }
  return (
    <div className={cn('rounded-xl border px-4 py-3', toneMap[tone])}>
      <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-0.5">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-xl font-bold font-mono">{value}</p>
        {pulse && value > 0 && <div className={cn('w-2 h-2 rounded-full animate-pulse', {
          violet: 'bg-violet-400', emerald: 'bg-emerald-400', amber: 'bg-amber-400', red: 'bg-red-400', zinc: 'bg-zinc-400',
        }[tone])} />}
      </div>
    </div>
  )
}

export function AgentsView() {
  const { tasks, createTask } = useAgentStore()
  const [showTemplates, setShowTemplates] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [customModel, setCustomModel] = useState<AIModel>('auto')

  const addFromTemplate = (template: typeof TASK_TEMPLATES[number]) => {
    createTask({ title: template.title, description: template.description, model: template.model })
    setShowTemplates(false)
  }

  const addCustom = () => {
    if (!customTitle.trim()) return
    createTask({ title: customTitle.trim(), description: customDesc.trim() || 'Custom agent task', model: customModel })
    setCustomTitle('')
    setCustomDesc('')
  }

  const running = tasks.filter(t => t.status === 'running').length
  const done = tasks.filter(t => t.status === 'done').length
  const failed = tasks.filter(t => t.status === 'failed').length
  const pending = tasks.filter(t => t.status === 'pending').length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hero header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-zinc-800/50 bg-zinc-950/40">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <motion.div
              animate={{ boxShadow: running > 0
                ? ['0 0 10px rgba(139,92,246,0.2)', '0 0 20px rgba(139,92,246,0.4)', '0 0 10px rgba(139,92,246,0.2)']
                : '0 0 0px transparent'
              }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0"
            >
              <Bot className={cn('w-5 h-5', running > 0 ? 'text-violet-400' : 'text-violet-500')} />
            </motion.div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100 tracking-tight">Agent Tasks</h1>
              <p className="text-xs text-zinc-500">Long-running autonomous AI operations — run, monitor, approve</p>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <AgentStatTile label="Running" value={running} tone="violet" pulse />
            <AgentStatTile label="Pending" value={pending} tone="zinc" />
            <AgentStatTile label="Done" value={done} tone="emerald" />
            <AgentStatTile label="Failed" value={failed} tone={failed > 0 ? 'red' : 'zinc'} />
          </div>

          {/* Create task */}
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-2 focus-within:border-zinc-700 transition-colors">
              <input
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addCustom()}
                placeholder="Task title: e.g. Refactor the authentication module"
                className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
              />
              <input
                value={customDesc}
                onChange={e => setCustomDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full bg-transparent text-xs text-zinc-400 placeholder:text-zinc-700 outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <select
                value={customModel}
                onChange={e => setCustomModel(e.target.value as AIModel)}
                className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400 outline-none"
              >
                <option value="auto">Auto</option>
                <option value="claude-code">Claude Code</option>
                <option value="codex-cli">Codex CLI</option>
                <option value="gemini-cli">Gemini CLI</option>
              </select>
              <Button onClick={addCustom} disabled={!customTitle.trim()} size="sm">
                <Plus className="w-3.5 h-3.5" /> Add Task
              </Button>
            </div>
          </div>

          {/* Templates */}
          <div className="mt-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
            >
              {showTemplates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Browse task templates ({TASK_TEMPLATES.length})
            </button>
            <AnimatePresence>
              {showTemplates && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-2"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {TASK_TEMPLATES.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => addFromTemplate(t)}
                        className="text-left rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-violet-500/30 hover:bg-violet-500/5 p-3 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">{t.title}</p>
                          <Badge variant={(MODEL_META[t.model]?.variant ?? 'default') as 'ollama-pro' | 'claude-code' | 'gemini-cli' | 'codex-cli' | 'auto' | 'default'} className="text-[9px] h-4">{t.model}</Badge>
                        </div>
                        <p className="text-[11px] text-zinc-600 line-clamp-2">{t.description}</p>
                        <p className="text-[10px] text-zinc-700 mt-1">{t.estimatedTime}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Tasks list */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-4 space-y-3">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="relative mb-6">
                <motion.div
                  animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.2, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-violet-500/10"
                />
                <div className="relative w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <Bot className="w-8 h-8 text-zinc-700" />
                </div>
              </div>
              <p className="text-sm font-semibold text-zinc-400">No agent tasks yet</p>
              <p className="text-xs text-zinc-600 mt-1 max-w-xs">
                Create a custom task above or pick a template to launch an autonomous AI operation.
              </p>
              <button
                onClick={() => setShowTemplates(true)}
                className="mt-4 text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Browse templates
              </button>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
