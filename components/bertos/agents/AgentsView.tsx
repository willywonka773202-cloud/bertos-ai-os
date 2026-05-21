'use client'
import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Plus, Play, CheckCircle2, XCircle, Clock, Activity,
  ChevronDown, ChevronUp, Cpu, Globe, Zap, Sparkles, Trash2,
  FileText, Search, Terminal, GitBranch, Shield, BookOpen,
  Copy,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useAgentStore } from '@/store/bertos/agents'
import { useUIStore } from '@/store/bertos/ui'
import type { AgentTask, AgentStep, AgentStepType, AIModel } from '@/lib/bertos/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DaemonHealthBanner } from '@/components/bertos/shell/DaemonHealthBanner'
import { useDaemonHealth } from '@/hooks/useDaemonHealth'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'

const TASK_TEMPLATES = [
  { title: 'Fix TypeScript Errors',   description: 'Scan codebase for type errors and fix them systematically. Report what was fixed.', model: 'codex-cli' as AIModel, mode: 'debug' as AgentTask['mode'] },
  { title: 'Refactor Frontend',        description: 'Analyze React components, extract reusable logic, improve TypeScript types.',         model: 'claude-code' as AIModel, mode: 'review' as AgentTask['mode'] },
  { title: 'Generate Documentation',   description: 'Write JSDoc comments for all exported functions.',                                     model: 'claude-code' as AIModel, mode: 'build' as AgentTask['mode'] },
  { title: 'Research Architecture',    description: 'Research best practices for the current tech stack and write recommendations.',         model: 'gemini-cli' as AIModel, mode: 'plan' as AgentTask['mode'] },
  { title: 'Generate Test Suite',      description: 'Create focused tests for core business logic.',                                        model: 'codex-cli' as AIModel, mode: 'qa' as AgentTask['mode'] },
  { title: 'Security Audit',           description: 'Review API routes, auth flows, and env handling for common vulnerabilities.',           model: 'gemini-cli' as AIModel, mode: 'review' as AgentTask['mode'] },
]

const MODEL_META: Record<string, { icon: React.ReactNode; color: string }> = {
  'ollama-pro':  { icon: <Bot      className="w-3.5 h-3.5" />, color: '#F97316' },
  'claude-code': { icon: <Cpu      className="w-3.5 h-3.5" />, color: '#8B5CF6' },
  'gemini-cli':  { icon: <Globe    className="w-3.5 h-3.5" />, color: '#3B82F6' },
  'codex-cli':   { icon: <Zap      className="w-3.5 h-3.5" />, color: '#10B981' },
  auto:          { icon: <Sparkles className="w-3.5 h-3.5" />, color: '#F59E0B' },
}

const STEP_TYPE_META: Record<AgentStepType, { icon: React.ReactNode; color: string; label: string }> = {
  think:      { icon: <Sparkles  className="w-3 h-3" />, color: 'text-violet-400', label: 'Think'     },
  plan:       { icon: <BookOpen  className="w-3 h-3" />, color: 'text-blue-400',   label: 'Plan'      },
  'read-file':{ icon: <FileText  className="w-3 h-3" />, color: 'text-sky-400',    label: 'Read file' },
  search:     { icon: <Search    className="w-3 h-3" />, color: 'text-amber-400',  label: 'Search'    },
  patch:      { icon: <GitBranch className="w-3 h-3" />, color: 'text-emerald-400',label: 'Patch'     },
  command:    { icon: <Terminal  className="w-3 h-3" />, color: 'text-zinc-300',   label: 'Command'   },
  verify:     { icon: <Shield    className="w-3 h-3" />, color: 'text-cyan-400',   label: 'Verify'    },
  report:     { icon: <BookOpen  className="w-3 h-3" />, color: 'text-emerald-400',label: 'Report'    },
}

const STATUS_CONFIG: Record<AgentTask['status'], { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Clock     className="w-3.5 h-3.5" />,             color: 'text-zinc-400',   label: 'Pending'  },
  running: { icon: <Activity  className="w-3.5 h-3.5 animate-pulse" />, color: 'text-violet-400', label: 'Running'  },
  paused:  { icon: <Clock     className="w-3.5 h-3.5" />,             color: 'text-amber-400',  label: 'Paused'   },
  done:    { icon: <CheckCircle2 className="w-3.5 h-3.5" />,          color: 'text-emerald-400', label: 'Complete' },
  failed:  { icon: <XCircle   className="w-3.5 h-3.5" />,             color: 'text-red-400',    label: 'Failed'   },
}

