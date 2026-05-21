'use client'
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Library, Plus, Search, Star, Copy, Edit2, Trash2, Play,
  Code2, Briefcase, GraduationCap, Bot, User, Box,
  FileText, Hash, TrendingUp, X, Check, Cpu,
} from 'lucide-react'
import { usePromptStore, type PromptCategory, type PromptTemplate } from '@/store/bertos/prompts'
import { useChatStore } from '@/store/bertos/chat'
import { useUIStore } from '@/store/bertos/ui'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/bertos/cn'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const CATEGORY_CONFIG: Record<PromptCategory, { icon: any; label: string; color: string; description: string }> = {
  coding: { icon: Code2, label: 'Coding', color: '#8B5CF6', description: 'Development and debugging prompts' },
  business: { icon: Briefcase, label: 'Business', color: '#3B82F6', description: 'Product and startup prompts' },
  school: { icon: GraduationCap, label: 'School', color: '#10B981', description: 'Academic and learning prompts' },
  agents: { icon: Bot, label: 'Agents', color: '#F59E0B', description: 'Autonomous task prompts' },
  personal: { icon: User, label: 'Personal', color: '#EC4899', description: 'Personal projects and planning' },
  custom: { icon: Box, label: 'Custom', color: '#71717A', description: 'Your custom prompts' },
}

