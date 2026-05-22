'use client'
import React from 'react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { Copy, Check, Cpu, Globe, Zap, Sparkles, User, ChevronDown, ChevronUp, Info, Bot, RotateCcw, Pencil, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/bertos/cn'
import type { Message } from '@/lib/bertos/types'
import { Badge } from '@/components/ui/badge'
import { getModelColor, getModelLabel } from '@/lib/bertos/router'

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
  onRetry?: () => void
  onEdit?: (newContent: string) => void
}

const MODEL_ICONS: Record<string, React.ReactNode> = {
  // Subscription providers
  'ollama-pro':    <Bot      className="w-3.5 h-3.5" />,
  'claude-code':   <Cpu      className="w-3.5 h-3.5" />,
  'gemini-cli':    <Globe    className="w-3.5 h-3.5" />,
  'codex-cli':     <Zap      className="w-3.5 h-3.5" />,
  // Optional API providers
  'claude-api':    <Cpu      className="w-3.5 h-3.5" />,
  'openai-api':    <Zap      className="w-3.5 h-3.5" />,
  'gemini-api':    <Globe    className="w-3.5 h-3.5" />,
  // Auto
  auto:            <Sparkles className="w-3.5 h-3.5" />,
  // Local Ollama models
  'qwen2.5-coder': <Bot      className="w-3.5 h-3.5" />,
  llama3:          <Bot      className="w-3.5 h-3.5" />,
  'llama3.2':      <Bot      className="w-3.5 h-3.5" />,
  mistral:         <Bot      className="w-3.5 h-3.5" />,
  'deepseek-coder':<Bot      className="w-3.5 h-3.5" />,
  hermes3:         <Bot      className="w-3.5 h-3.5" />,
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 my-3">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <span className="text-[10px] font-mono text-zinc-500">{language ?? 'code'}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono text-zinc-300 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function MessageBubble({ message, isStreaming, onRetry, onEdit }: MessageBubbleProps) {
  const isError = !message.role.includes('user') && message.content.startsWith('**Error:**')
  const isUser = message.role === 'user'
  const [routerOpen, setRouterOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)

  const copy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div
          className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5 border border-zinc-800"
          style={{ background: `${getModelColor(message.model ?? 'claude')}20` }}
        >
          <span style={{ color: getModelColor(message.model ?? 'claude') }}>
            {MODEL_ICONS[message.model ?? 'claude']}
          </span>
        </div>
      )}

      <div className={cn('group max-w-[78%] space-y-1.5', isUser && 'items-end flex flex-col')}>
        {/* Model badge for AI messages */}
        {!isUser && message.model && (
          <div className="flex items-center gap-2">
            <Badge variant={(['ollama-pro','claude-code','gemini-cli','codex-cli','claude-api','openai-api','gemini-api','auto'].includes(message.model ?? '') ? message.model : 'default') as 'ollama-pro' | 'claude-code' | 'gemini-cli' | 'codex-cli' | 'claude-api' | 'openai-api' | 'gemini-api' | 'auto' | 'default'} className="text-[10px]">
              {MODEL_ICONS[message.model]}
              {getModelLabel(message.model)}
            </Badge>
            {message.routerDecision && (
              <button
                onClick={() => setRouterOpen(!routerOpen)}
                className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <Info className="w-3 h-3" />
                {routerOpen ? 'Hide router' : 'Router decision'}
                {routerOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        )}

        {/* Router decision */}
        {routerOpen && message.routerDecision && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 space-y-1.5 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Task type:</span>
              <Badge variant="default" className="text-[10px] capitalize">
                {message.routerDecision.taskType}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Strategy:</span>
              <span className="text-zinc-300 capitalize">{message.routerDecision.strategy}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Confidence:</span>
              <span className="text-emerald-400">{Math.round(message.routerDecision.confidence * 100)}%</span>
            </div>
            <p className="text-zinc-500 text-[11px] leading-relaxed border-t border-zinc-800 pt-1.5">
              {message.routerDecision.reasoning}
            </p>
          </motion.div>
        )}

        {/* Message content */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-violet-600 text-white rounded-br-sm'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-sm',
            isStreaming && !isUser && 'border-violet-500/30'
          )}
        >
          {isUser ? (
            editing ? (
              <div className="space-y-2 min-w-[200px]">
                <textarea
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (editValue.trim() && onEdit) { onEdit(editValue.trim()); setEditing(false) }
                    }
                    if (e.key === 'Escape') { setEditing(false); setEditValue(message.content) }
                  }}
                  className="w-full min-w-[220px] resize-none rounded-lg bg-white/10 p-2 text-sm text-white placeholder:text-white/40 outline-none border border-white/20 focus:border-white/40"
                  rows={Math.min(8, editValue.split('\n').length + 1)}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setEditing(false); setEditValue(message.content) }}
                    className="text-[11px] text-white/50 hover:text-white/80 transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                  <button
                    onClick={() => { if (editValue.trim() && onEdit) { onEdit(editValue.trim()); setEditing(false) } }}
                    disabled={!editValue.trim()}
                    className="text-[11px] text-violet-200 hover:text-white transition-colors font-medium"
                  >
                    Resend ↵
                  </button>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, className, children, ...props }) {
                  const isBlock = className?.includes('language-')
                  const lang = className?.replace('language-', '')
                  if (isBlock) {
                    return <CodeBlock code={String(children).replace(/\n$/, '')} language={lang} />
                  }
                  return (
                    <code
                      className="rounded px-1.5 py-0.5 bg-zinc-800 text-violet-300 text-xs font-mono border border-zinc-700"
                      {...props}
                    >
                      {children}
                    </code>
                  )
                },
                pre({ children }) {
                  return <>{children}</>
                },
                p({ children }) {
                  return <p className="mb-3 last:mb-0">{children}</p>
                },
                ul({ children }) {
                  return <ul className="mb-3 pl-4 space-y-1 list-disc marker:text-violet-400">{children}</ul>
                },
                ol({ children }) {
                  return <ol className="mb-3 pl-4 space-y-1 list-decimal marker:text-violet-400">{children}</ol>
                },
                li({ children }) {
                  return <li className="text-zinc-300">{children}</li>
                },
                h1({ children }) {
                  return <h1 className="text-xl font-bold text-zinc-100 mb-3">{children}</h1>
                },
                h2({ children }) {
                  return <h2 className="text-lg font-bold text-zinc-100 mb-2 mt-4">{children}</h2>
                },
                h3({ children }) {
                  return <h3 className="text-base font-semibold text-zinc-200 mb-2 mt-3">{children}</h3>
                },
                blockquote({ children }) {
                  return (
                    <blockquote className="border-l-2 border-violet-500 pl-4 my-3 text-zinc-400 italic">
                      {children}
                    </blockquote>
                  )
                },
                strong({ children }) {
                  return <strong className="font-semibold text-zinc-100">{children}</strong>
                },
                a({ href, children }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
                    >
                      {children}
                    </a>
                  )
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-3">
                      <table className="w-full text-xs border-collapse">{children}</table>
                    </div>
                  )
                },
                th({ children }) {
                  return <th className="border border-zinc-700 px-3 py-2 bg-zinc-800 text-zinc-200 text-left font-semibold">{children}</th>
                },
                td({ children }) {
                  return <td className="border border-zinc-800 px-3 py-2 text-zinc-400">{children}</td>
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}

          {/* Streaming cursor */}
          {isStreaming && !isUser && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 align-text-bottom"
            />
          )}
        </div>

        {/* Actions */}
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {isError && onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 text-[10px] text-amber-500 hover:text-amber-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Retry
              </button>
            )}
            <button
              onClick={copy}
              className="flex items-center gap-1.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {message.metadata?.tokens && (
              <span className="text-[10px] text-zinc-700">
                {message.metadata.tokens >= 1000
                  ? `${(message.metadata.tokens / 1000).toFixed(1)}k tok`
                  : `${message.metadata.tokens} tok`}
              </span>
            )}
            {message.metadata?.latency && (
              <span className="text-[10px] text-zinc-700">
                {message.metadata.latency >= 1000
                  ? `${(message.metadata.latency / 1000).toFixed(1)}s`
                  : `${message.metadata.latency}ms`}
              </span>
            )}
            {message.metadata?.providerSource === 'daemon' && (
              <span className="text-[10px] text-zinc-700">via daemon</span>
            )}
            {message.metadata?.modelOrTool && (
              <span className="text-[10px] text-zinc-700 truncate max-w-48 font-mono">{message.metadata.modelOrTool}</span>
            )}
            {message.metadata?.fallbackUsed && (
              <span className="text-[10px] text-amber-500">↳ fallback: {message.metadata.fallbackUsed}</span>
            )}
            <span className="text-[10px] text-zinc-800 ml-auto">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5 bg-violet-600/20 border border-violet-600/30">
            <User className="w-3.5 h-3.5 text-violet-400" />
          </div>
          {onEdit && !editing && !isStreaming && (
            <button
              onClick={() => { setEditing(true); setEditValue(message.content) }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/5"
              title="Edit message"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
