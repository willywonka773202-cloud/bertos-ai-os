'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Plus, Folder, Edit3, Trash2, Check, X, Pin,
  MessageSquare, FileText, Clock, Tag, Search, ClipboardCopy, HardDrive
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useProjectStore } from '@/store/bertos/projects'
import { useChatStore } from '@/store/bertos/chat'
import { useUIStore } from '@/store/bertos/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { RouteHero } from '@/components/bertos/hermes'

const PROJECT_COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
]
const PROJECT_ICONS = ['🤖', '🚀', '⚡', '🔥', '💡', '🎯', '🌊', '🎨', '🔬', '💎']

const MEMORY_CATEGORIES = [
  { label: 'Project Notes', detail: 'Active repo goals, project summaries, and working context.', status: 'local' },
  { label: 'Decisions', detail: 'Architecture decisions, rejected approaches, and safety notes.', status: 'local' },
  { label: 'Provider Setup', detail: 'CLI/API/provider configuration facts without secret values.', status: 'local' },
  { label: 'Playbooks', detail: 'Reusable triage and build workflows shared with Builder.', status: 'local' },
  { label: 'Daily Journal', detail: 'Future local markdown notes for daily work summaries.', status: 'planned' },
  { label: 'Agent Sessions', detail: 'Task history and agent run summaries when connected.', status: 'planned' },
  { label: 'Bugs and Fixes', detail: 'Known bugs, fixes, and regression notes for future agents.', status: 'planned' },
  { label: 'User Preferences', detail: 'Preferred providers, validation profile, and workflow style.', status: 'planned' },
  { label: 'Roadmap', detail: 'Longer-term BertOS build phases and deferred integrations.', status: 'planned' },
]

function buildDailyJournalTemplate(date: string): string {
  return `# Daily Brief — ${date}\n\n## Focus\n\n- \n\n## Work Log\n\n- \n\n## Decisions\n\n- \n\n## Tomorrow\n\n- \n\n## Notes\n\n`
}

function buildSessionNoteTemplate(task: string, date: string): string {
  return `# Agent Session — ${date}\n\n## Task\n\n${task || 'Describe the task here.'}\n\n## Outcome\n\n- \n\n## Files Changed\n\n- \n\n## Safety Notes\n\n- No secrets committed\n- Typecheck: \n- Build: \n\n## Follow-up\n\n- \n`
}

function buildProjectNoteTemplate(projectName: string): string {
  return `# ${projectName || 'Project'} — Notes\n\n## Goal\n\n\n\n## Architecture\n\n\n\n## Decisions\n\n| Decision | Reason | Date |\n|----------|--------|------|\n|  |  |  |\n\n## Providers\n\n- \n\n## Roadmap\n\n- [ ] \n\n## Safety Rules\n\n- \n`
}

