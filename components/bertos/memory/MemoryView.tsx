'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Plus, Folder, Edit3, Trash2, Check, X, Pin,
  MessageSquare, FileText, Clock, Tag, Search, Cpu, ChevronDown, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useProjectStore } from '@/store/bertos/projects'
import { useChatStore } from '@/store/bertos/chat'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

const SYSTEM_FACTS_KEY = 'bertos-system-facts-v1'

type FactCategory = 'architecture' | 'goals' | 'rules' | 'preferences' | 'decisions' | 'bugs' | 'ideas'

interface SystemFact {
  id: string
  category: FactCategory
  content: string
  createdAt: number
}

const DEFAULT_FACTS: SystemFact[] = [
  { id: 'f1', category: 'architecture', content: 'Next.js 15 App Router, Zustand for state, Tailwind + Radix UI for styling.', createdAt: 0 },
  { id: 'f2', category: 'architecture', content: 'Local daemon at http://127.0.0.1:8787 is the file/terminal/CLI bridge.', createdAt: 0 },
  { id: 'f3', category: 'architecture', content: 'Provider fallback chain: codex-cli → claude-code → gemini-cli → ollama-pro.', createdAt: 0 },
  { id: 'f4', category: 'rules', content: 'Never touch Sylistly. Never push without approval. Never expose secrets.', createdAt: 0 },
  { id: 'f5', category: 'rules', content: 'All file writes require user approval through the patch review flow.', createdAt: 0 },
  { id: 'f6', category: 'goals', content: 'BertOS is a standalone self-coding AI OS. It should improve itself safely.', createdAt: 0 },
]

const CATEGORY_COLORS: Record<FactCategory, string> = {
  architecture: 'text-blue-400',
  goals: 'text-emerald-400',
  rules: 'text-red-400',
  preferences: 'text-cyan-300',
  decisions: 'text-amber-400',
  bugs: 'text-orange-400',
  ideas: 'text-pink-400',
}