export function PromptLibraryView() {
  const {
    prompts, createPrompt, updatePrompt, deletePrompt,
    toggleFavorite, incrementUsage, duplicatePrompt, searchPrompts
  } = usePromptStore()
  const { createSession, addMessage } = useChatStore()
  const { setActiveView, selectedModel, setPendingWorkspaceTask, setPendingAgentTask } = useUIStore()
  const router = useRouter()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | 'all' | 'favorites'>('all')
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null)
  const [showNewPromptDialog, setShowNewPromptDialog] = useState(false)
  const [variables, setVariables] = useState<Record<string, string>>({})

  const filteredPrompts = useMemo(() => {
    let filtered = prompts

    if (selectedCategory === 'favorites') {
      filtered = filtered.filter(p => p.favorite)
    } else if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      filtered = searchPrompts(searchQuery)
    }

    return filtered.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1
      if (!a.favorite && b.favorite) return 1
      return b.updatedAt - a.updatedAt
    })
  }, [prompts, selectedCategory, searchQuery, searchPrompts])

  const handleRunPrompt = (prompt: PromptTemplate) => {
    let content = prompt.content

    // Replace variables
    prompt.variables.forEach(variable => {
      const value = variables[variable] || `{{${variable}}}`
      content = content.replace(new RegExp(`{{${variable}}}`, 'g'), value)
    })

    // If still has unreplaced variables, show dialog
    if (content.includes('{{')) {
      toast.error('Please fill in all variables first')
      setEditingPrompt(prompt)
      return
    }

    // Create new chat session
    const session = createSession(selectedModel)
    addMessage(session.id, { role: 'user', content })
    incrementUsage(prompt.id)

    // Navigate to chat
    setActiveView('chat')
    router.push('/chat')
    toast.success(`Running: ${prompt.title}`)
  }

  const resolveContent = (prompt: PromptTemplate) => {
    let content = prompt.content
    prompt.variables.forEach(variable => {
      content = content.replace(new RegExp(`{{${variable}}}`, 'g'), `[${variable}]`)
    })
    return content
  }

  const handleRunInWorkspace = (prompt: PromptTemplate) => {
    const content = resolveContent(prompt)
    incrementUsage(prompt.id)
    setPendingWorkspaceTask(content)
    setActiveView('workspace')
    router.push('/workspace')
    toast.success(`Opening in Workspace: ${prompt.title}`)
  }

  const handleRunAsAgent = (prompt: PromptTemplate) => {
    const content = resolveContent(prompt)
    incrementUsage(prompt.id)
    setPendingAgentTask({ title: prompt.title, description: content.slice(0, 400) })
    setActiveView('agents')
    router.push('/agents')
    toast.success(`Opening in Agents: ${prompt.title}`)
  }

  const handleCopyPrompt = (prompt: PromptTemplate) => {
    void navigator.clipboard.writeText(prompt.content)
    toast.success('Prompt copied to clipboard')
  }

  const handleDeletePrompt = (id: string) => {
    deletePrompt(id)
    toast.success('Prompt deleted')
  }

  const handleDuplicatePrompt = (id: string) => {
    const duplicate = duplicatePrompt(id)
    if (duplicate) {
      toast.success('Prompt duplicated')
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#0A0A0B]">
      {/* Header */}
      <div className="border-b border-zinc-800/50 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Library className="w-6 h-6 text-violet-400 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-zinc-100">Prompt Library</h1>
              <p className="text-sm text-zinc-500">Reusable prompts with variables</p>
            </div>
          </div>
          <Button onClick={() => setShowNewPromptDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Prompt</span>
          </Button>
        </div>

        {/* Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search prompts..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/50 border border-zinc-800/50 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Category Sidebar */}
        <div className="w-56 border-r border-zinc-800/50 p-4 space-y-1 flex-shrink-0 hidden md:block">
          <button
            onClick={() => setSelectedCategory('all')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
              selectedCategory === 'all'
                ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            )}
          >
            <FileText className="w-4 h-4" />
            <span>All Prompts</span>
            <span className="ml-auto text-xs text-zinc-600">{prompts.length}</span>
          </button>

          <button
            onClick={() => setSelectedCategory('favorites')}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
              selectedCategory === 'favorites'
                ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            )}
          >
            <Star className="w-4 h-4" />
            <span>Favorites</span>
            <span className="ml-auto text-xs text-zinc-600">
              {prompts.filter(p => p.favorite).length}
            </span>
          </button>

          <div className="h-px bg-zinc-800/50 my-3" />

          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            const count = prompts.filter(p => p.category === key).length
            return (
              <button
                key={key}
                onClick={() => setSelectedCategory(key as PromptCategory)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
                  selectedCategory === key
                    ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                )}
              >
                <config.icon className="w-4 h-4" style={{ color: config.color }} />
                <span>{config.label}</span>
                <span className="ml-auto text-xs text-zinc-600">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Prompts Grid */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {filteredPrompts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Library className="w-16 h-16 text-zinc-700 mb-4" />
                <h3 className="text-lg font-semibold text-zinc-400 mb-2">
                  {searchQuery ? 'No prompts found' : 'No prompts yet'}
                </h3>
                <p className="text-sm text-zinc-600 mb-6">
                  {searchQuery ? 'Try a different search' : 'Create your first prompt to get started'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowNewPromptDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Prompt
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredPrompts.map(prompt => (
                  <PromptCard
                    key={prompt.id}
                    prompt={prompt}
                    onRun={() => handleRunPrompt(prompt)}
                    onRunInWorkspace={() => handleRunInWorkspace(prompt)}
                    onRunAsAgent={() => handleRunAsAgent(prompt)}
                    onEdit={() => setEditingPrompt(prompt)}
                    onCopy={() => handleCopyPrompt(prompt)}
                    onDuplicate={() => handleDuplicatePrompt(prompt.id)}
                    onDelete={() => handleDeletePrompt(prompt.id)}
                    onToggleFavorite={() => toggleFavorite(prompt.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Edit/New Prompt Dialog */}
      <AnimatePresence>
        {(editingPrompt || showNewPromptDialog) && (
          <PromptDialog
            prompt={editingPrompt}
            onClose={() => {
              setEditingPrompt(null)
              setShowNewPromptDialog(false)
            }}
            onSave={(data) => {
              if (editingPrompt) {
                updatePrompt(editingPrompt.id, data)
                toast.success('Prompt updated')
              } else {
                createPrompt(data)
                toast.success('Prompt created')
              }
              setEditingPrompt(null)
              setShowNewPromptDialog(false)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

interface PromptCardProps {
  prompt: PromptTemplate
  onRun: () => void
  onRunInWorkspace: () => void
  onRunAsAgent: () => void
  onEdit: () => void
  onCopy: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggleFavorite: () => void
}

function PromptCard({ prompt, onRun, onRunInWorkspace, onRunAsAgent, onEdit, onCopy, onDuplicate, onDelete, onToggleFavorite }: PromptCardProps) {
  const categoryConfig = CATEGORY_CONFIG[prompt.category]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-zinc-700/50 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <categoryConfig.icon
            className="w-4 h-4 flex-shrink-0"
            style={{ color: categoryConfig.color }}
          />
          <h3 className="text-sm font-semibold text-zinc-200 truncate">{prompt.title}</h3>
        </div>
        <button
          onClick={onToggleFavorite}
          className={cn(
            'p-1 rounded transition-colors flex-shrink-0',
            prompt.favorite
              ? 'text-amber-400 hover:text-amber-300'
              : 'text-zinc-600 hover:text-zinc-400'
          )}
        >
          <Star className={cn('w-4 h-4', prompt.favorite && 'fill-current')} />
        </button>
      </div>

      {prompt.description && (
        <p className="text-xs text-zinc-500 line-clamp-2 mb-3">{prompt.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        {prompt.variables.length > 0 && (
          <Badge variant="info" className="text-[10px]">
            <Hash className="w-2.5 h-2.5 mr-1" />
            {prompt.variables.length} var{prompt.variables.length !== 1 && 's'}
          </Badge>
        )}
        {prompt.usageCount > 0 && (
          <Badge className="text-[10px]">
            <TrendingUp className="w-2.5 h-2.5 mr-1" />
            {prompt.usageCount}
          </Badge>
        )}
        {prompt.tags.slice(0, 2).map(tag => (
          <Badge key={tag} className="text-[10px]">{tag}</Badge>
        ))}
      </div>

      {/* Primary action row */}
      <div className="flex items-center gap-1.5">
        <Button size="sm" onClick={onRun} className="flex-1 h-8 text-xs gap-1.5" title="Run in Chat">
          <Play className="w-3 h-3" />
          Chat
        </Button>
        <Button size="sm" variant="outline" onClick={onRunInWorkspace} className="h-8 px-2" title="Run in Workspace">
          <Code2 className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={onRunAsAgent} className="h-8 px-2" title="Run as Agent">
          <Cpu className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit} className="h-8 px-2">
          <Edit2 className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={onCopy} className="h-8 px-2">
          <Copy className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={onDuplicate} className="h-8 px-2 hidden group-hover:flex">
          <FileText className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete} className="h-8 px-2 hidden group-hover:flex text-red-400 hover:text-red-300">
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      <p className="mt-1.5 text-[10px] text-zinc-700">Chat · Workspace · Agent</p>
    </motion.div>
  )
}

interface PromptDialogProps {
  prompt: PromptTemplate | null
  onClose: () => void
  onSave: (data: Omit<PromptTemplate, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>) => void
}

function PromptDialog({ prompt, onClose, onSave }: PromptDialogProps) {
  const [title, setTitle] = useState(prompt?.title ?? '')
  const [category, setCategory] = useState<PromptCategory>(prompt?.category ?? 'coding')
  const [content, setContent] = useState(prompt?.content ?? '')
  const [description, setDescription] = useState(prompt?.description ?? '')
  const [tags, setTags] = useState(prompt?.tags.join(', ') ?? '')

  const extractedVariables = useMemo(() => {
    const matches = content.match(/{{(\w+)}}/g) || []
    return [...new Set(matches.map(m => m.slice(2, -2)))]
  }, [content])

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Title and content are required')
      return
    }

    onSave({
      title: title.trim(),
      category,
      content: content.trim(),
      description: description.trim(),
      variables: extractedVariables,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      favorite: prompt?.favorite ?? false,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">
            {prompt ? 'Edit Prompt' : 'New Prompt'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Fix TypeScript Errors"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as PromptCategory)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does this prompt do?"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Content
                <span className="ml-2 text-xs text-zinc-600">
                  Use {`{{variableName}}`} for variables
                </span>
              </label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your prompt here... Use {{projectName}} or {{goal}} for variables."
                rows={12}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 font-mono"
              />
              {extractedVariables.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-xs text-zinc-600">Variables:</span>
                  {extractedVariables.map(v => (
                    <Badge key={v} variant="info" className="text-[10px]">{v}</Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Tags
                <span className="ml-2 text-xs text-zinc-600">Comma-separated</span>
              </label>
              <input
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="typescript, debugging, fix"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Check className="w-4 h-4" />
            Save Prompt
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
