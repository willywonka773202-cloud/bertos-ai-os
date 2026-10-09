'use client'
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Hammer, Copy, Check, Bot, Cpu, Globe, Zap, Sparkles, ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { EXTERNAL_AGENTS } from '@/lib/bertos/external-agents'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

type TargetAgent = 'claude-code' | 'codex-cli' | 'gemini-cli' | 'ollama-pro' | 'devin'

const AGENT_OPTIONS: { id: TargetAgent; name: string; icon: React.ReactNode; description: string; external?: boolean }[] = [
  { id: 'claude-code', name: 'Claude Code',  icon: <Cpu className="w-4 h-4" />,      description: 'Local CLI — codebase refactoring, deep analysis' },
  { id: 'codex-cli',   name: 'Codex CLI',    icon: <Zap className="w-4 h-4" />,      description: 'Local CLI — repo automation, terminal tasks' },
  { id: 'gemini-cli',  name: 'Gemini CLI',   icon: <Globe className="w-4 h-4" />,    description: 'Local CLI — long-context planning, research' },
  { id: 'ollama-pro',  name: 'Ollama Pro',   icon: <Bot className="w-4 h-4" />,      description: 'Local/cloud — general chat, fallback provider' },
  { id: 'devin',       name: 'Devin',        icon: <Sparkles className="w-4 h-4" />, description: 'External cloud agent — PRs, builds, scoped tasks', external: true },
]

function generatePrompt(target: TargetAgent, taskTitle: string, taskDescription: string): string {
  const header = 'You are working in my standalone Bert OS repo.'
  const rules = `
Rules:
- Do not edit .env.local
- Do not print secrets
- Do not run paid API calls
- Do not auto-merge
- Keep changes minimal and scoped`

  if (target === 'devin') {
    return `${header}

TASK: ${taskTitle}

${taskDescription}

Steps:
1. Inspect the relevant files and understand the existing patterns.
2. Implement the change following BertOS conventions (Next.js App Router, Tailwind, Zustand, Radix UI).
3. Run \`npm run typecheck\` — fix any errors.
4. Run \`npm run build\` — fix any errors.
5. Open a PR with a clear description. Do not auto-merge.
${rules}`
  }

  return `${header}

TASK: ${taskTitle}

${taskDescription}

Target provider: ${target}
${rules}`
}

export function BuilderView() {
  const [selectedAgent, setSelectedAgent] = useState<TargetAgent>('devin')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [copied, setCopied] = useState(false)

  const prompt = taskTitle.trim()
    ? generatePrompt(selectedAgent, taskTitle.trim(), taskDescription.trim() || 'No additional context provided.')
    : ''

  const copyPrompt = async () => {
    if (!prompt) return
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const devinInfo = EXTERNAL_AGENTS.devin
  const isDevin = selectedAgent === 'devin'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800/50">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Hammer className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Task Builder</h2>
              <p className="text-[11px] text-zinc-500">Generate scoped task prompts for any agent — local or external</p>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-4 space-y-6">
          {/* Agent selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Target Agent</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AGENT_OPTIONS.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent.id)}
                  className={cn(
                    'text-left rounded-xl border p-3 transition-all',
                    selectedAgent === agent.id
                      ? 'border-violet-500/40 bg-violet-500/10'
                      : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={selectedAgent === agent.id ? 'text-violet-400' : 'text-zinc-500'}>{agent.icon}</span>
                    <span className="text-xs font-medium text-zinc-200">{agent.name}</span>
                    {agent.external && <Badge variant="warning" className="text-[8px] h-3.5 px-1">External</Badge>}
                  </div>
                  <p className="text-[10px] text-zinc-600 leading-tight">{agent.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Devin info banner */}
          {isDevin && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-medium text-indigo-300">Devin — {devinInfo.type}</span>
                <Badge variant="warning" className="text-[8px] h-3.5 px-1">{devinInfo.billing}</Badge>
              </div>
              <p className="text-[11px] text-zinc-500">{devinInfo.description}</p>
              <div className="flex items-start gap-1.5 text-[10px] text-amber-400/80">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{devinInfo.warnings[0]}</span>
              </div>
            </motion.div>
          )}

          {/* Task input */}
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Task Title</label>
              <input
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                placeholder="e.g. Fix provider status UI duplication"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-violet-500/40 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">Description / Context</label>
              <textarea
                value={taskDescription}
                onChange={e => setTaskDescription(e.target.value)}
                placeholder="Add details, file paths, expected behavior, or reproduction steps..."
                rows={4}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-violet-500/40 transition-colors resize-none"
              />
            </div>
          </div>

          {/* Generated prompt */}
          {prompt && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400">Generated Prompt</label>
                <Button size="sm" onClick={copyPrompt}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : isDevin ? 'Copy for Devin' : 'Copy Prompt'}
                </Button>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-[11px] text-zinc-400 whitespace-pre-wrap max-h-72 overflow-y-auto">
                {prompt}
              </div>
              {isDevin && (
                <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                  <ExternalLink className="w-3 h-3" />
                  <span>Open <a href="https://app.devin.ai" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">app.devin.ai</a>, start a new session, and paste this prompt.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