function SystemFactsPanel() {
  const [facts, setFacts] = useState<SystemFact[]>(DEFAULT_FACTS)
  const [open, setOpen] = useState(true)
  const [addCategory, setAddCategory] = useState<FactCategory>('ideas')
  const [addContent, setAddContent] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SYSTEM_FACTS_KEY)
      if (saved) setFacts(JSON.parse(saved) as SystemFact[])
    } catch { /* ignore */ }
  }, [])

  const persist = (next: SystemFact[]) => {
    setFacts(next)
    try { localStorage.setItem(SYSTEM_FACTS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  const addFact = () => {
    if (!addContent.trim()) return
    persist([...facts, { id: `${Date.now()}`, category: addCategory, content: addContent.trim(), createdAt: Date.now() }])
    setAddContent('')
  }

  const deleteFact = (id: string) => persist(facts.filter(f => f.id !== id))

  const saveEdit = (id: string) => {
    persist(facts.map(f => f.id === id ? { ...f, content: editContent } : f))
    setEditId(null)
  }

  const grouped = (Object.keys(CATEGORY_COLORS) as FactCategory[]).reduce<Record<FactCategory, SystemFact[]>>((acc, cat) => {
    acc[cat] = facts.filter(f => f.category === cat)
    return acc
  }, {} as Record<FactCategory, SystemFact[]>)

  return (
    <div className="border-t border-cyan-500/15 px-6 py-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 w-full text-left mb-3"
        >
          <Cpu className="w-4 h-4 text-cyan-300" />
          <span className="text-sm font-semibold text-zinc-200">BertOS System Facts</span>
          <Badge variant="default" className="text-[10px]">{facts.length}</Badge>
          <span className="ml-auto text-zinc-600">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {(Object.entries(grouped) as [FactCategory, SystemFact[]][]).filter(([, ff]) => ff.length > 0).map(([cat, catFacts]) => (
                  <div key={cat} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
                    <p className={cn('text-[10px] font-semibold uppercase tracking-wider mb-2', CATEGORY_COLORS[cat])}>{cat}</p>
                    <div className="space-y-2">
                      {catFacts.map(fact => (
                        <div key={fact.id} className="group flex items-start gap-2">
                          {editId === fact.id ? (
                            <div className="flex-1 space-y-1">
                              <textarea
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none resize-none"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex gap-1">
                                <Button size="sm" onClick={() => saveEdit(fact.id)}><Check className="w-3 h-3" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditId(null)}><X className="w-3 h-3" /></Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="flex-1 text-xs text-zinc-400 leading-relaxed">{fact.content}</p>
                              <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity flex-shrink-0">
                                <button onClick={() => { setEditId(fact.id); setEditContent(fact.content) }} className="text-zinc-600 hover:text-zinc-400"><Edit3 className="w-3 h-3" /></button>
                                {fact.createdAt > 0 && <button onClick={() => deleteFact(fact.id)} className="text-zinc-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>}
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <select
                  value={addCategory}
                  onChange={e => setAddCategory(e.target.value as FactCategory)}
                  className="px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 outline-none"
                >
                  {(Object.keys(CATEGORY_COLORS) as FactCategory[]).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  value={addContent}
                  onChange={e => setAddContent(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addFact()}
                  placeholder="Add a system fact…"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none"
                />
                <Button size="sm" onClick={addFact} disabled={!addContent.trim()}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

const PROJECT_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
]
const PROJECT_ICONS = ['🤖', '🚀', '⚡', '🔥', '💡', '🎯', '🌊', '🎨', '🔬', '💎']

export function MemoryView() {
  const { projects, activeProjectId, createProject, updateProject, deleteProject, setActiveProject, updateContext } = useProjectStore()
  const { sessions } = useChatStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCtx, setEditCtx] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])
  const [newIcon, setNewIcon] = useState(PROJECT_ICONS[0])
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const startEdit = (p: typeof projects[number]) => {
    setEditingId(p.id)
    setEditName(p.name)
    setEditCtx(p.context)
  }

  const saveEdit = (id: string) => {
    updateProject(id, { name: editName, context: editCtx })
    setEditingId(null)
  }

  const handleCreate = () => {
    if (!newName.trim()) return
    createProject({ name: newName.trim(), description: newDesc.trim(), color: newColor, icon: newIcon })
    setNewName('')
    setNewDesc('')
    setShowCreate(false)
  }

  const getSessionCount = (projectId: string) =>
    sessions.filter(s => s.projectId === projectId).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* BertOS System Facts */}
      <SystemFactsPanel />

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-cyan-500/15 bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.07),_transparent_60%)]">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Brain className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-zinc-100 tracking-tight">Project Memory</h1>
              <p className="text-xs text-zinc-500">Persistent context, facts, and knowledge for each AI project</p>
            </div>
            <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="flex-shrink-0">
              <Plus className="w-3.5 h-3.5" />
              New Project
            </Button>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-0.5">Projects</p>
              <p className="text-xl font-bold font-mono text-blue-300">{projects.length}</p>
            </div>
            <div className={cn(
              'rounded-xl border px-4 py-3',
              activeProjectId ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-zinc-800 bg-zinc-900/40'
            )}>
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-0.5">Active</p>
              <p className="text-sm font-semibold text-cyan-200 truncate">
                {projects.find(p => p.id === activeProjectId)?.name ?? '—'}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-0.5">Chats</p>
              <p className="text-xl font-bold font-mono text-zinc-300">{sessions.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-0.5">Files Tracked</p>
              <p className="text-xl font-bold font-mono text-zinc-300">
                {projects.reduce((sum, p) => sum + p.files.length, 0)}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/50 focus-within:border-zinc-700 transition-colors">
            <Search className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-700 outline-none"
            />
          </div>

          {/* Create form */}
          <AnimatePresence>
            {showCreate && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-3"
              >
                <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">
                  <p className="text-xs font-semibold text-zinc-400">Create New Project</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Project name"
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none col-span-2"
                    />
                    <input
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-400 placeholder:text-zinc-700 outline-none col-span-2"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[10px] text-zinc-600 mb-1.5">Color</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {PROJECT_COLORS.map(c => (
                          <button
                            key={c}
                            onClick={() => setNewColor(c)}
                            className={cn('w-5 h-5 rounded-full transition-all', newColor === c && 'ring-2 ring-white ring-offset-1 ring-offset-zinc-900 scale-110')}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600 mb-1.5">Icon</p>
                      <div className="flex gap-1 flex-wrap">
                        {PROJECT_ICONS.map(icon => (
                          <button
                            key={icon}
                            onClick={() => setNewIcon(icon)}
                            className={cn('w-6 h-6 text-sm rounded flex items-center justify-center transition-all', newIcon === icon && 'bg-zinc-700')}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleCreate} disabled={!newName.trim()} size="sm">
                      <Check className="w-3.5 h-3.5" /> Create Project
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Projects grid */}
      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence initial={false}>
              {filtered.map(project => (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    'relative rounded-xl border p-4 space-y-3 cursor-pointer transition-all duration-200 group',
                    activeProjectId === project.id
                      ? 'border-zinc-600 bg-zinc-800/50'
                      : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/60'
                  )}
                  onClick={() => setActiveProject(project.id)}
                >
                  {/* Active indicator */}
                  {activeProjectId === project.id && (
                    <div className="absolute top-3 right-3">
                      <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: project.color }} />
                    </div>
                  )}

                  {/* Project header */}
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: `${project.color}20`, border: `1px solid ${project.color}30` }}
                    >
                      {project.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingId === project.id ? (
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-sm text-zinc-200 outline-none mb-1"
                          autoFocus
                        />
                      ) : (
                        <h3 className="text-sm font-semibold text-zinc-200 truncate">{project.name}</h3>
                      )}
                      <p className="text-xs text-zinc-500 truncate">{project.description || 'No description'}</p>
                    </div>
                  </div>

                  {/* Context editor */}
                  {editingId === project.id ? (
                    <div onClick={e => e.stopPropagation()}>
                      <p className="text-[10px] text-zinc-600 mb-1">AI Context</p>
                      <textarea
                        value={editCtx}
                        onChange={e => setEditCtx(e.target.value)}
                        placeholder="Describe this project so AI understands it better..."
                        rows={3}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none resize-none"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={() => saveEdit(project.id)}>
                          <Check className="w-3 h-3" /> Save
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    project.context && (
                      <div className="rounded-lg bg-zinc-950/50 border border-cyan-500/15 p-2.5">
                        <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3">{project.context}</p>
                      </div>
                    )
                  )}

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {getSessionCount(project.id)} chats
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {project.files.length} files
                    </div>
                    <div className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {project.todos.filter(t => !t.done).length} todos
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      <Clock className="w-3 h-3" />
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => { e.stopPropagation(); startEdit(project) }}
                      className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors px-2 py-1 rounded hover:bg-white/5"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                    {project.id !== 'default' && (
                      <button
                        onClick={e => { e.stopPropagation(); deleteProject(project.id) }}
                        className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
