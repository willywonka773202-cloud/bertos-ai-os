'use client'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Copy, Check, Wrench, Bug, TestTube, ClipboardCheck,
  Eye, Blocks, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { DEVIN_PLAYBOOK_TEMPLATES } from '@/lib/bertos/external-agents'
import type { DevinPlaybookTemplate } from '@/lib/bertos/external-agents'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

const CATEGORY_META: Record<DevinPlaybookTemplate['category'], { icon: React.ReactNode; label: string; color: string }> = {
  fix:     { icon: <Wrench className="w-3.5 h-3.5" />,         label: 'Fix',     color: 'text-red-400' },
  triage:  { icon: <Bug className="w-3.5 h-3.5" />,            label: 'Triage',  color: 'text-amber-400' },
  test:    { icon: <TestTube className="w-3.5 h-3.5" />,       label: 'Test',    color: 'text-blue-400' },
  audit:   { icon: <ClipboardCheck className="w-3.5 h-3.5" />, label: 'Audit',   color: 'text-violet-400' },
  review:  { icon: <Eye className="w-3.5 h-3.5" />,            label: 'Review',  color: 'text-emerald-400' },
  feature: { icon: <Blocks className="w-3.5 h-3.5" />,         label: 'Feature', color: 'text-indigo-400' },
}

function PlaybookCard({ playbook }: { playbook: DevinPlaybookTemplate }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const cat = CATEGORY_META[playbook.category]

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(playbook.promptTemplate)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3 hover:border-zinc-700 transition-all"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center border border-indigo-500/30 bg-indigo-500/10"
        >
          <span className="text-indigo-400">{cat.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-zinc-200">{playbook.title}</h3>
            <Badge variant="info" className="text-[9px] h-4 px-1.5">{cat.label}</Badge>
          </div>
          <p className="text-xs text-zinc-500">{playbook.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Hide' : 'View'}
          </Button>
          <Button size="sm" onClick={copyPrompt}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy for Devin'}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-4 font-mono text-[11px] text-zinc-400 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {playbook.promptTemplate}
            </div>
            <p className="text-[10px] text-zinc-600 mt-2 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Paste this prompt into a new Devin session. Replace bracketed placeholders with your specifics.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function PlaybooksView() {
  const [filter, setFilter] = useState<DevinPlaybookTemplate['category'] | 'all'>('all')

  const filtered = filter === 'all'
    ? DEVIN_PLAYBOOK_TEMPLATES
    : DEVIN_PLAYBOOK_TEMPLATES.filter(p => p.category === filter)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800/50">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">Devin Playbooks</h2>
              <p className="text-[11px] text-zinc-500">Pre-built task prompts for Devin sessions — copy, paste, and run</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'px-3 py-1 rounded-full text-xs transition-all border',
                filter === 'all'
                  ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                  : 'border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700'
              )}
            >
              All
            </button>
            {(Object.entries(CATEGORY_META) as [DevinPlaybookTemplate['category'], typeof CATEGORY_META[DevinPlaybookTemplate['category']]][]).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs transition-all border flex items-center gap-1.5',
                  filter === key
                    ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300'
                    : 'border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700'
                )}
              >
                {meta.icon}
                {meta.label}
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <p className="text-[11px] text-amber-300/80">
              These playbooks generate prompts for external Devin sessions. BertOS does not call Devin APIs directly.
              Copy the prompt, open a new Devin session, and paste it in. Always review PRs before merging.
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-4 space-y-3">
          {filtered.map(playbook => (
            <PlaybookCard key={playbook.id} playbook={playbook} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