export function MemoryView() {
  const { projects, activeProjectId, createProject, updateProject, deleteProject, setActiveProject, updateContext } = useProjectStore()
  const { sessions } = useChatStore()
  const { settings, updateSettings } = useUIStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCtx, setEditCtx] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])
  const [newIcon, setNewIcon] = useState(PROJECT_ICONS[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [obsidianExpanded, setObsidianExpanded] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<'journal' | 'session' | 'project' | null>(null)
  const [vaultPath, setVaultPath] = useState(settings.obsidianVaultPath ?? '')
  const [journalFolder, setJournalFolder] = useState(settings.obsidianJournalFolder ?? 'Journal')
  const [projectNotesFolder, setProjectNotesFolder] = useState(settings.obsidianProjectNotesFolder ?? 'Projects')
  const [sessionsFolder, setSessionsFolder] = useState(settings.obsidianSessionsFolder ?? 'Agent Sessions')
  const [obsidianSaved, setObsidianSaved] = useState(false)

  const saveObsidianSettings = () => {
    updateSettings({
      obsidianVaultPath: vaultPath.trim() || undefined,
      obsidianJournalFolder: journalFolder.trim() || 'Journal',
      obsidianProjectNotesFolder: projectNotesFolder.trim() || 'Projects',
      obsidianSessionsFolder: sessionsFolder.trim() || 'Agent Sessions',
    })
    setObsidianSaved(true)
    setTimeout(() => setObsidianSaved(false), 2000)
  }

  const copyTemplate = async (template: string) => {
    await navigator.clipboard.writeText(template)
    toast.success('Template copied to clipboard.')
  }

  const today = new Date().toISOString().slice(0, 10)

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

  const copyObsidianPrompt = async () => {
    const prompt = [
      'MISSION: Add Obsidian / local markdown memory support to BertOS safely.',
      '',
      'Context:',
      '- BertOS already has a local-first Memory Vault and project memory.',
      '- Obsidian/local markdown is a planned future upgrade, not currently connected.',
      '',
      'Requirements:',
      '- Inspect existing daemon file-write capability before adding any writer.',
      '- Create a permissioned local markdown writer only if the daemon can validate paths inside an approved vault.',
      '- Add setup fields for vault path, daily journal folder, project notes folder, and agent sessions folder.',
      '- Add daily journal and session note templates.',
      '- Never write secrets, .env files, credentials, tokens, or unrelated repo files.',
      '- Require explicit user approval before writing markdown files.',
      '- Run npm run typecheck, npm run build, and npm run bertos:safety.',
      '',
      'Final report:',
      '- Files changed',
      '- What writes are enabled vs still planned',
      '- Safety gates',
      '- Validation results',
    ].join('\n')
    await navigator.clipboard.writeText(prompt)
    toast.success('Obsidian integration prompt copied.')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800/50">
        <div className="max-w-4xl mx-auto">
          <RouteHero
            eyebrow="memory temple"
            title="Memory Vault"
            subtitle="Local-first project memory, decisions, provider setup notes, and planned markdown vault support. Secret values stay out of memory by design."
            status={projects.length ? 'nominal' : 'idle'}
            seal={<Brain className="h-5 w-5" />}
            metrics={[
              { label: 'Projects', value: projects.length, detail: projects.find(project => project.id === activeProjectId)?.name ?? 'none active', tone: 'cyan' },
              { label: 'Chat Threads', value: sessions.length, detail: 'linked local context', tone: 'bronze' },
              { label: 'Local Categories', value: MEMORY_CATEGORIES.filter(category => category.status === 'local').length, detail: 'wired today', tone: 'emerald' },
              { label: 'Planned Vaults', value: MEMORY_CATEGORIES.filter(category => category.status === 'planned').length, detail: 'honest roadmap', tone: 'zinc' },
            ]}
          />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Brain className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-200">Memory Vault</h2>
                <p className="text-[11px] text-zinc-500">Local-first project memory now, Obsidian/markdown vault support later</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
              <Plus className="w-3.5 h-3.5" />
              New Project
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            {MEMORY_CATEGORIES.map(category => (
              <div key={category.label} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-zinc-300">{category.label}</p>
                  <Badge variant={category.status === 'local' ? 'success' : 'default'} className="text-[9px]">
                    {category.status}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">{category.detail}</p>
              </div>
            ))}
          </div>

          <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10">
                  <HardDrive className="h-4 w-4 text-blue-300" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-100">Obsidian / Local Markdown Vault</h3>
                    <Badge variant={vaultPath ? 'success' : 'default'} className="text-[9px]">
                      {vaultPath ? 'path set' : 'not configured'}
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-blue-100/70">
                    Configure your vault path and folder structure. BertOS does not write files automatically — use templates below to copy and paste into Obsidian manually, or build a safe daemon writer once a validated path exists.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setObsidianExpanded(v => !v)}>
                  <Edit3 className="h-3.5 w-3.5" />{obsidianExpanded ? 'Hide Settings' : 'Configure'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void copyObsidianPrompt()}>
                  <ClipboardCopy className="h-3.5 w-3.5" />Integration Prompt
                </Button>
              </div>
            </div>

            {obsidianExpanded && (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { label: 'Vault Path', placeholder: 'C:\\Users\\you\\Documents\\Vault', value: vaultPath, setter: setVaultPath, desc: 'Root folder of your Obsidian vault' },
                    { label: 'Journal Folder', placeholder: 'Journal', value: journalFolder, setter: setJournalFolder, desc: 'Daily brief and trend notes' },
                    { label: 'Project Notes Folder', placeholder: 'Projects', value: projectNotesFolder, setter: setProjectNotesFolder, desc: 'Architecture and roadmap notes' },
                    { label: 'Agent Sessions Folder', placeholder: 'Agent Sessions', value: sessionsFolder, setter: setSessionsFolder, desc: 'Proof logs and task summaries' },
                  ].map(field => (
                    <div key={field.label} className="space-y-1">
                      <label className="text-[11px] font-medium text-zinc-400">{field.label}</label>
                      <input
                        type="text"
                        value={field.value}
                        onChange={e => field.setter(e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-zinc-700 font-mono"
                      />
                      <p className="text-[10px] text-zinc-700">{field.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={saveObsidianSettings}>
                    {obsidianSaved ? <><Check className="h-3.5 w-3.5" /> Saved</> : 'Save Vault Settings'}
                  </Button>
                  <p className="text-[11px] text-zinc-700">Settings are stored locally. BertOS does not write to your vault.</p>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Templates — copy and paste into Obsidian</p>
              <div className="grid gap-2 md:grid-cols-3">
                {[
                  { key: 'journal' as const, label: 'Daily Journal', icon: <FileText className="h-3.5 w-3.5" />, path: `${journalFolder || 'Journal'}/${today}.md` },
                  { key: 'session' as const, label: 'Agent Session', icon: <MessageSquare className="h-3.5 w-3.5" />, path: `${sessionsFolder || 'Agent Sessions'}/${today}-session.md` },
                  { key: 'project' as const, label: 'Project Note', icon: <Folder className="h-3.5 w-3.5" />, path: `${projectNotesFolder || 'Projects'}/new-project.md` },
                ].map(t => (
                  <div key={t.key} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-blue-400">{t.icon}</span>
                        <p className="text-xs font-medium text-zinc-300">{t.label}</p>
                      </div>
                      <button
                        onClick={() => setPreviewTemplate(previewTemplate === t.key ? null : t.key)}
                        className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                      >
                        {previewTemplate === t.key ? 'hide' : 'preview'}
                      </button>
                    </div>
                    <p className="text-[10px] text-zinc-700 font-mono mb-2 truncate">{t.path}</p>
                    <button
                      onClick={() => void copyTemplate(
                        t.key === 'journal' ? buildDailyJournalTemplate(today)
                        : t.key === 'session' ? buildSessionNoteTemplate('', today)
                        : buildProjectNoteTemplate('')
                      )}
                      className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <ClipboardCopy className="h-3 w-3" />
                      Copy template
                    </button>
                    {previewTemplate === t.key && (
                      <pre className="mt-2 rounded bg-zinc-900 border border-zinc-800 p-2 text-[10px] text-zinc-500 overflow-auto max-h-40 whitespace-pre-wrap">
                        {t.key === 'journal' ? buildDailyJournalTemplate(today)
                          : t.key === 'session' ? buildSessionNoteTemplate('', today)
                          : buildProjectNoteTemplate('')}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <p className="text-[11px] text-zinc-600">
                  BertOS does not write to your vault automatically. These templates are copy-only.
                  To enable safe daemon-based writing, a vault path must be set above and a permissioned writer
                  must be built with explicit approval gates. No secrets, env files, or repo files are ever written.
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/50">
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
                      <div className="rounded-lg bg-zinc-950/50 border border-zinc-800/50 p-2.5">
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
