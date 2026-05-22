'use client'
import { Bot, Cpu, Globe, Zap, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/bertos/cn'

export type ProviderId =
  | 'auto' | 'team'
  | 'ollama-pro' | 'claude-code' | 'gemini-cli' | 'codex-cli'
  | 'claude-api' | 'openai-api' | 'gemini-api'
  | 'qwen2.5-coder' | 'llama3' | 'llama3.2' | 'mistral' | 'deepseek-coder' | 'hermes3'

export interface ProviderMeta {
  label: string
  icon: ReactNode
  color: string
  family: 'auto' | 'subscription' | 'api' | 'local'
}

const META: Record<string, ProviderMeta> = {
  auto:             { label: 'Auto Oracle',  icon: <Sparkles className="w-3 h-3" />, color: '#22d3ee', family: 'auto' },
  team:             { label: 'Team Mode',    icon: <Sparkles className="w-3 h-3" />, color: '#a855f7', family: 'auto' },

  'ollama-pro':     { label: 'Ollama Pro',   icon: <Bot   className="w-3 h-3" />,    color: '#f59e0b', family: 'subscription' },
  'claude-code':    { label: 'Claude Code',  icon: <Cpu   className="w-3 h-3" />,    color: '#8b5cf6', family: 'subscription' },
  'gemini-cli':     { label: 'Gemini CLI',   icon: <Globe className="w-3 h-3" />,    color: '#3b82f6', family: 'subscription' },
  'codex-cli':      { label: 'Codex CLI',    icon: <Zap   className="w-3 h-3" />,    color: '#10b981', family: 'subscription' },

  'claude-api':     { label: 'Anthropic API', icon: <Cpu   className="w-3 h-3" />,   color: '#8b5cf6', family: 'api' },
  'openai-api':     { label: 'OpenAI API',    icon: <Zap   className="w-3 h-3" />,   color: '#10b981', family: 'api' },
  'gemini-api':     { label: 'Gemini API',    icon: <Globe className="w-3 h-3" />,   color: '#3b82f6', family: 'api' },

  'qwen2.5-coder':  { label: 'Qwen 2.5',     icon: <Bot   className="w-3 h-3" />,    color: '#f97316', family: 'local' },
  llama3:           { label: 'Llama 3',       icon: <Bot   className="w-3 h-3" />,   color: '#f97316', family: 'local' },
  'llama3.2':       { label: 'Llama 3.2',     icon: <Bot   className="w-3 h-3" />,   color: '#f97316', family: 'local' },
  mistral:          { label: 'Mistral',       icon: <Bot   className="w-3 h-3" />,   color: '#ec4899', family: 'local' },
  'deepseek-coder': { label: 'DeepSeek',      icon: <Bot   className="w-3 h-3" />,   color: '#06b6d4', family: 'local' },
  hermes3:          { label: 'Hermes 3',      icon: <Bot   className="w-3 h-3" />,   color: '#a855f7', family: 'local' },
}

export function getProviderMeta(id: string): ProviderMeta {
  return META[id] ?? { label: id, icon: <Bot className="w-3 h-3" />, color: '#71717a', family: 'subscription' }
}

interface ProviderBadgeProps {
  providerId: string
  size?: 'sm' | 'md'
  active?: boolean
  className?: string
}

export function ProviderBadge({ providerId, size = 'sm', active, className }: ProviderBadgeProps) {
  const meta = getProviderMeta(providerId)
  const pad = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border font-medium tracking-tight transition-all',
        pad,
        active && 'shadow-[0_0_12px_rgba(34,211,238,0.3)]',
        className,
      )}
      style={{
        borderColor: `${meta.color}50`,
        background: `${meta.color}10`,
        color: meta.color,
      }}
    >
      {meta.icon}
      <span className="truncate">{meta.label}</span>
    </span>
  )
}