function parseStepsFromOutput(output: string): Array<{ type: AgentStepType; title: string; summary: string }> {
  const steps: Array<{ type: AgentStepType; title: string; summary: string }> = []
  const lines = output.split('\n').filter(Boolean)

  for (const line of lines.slice(0, 30)) {
    const lower = line.toLowerCase()
    if (/^\d+\./.test(line) || /^[-*]/.test(line)) {
      const text = line.replace(/^[\d.\-*\s]+/, '').trim()
      if (!text) continue
      let type: AgentStepType = 'plan'
      if (/read|open|inspect|look at|check file/i.test(text)) type = 'read-file'
      else if (/search|find|grep|scan/i.test(text)) type = 'search'
      else if (/patch|edit|modify|change|update|fix|write/i.test(text)) type = 'patch'
      else if (/run|execute|npm|build|test|typecheck/i.test(text)) type = 'command'
      else if (/verify|confirm|validate|check/i.test(text)) type = 'verify'
      steps.push({ type, title: text.slice(0, 80), summary: '' })
    }
  }

  return steps.slice(0, 8)
}

function AgentStepTimeline({ steps }: { steps: AgentStep[] }) {
  if (!steps.length) return null
  return (
    <div className="relative ml-2 mt-3 space-y-0">
      {steps.map((step, idx) => {
        const meta = STEP_TYPE_META[step.type]
        const isLast = idx === steps.length - 1
        return (
          <div key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
            {/* connector line */}
            {!isLast && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-zinc-800" />
            )}
            {/* dot */}
            <div className={cn(
              'relative z-10 flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center mt-0.5',
              step.status === 'done'    && 'bg-emerald-500/20 border-emerald-500/40',
              step.status === 'running' && 'bg-violet-500/20 border-violet-500/40 animate-pulse',
              step.status === 'failed'  && 'bg-red-500/20 border-red-500/40',
              step.status === 'blocked' && 'bg-amber-500/20 border-amber-500/40',
              step.status === 'pending' && 'bg-zinc-900 border-zinc-700',
            )}>
              <span className={cn('text-[9px]', meta.color)}>{meta.icon}</span>
            </div>
            {/* content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={cn('text-[10px] font-semibold uppercase tracking-wide', meta.color)}>{meta.label}</span>
                <span className="text-[11px] text-zinc-300 truncate">{step.title}</span>
                {step.status === 'done' && step.completedAt && (
                  <span className="ml-auto text-[10px] text-zinc-700 shrink-0">
                    {new Date(step.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
              {step.summary && <p className="mt-0.5 text-[10px] text-zinc-500 leading-snug">{step.summary}</p>}
              {step.output && (
                <pre className="mt-1 max-h-20 overflow-auto rounded border border-zinc-800 bg-black/30 p-1.5 font-mono text-[10px] text-zinc-500 whitespace-pre-wrap">
                  {step.output.slice(0, 400)}
                </pre>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AgentReportCard({ task }: { task: AgentTask }) {
  const report = task.report
  if (!report) return null

  const copyReport = () => {
    const text = [
      `# Agent Report: ${task.title}`,
      `Goal: ${report.goal}`,
      '',
      `## Completed`,
      ...report.completed.map(c => `- ${c}`),
      '',
      report.filesChanged.length ? `## Files changed\n${report.filesChanged.map(f => `- ${f}`).join('\n')}` : '',
      report.commandsRun.length ? `## Commands run\n${report.commandsRun.map(c => `- ${c}`).join('\n')}` : '',
      report.passedChecks.length ? `## Passed checks\n${report.passedChecks.map(c => `- ${c}`).join('\n')}` : '',
      report.failedChecks.length ? `## Failed checks\n${report.failedChecks.map(c => `- ${c}`).join('\n')}` : '',
      report.risks.length ? `## Risks\n${report.risks.map(r => `- ${r}`).join('\n')}` : '',
      report.nextStep ? `## Next step\n${report.nextStep}` : '',
    ].filter(Boolean).join('\n')
    void navigator.clipboard.writeText(text)
    toast.success('Report copied.')
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-emerald-500/20 bg-emerald-500/5">
      <div className="flex items-center justify-between border-b border-emerald-500/15 px-3 py-2">
        <span className="text-[11px] font-semibold text-emerald-300">Final Report</span>
        <button onClick={copyReport} className="text-[10px] text-zinc-600 hover:text-zinc-300">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-2 p-3 text-[11px] text-zinc-400">
        {report.completed.length > 0 && (
          <div>
            <div className="mb-1 font-semibold text-zinc-300">Completed</div>
            {report.completed.map(c => <div key={c} className="flex gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />{c}</div>)}
          </div>
        )}
        {report.filesChanged.length > 0 && (
          <div>
            <div className="mb-1 font-semibold text-zinc-300">Files changed</div>
            {report.filesChanged.map(f => <div key={f} className="font-mono text-zinc-500">{f}</div>)}
          </div>
        )}
        {report.failedChecks.length > 0 && (
          <div>
            <div className="mb-1 font-semibold text-red-300">Failed checks</div>
            {report.failedChecks.map(c => <div key={c} className="flex gap-1.5 text-red-400"><XCircle className="w-3 h-3 mt-0.5 shrink-0" />{c}</div>)}
          </div>
        )}
        {report.risks.length > 0 && (
          <div>
            <div className="mb-1 font-semibold text-amber-300">Risks</div>
            {report.risks.map(r => <div key={r} className="text-amber-400">{r}</div>)}
          </div>
        )}
        {report.nextStep && (
          <div className="rounded border border-sky-500/20 bg-sky-500/5 p-2 text-sky-300">
            <span className="font-semibold">Next: </span>{report.nextStep}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskCard({ task, daemonOnline }: { task: AgentTask; daemonOnline: boolean }) {
  const { deleteTask, setStatus, addLog, setProgress, addStep, updateStep, setReport } = useAgentStore()
  const [expanded, setExpanded] = useState(false)
  const meta = MODEL_META[task.model] ?? MODEL_META['ollama-pro']
  const status = STATUS_CONFIG[task.status]
  const steps = task.steps ?? []

  const simulate = async () => {
    if (!daemonOnline) {
      toast.error('Agent runs require the local daemon. Start npm run bertos:daemon and retry.')
      return
    }
    setStatus(task.id, 'running')
    setProgress(task.id, 10)

    const step1 = addStep(task.id, {
      number: 1, status: 'running', type: 'think',
      title: 'Routing task to provider…', timestamp: Date.now(),
    })
    addLog(task.id, { level: 'info', message: `Routing ${task.mode ?? 'build'} task to ${task.model}…` })

    try {
      const providerId = task.model === 'auto' || task.model === 'ollama-pro' ? 'codex-cli' : task.model
      const modePrefix = task.mode === 'plan' ? 'Plan only (no edits): '
        : task.mode === 'debug' ? 'Debug and diagnose: '
        : task.mode === 'review' ? 'Review and report findings: '
        : task.mode === 'qa' ? 'Quality check and propose tests: '
        : ''

      updateStep(task.id, step1.id, { status: 'done', completedAt: Date.now() })
      setProgress(task.id, 25)

      const step2 = addStep(task.id, {
        number: 2, status: 'running', type: 'command',
        title: `Calling ${providerId}…`, timestamp: Date.now(),
        providerUsed: providerId,
      })

      const res = await fetch('/api/local-daemon/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          prompt: `${modePrefix}${task.title}\n\n${task.description}\n\nReturn a structured plan and the files you would inspect first. Do not claim edits were made unless you actually made them. Be honest about what is possible.`,
          timeoutMs: 180000,
        }),
      })
      const data = await res.json() as { ok: boolean; stdout?: string; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Local CLI task failed.')

      updateStep(task.id, step2.id, {
        status: 'done', completedAt: Date.now(),
        output: data.stdout?.slice(0, 600),
      })
      setProgress(task.id, 65)
      addLog(task.id, { level: 'success', message: `${providerId} responded.` })
      if (data.stdout) addLog(task.id, { level: 'info', message: data.stdout.slice(0, 1200) })

      // Parse structured steps from the response
      const parsedSteps = parseStepsFromOutput(data.stdout ?? '')
      for (const [i, ps] of parsedSteps.entries()) {
        addStep(task.id, {
          number: 3 + i, status: 'done', type: ps.type,
          title: ps.title, summary: ps.summary,
          timestamp: Date.now(), completedAt: Date.now(),
        })
      }

      // Verify step
      const stepVerify = addStep(task.id, {
        number: 3 + parsedSteps.length, status: 'running', type: 'verify',
        title: 'Generating report…', timestamp: Date.now(),
      })
      setProgress(task.id, 90)

      const stdout = data.stdout ?? ''
      const filesChanged: string[] = []
      const commandsRun: string[] = []
      const risks: string[] = []

      for (const line of stdout.split('\n')) {
        if (/\.(tsx?|jsx?|mjs|json|md)/.test(line) && line.length < 120) {
          const match = line.match(/[\w/.-]+\.(tsx?|jsx?|mjs|json|md)/)
          if (match) filesChanged.push(match[0])
        }
        if (/npm run|git |npx /.test(line)) {
          const match = line.match(/(npm run \w+|git \w+|npx [\w-]+)/)
          if (match) commandsRun.push(match[0])
        }
        if (/risk|warn|caution|careful|danger|break/i.test(line) && line.length < 200) {
          risks.push(line.trim().slice(0, 120))
        }
      }

      const completed = parsedSteps.length > 0
        ? parsedSteps.map(s => s.title)
        : ['Provider responded with a plan — review output in logs.']

      setReport(task.id, {
        goal: `${task.title}: ${task.description}`,
        completed,
        filesChanged: [...new Set(filesChanged)].slice(0, 8),
        commandsRun: [...new Set(commandsRun)].slice(0, 6),
        passedChecks: [],
        failedChecks: [],
        risks: risks.slice(0, 4),
        nextStep: 'Review the plan above, open relevant files in Workspace, then run Generate Patch.',
        generatedAt: Date.now(),
      })

      updateStep(task.id, stepVerify.id, { status: 'done', completedAt: Date.now() })
      setProgress(task.id, 100)
      setStatus(task.id, 'done')
    } catch (error) {
      setStatus(task.id, 'failed')
      addLog(task.id, {
        level: 'error',
        message: error instanceof Error ? error.message : 'Agent task failed. Start npm run bertos:daemon and retry.',
      })
      // Mark any running steps as failed
      for (const step of steps.filter(s => s.status === 'running')) {
        updateStep(task.id, step.id, { status: 'failed', completedAt: Date.now() })
      }
    }
    setExpanded(true)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-all duration-300',
        task.status === 'running' && 'border-violet-500/30 bg-violet-500/5',
        task.status === 'done'    && 'border-emerald-500/20 bg-emerald-500/5',
        task.status === 'failed'  && 'border-red-500/20 bg-red-500/5',
        (task.status === 'pending' || task.status === 'paused') && 'border-zinc-800 bg-zinc-900/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border"
          style={{ borderColor: `${meta.color}30`, background: `${meta.color}15` }}
        >
          <span style={{ color: meta.color }}>{meta.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-zinc-200">{task.title}</h3>
            {task.mode && (
              <Badge variant="default" className="text-[9px] h-4 px-1.5 capitalize">{task.mode}</Badge>
            )}
            <Badge variant="default" className="text-[9px] h-4 px-1.5">{task.model}</Badge>
          </div>
          <p className="text-xs text-zinc-500 line-clamp-2">{task.description}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn('text-xs flex items-center gap-1', status.color)}>
            {status.icon}
            <span className="hidden sm:inline">{status.label}</span>
          </span>
          {task.status === 'pending' && (
            <Button size="sm" onClick={simulate} disabled={!daemonOnline} title={!daemonOnline ? 'Start npm run bertos:daemon to run agent tasks.' : 'Run agent task'}>
              <Play className="w-3 h-3" />Run
            </Button>
          )}
          {(task.status === 'done' || task.status === 'failed') && (
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

      {/* Timeline / logs toggle */}
      {(steps.length > 0 || task.logs.length > 0) && (
        <div>
          <button
            onClick={() => setExpanded(x => !x)}
            className="flex items-center gap-1.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {steps.length > 0 ? `${steps.length} steps` : `${task.logs.length} log entries`}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-2"
              >
                {steps.length > 0 ? (
                  <AgentStepTimeline steps={steps} />
                ) : (
                  <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 font-mono text-[11px] space-y-1 max-h-40 overflow-y-auto">
                    {task.logs.map(log => (
                      <div key={log.id} className={cn(
                        'flex items-start gap-2',
                        log.level === 'error'   && 'text-red-400',
                        log.level === 'warn'    && 'text-amber-400',
                        log.level === 'success' && 'text-emerald-400',
                        log.level === 'info'    && 'text-zinc-500',
                      )}>
                        <span className="text-zinc-700 flex-shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="line-clamp-3">{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Final report */}
                <AgentReportCard task={task} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}

export function AgentsView() {
  const { tasks, createTask } = useAgentStore()
  const { pendingAgentTask, setPendingAgentTask } = useUIStore()
  const { health: daemonHealth, loading: daemonHealthLoading, refresh: refreshDaemonHealth } = useDaemonHealth()
  const [showTemplates, setShowTemplates] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customDesc, setCustomDesc] = useState('')
  const [customModel, setCustomModel] = useState<AIModel>('auto')
  const [customMode, setCustomMode] = useState<AgentTask['mode']>('build')

  useEffect(() => {
    if (pendingAgentTask) {
      setCustomTitle(pendingAgentTask.title)
      setCustomDesc(pendingAgentTask.description)
      setPendingAgentTask(null)
    }
  }, [pendingAgentTask, setPendingAgentTask])

  const addFromTemplate = (template: typeof TASK_TEMPLATES[number]) => {
    createTask({ title: template.title, description: template.description, model: template.model, mode: template.mode })
    setShowTemplates(false)
    toast.success(`Task added: ${template.title}`)
  }

  const addCustom = () => {
    if (!customTitle.trim()) return
    createTask({ title: customTitle.trim(), description: customDesc.trim() || 'Custom agent task', model: customModel, mode: customMode })
    setCustomTitle('')
    setCustomDesc('')
    toast.success('Agent task added.')
  }

  const running = tasks.filter(t => t.status === 'running').length
  const done    = tasks.filter(t => t.status === 'done').length
  const daemonOnline = Boolean(daemonHealth?.daemonOnline)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800/50">
        <div className="max-w-3xl mx-auto">
          <DaemonHealthBanner
            health={daemonHealth}
            loading={daemonHealthLoading}
            onRefresh={refreshDaemonHealth}
            compact={daemonOnline}
            className="mb-4"
          />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">Agent Run Console</h2>
                <p className="text-[11px] text-zinc-500">Structured AI operations with step timeline</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {running > 0 && (
                <div className="flex items-center gap-1.5 text-violet-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  {running} running
                </div>
              )}
              {done > 0 && <span className="text-emerald-400">{done} done</span>}
              <span className="text-zinc-600">{tasks.length} total</span>
            </div>
          </div>

          {/* Composer */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
            <input
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              placeholder="Task title: e.g. Fix the patch validation flow"
              className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
            />
            <textarea
              value={customDesc}
              onChange={e => setCustomDesc(e.target.value)}
              placeholder="Description (optional): what exactly should be done, which files are likely affected…"
              rows={2}
              className="w-full resize-none bg-transparent text-xs text-zinc-400 placeholder:text-zinc-700 outline-none"
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select
                value={customMode ?? 'build'}
                onChange={e => setCustomMode(e.target.value as AgentTask['mode'])}
                className="h-7 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-400 outline-none"
              >
                <option value="plan">Plan</option>
                <option value="build">Build</option>
                <option value="debug">Debug</option>
                <option value="review">Review</option>
                <option value="qa">QA</option>
              </select>
              <select
                value={customModel}
                onChange={e => setCustomModel(e.target.value as AIModel)}
                className="h-7 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-400 outline-none"
              >
                <option value="auto">Auto</option>
                <option value="claude-code">Claude Code</option>
                <option value="codex-cli">Codex CLI</option>
                <option value="gemini-cli">Gemini CLI</option>
                <option value="ollama-pro">Ollama</option>
              </select>
              <Button onClick={addCustom} disabled={!customTitle.trim()} size="sm" className="ml-auto">
                <Plus className="w-3.5 h-3.5" />Add Task
              </Button>
            </div>
          </div>

          {/* Templates */}
          <div className="mt-2">
            <button
              onClick={() => setShowTemplates(x => !x)}
              className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
            >
              {showTemplates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Browse task templates
            </button>
            <AnimatePresence>
              {showTemplates && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {TASK_TEMPLATES.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => addFromTemplate(t)}
                        className="text-left rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900 p-3 transition-all"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-medium text-zinc-300">{t.title}</p>
                          <Badge variant="default" className="text-[9px] h-4 capitalize">{t.mode}</Badge>
                        </div>
                        <p className="text-[11px] text-zinc-600 line-clamp-2">{t.description}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-4 space-y-3">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bot className="w-12 h-12 text-zinc-800 mb-4" />
              <p className="text-zinc-600 text-sm">No agent tasks yet</p>
              <p className="text-zinc-700 text-xs mt-1">Create a task above or pick a template to get started</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} daemonOnline={daemonOnline} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
