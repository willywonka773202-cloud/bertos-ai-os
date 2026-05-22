'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Mic, Sparkles, Cpu, Globe, Zap,
  StopCircle, Image, FileText, X, Bot
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { getModelColor } from '@/lib/bertos/router'
import type { AIModel } from '@/lib/bertos/types'

interface InputBarProps {
  onSubmit: (content: string, attachments?: File[]) => void
  onStop?: () => void
  isStreaming: boolean
  disabled?: boolean
}

const MODEL_HINTS: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  auto:             { icon: <Sparkles className="w-3.5 h-3.5" />, color: '#F59E0B', label: 'Auto'            },
  team:             { icon: <Sparkles className="w-3.5 h-3.5" />, color: '#A855F7', label: 'Team Mode'       },
  // Subscription providers
  'ollama-pro':     { icon: <Bot      className="w-3.5 h-3.5" />, color: '#F97316', label: 'Ollama Pro'      },
  'claude-code':    { icon: <Cpu      className="w-3.5 h-3.5" />, color: '#8B5CF6', label: 'Claude Code'     },
  'gemini-cli':     { icon: <Globe    className="w-3.5 h-3.5" />, color: '#3B82F6', label: 'Gemini CLI'      },
  'codex-cli':      { icon: <Zap      className="w-3.5 h-3.5" />, color: '#10B981', label: 'Codex CLI'       },
  // Optional API providers
  'claude-api':     { icon: <Cpu      className="w-3.5 h-3.5" />, color: '#8B5CF6', label: 'Anthropic API'   },
  'openai-api':     { icon: <Zap      className="w-3.5 h-3.5" />, color: '#10B981', label: 'OpenAI API'      },
  'gemini-api':     { icon: <Globe    className="w-3.5 h-3.5" />, color: '#3B82F6', label: 'Gemini API'      },
  // Local Ollama models
  'qwen2.5-coder':  { icon: <Bot      className="w-3.5 h-3.5" />, color: '#F97316', label: 'Qwen 2.5 Coder'  },
  llama3:           { icon: <Bot      className="w-3.5 h-3.5" />, color: '#F97316', label: 'Llama 3'          },
  'llama3.2':       { icon: <Bot      className="w-3.5 h-3.5" />, color: '#F97316', label: 'Llama 3.2'        },
  mistral:          { icon: <Bot      className="w-3.5 h-3.5" />, color: '#EC4899', label: 'Mistral'          },
  'deepseek-coder': { icon: <Bot      className="w-3.5 h-3.5" />, color: '#06B6D4', label: 'DeepSeek Coder'   },
  hermes3:          { icon: <Bot      className="w-3.5 h-3.5" />, color: '#A855F7', label: 'Hermes 3'         },
}

const SLASH_COMMANDS = [
  { cmd: '/compare', desc: 'Compare across all models' },
  { cmd: '/ask-all', desc: 'Ask all AI systems simultaneously' },
  { cmd: '/code', desc: 'Route to coding model' },
  { cmd: '/research', desc: 'Route to research model' },
  { cmd: '/explain', desc: 'Get a detailed explanation' },
  { cmd: '/summarize', desc: 'Summarize the conversation' },
]

export function InputBar({ onSubmit, onStop, isStreaming, disabled }: InputBarProps) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [showSlash, setShowSlash] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { selectedModel } = useUIStore()

  const model = MODEL_HINTS[selectedModel] ?? MODEL_HINTS.auto

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setValue(v)
    if (v.startsWith('/')) {
      setShowSlash(true)
      setSlashQuery(v.slice(1).toLowerCase())
    } else {
      setShowSlash(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') setShowSlash(false)
  }

  const handleSubmit = () => {
    if (!value.trim() || isStreaming) return
    onSubmit(value.trim(), attachments.length ? attachments : undefined)
    setValue('')
    setAttachments([])
    setShowSlash(false)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setAttachments(prev => [...prev, ...files])
  }

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.cmd.includes(slashQuery) || c.desc.toLowerCase().includes(slashQuery)
  )

  return (
    <div className="relative px-3 pb-3 pt-2 md:px-4 md:pb-4">
      {/* Slash command menu */}
      <AnimatePresence>
        {showSlash && filteredCommands.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-full left-4 right-4 mb-2 rounded-xl border border-cyan-500/30 bg-[#05080F]/95 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_24px_rgba(34,211,238,0.15)] overflow-hidden"
          >
            {filteredCommands.map(cmd => (
              <button
                key={cmd.cmd}
                onClick={() => { setValue(cmd.cmd + ' '); setShowSlash(false); textareaRef.current?.focus() }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-cyan-500/10 transition-colors text-left"
              >
                <span className="text-xs font-mono text-cyan-300 font-bold">{cmd.cmd}</span>
                <span className="text-xs text-cyan-100/50">{cmd.desc}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachments preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex gap-2 flex-wrap mb-2"
          >
            {attachments.map((file, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400">
                {file.type.startsWith('image/') ? (
                  <Image className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-violet-400" />
                )}
                <span className="max-w-24 truncate">{file.name}</span>
                <button onClick={() => setAttachments(a => a.filter((_, j) => j !== i))}>
                  <X className="w-3 h-3 hover:text-zinc-200 transition-colors" />
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input container */}
      <div className={cn(
        'relative flex items-end gap-2 rounded-2xl border bg-[#05080F]/80 backdrop-blur-xl transition-all duration-200',
        'border-cyan-500/25 focus-within:border-cyan-500/55 focus-within:shadow-[0_0_0_1px_rgba(34,211,238,0.3),0_0_24px_rgba(34,211,238,0.15)]'
      )}>
        {/* Top brackets */}
        <span className="absolute top-2 left-2 w-3 h-3 border-t border-l border-cyan-400/40 pointer-events-none" />
        <span className="absolute top-2 right-2 w-3 h-3 border-t border-r border-cyan-400/40 pointer-events-none" />

        {/* File attach */}
        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.txt,.md,.ts,.tsx,.js,.jsx,.py" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 ml-3 mb-3 p-1.5 rounded-lg text-cyan-100/40 hover:text-cyan-200 hover:bg-cyan-500/10 transition-all"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Query ${model.label}... (/ for commands, Shift+Enter for newline)`}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent py-3 text-sm text-cyan-50 placeholder:text-cyan-100/30 outline-none min-h-[44px] max-h-[200px] overflow-y-auto scrollbar-hide"
        />

        {/* Model indicator */}
        <div className="flex-shrink-0 mb-3 mr-1 flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-semibold transition-all"
            style={{
              borderColor: `${model.color}50`,
              background: `${model.color}12`,
              color: model.color,
            }}
          >
            {model.icon}
            <span className="hidden sm:block">{model.label}</span>
          </div>

          {/* Send/Stop */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-600/40 flex items-center justify-center text-red-300 hover:bg-red-600/30 transition-all"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!value.trim()}
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 border',
                value.trim()
                  ? 'bg-gradient-to-br from-cyan-500 to-cyan-700 hover:from-cyan-400 hover:to-cyan-600 border-cyan-300/40 text-white shadow-[0_0_18px_rgba(34,211,238,0.5)]'
                  : 'bg-cyan-500/5 border-cyan-500/15 text-cyan-100/30 cursor-not-allowed'
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-[10px] text-cyan-100/25 mt-2 tracking-wide">
        BertOS can make mistakes. Verify important information.
      </p>
    </div>
  )
}
