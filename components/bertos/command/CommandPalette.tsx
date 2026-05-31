'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, GitCompare, Code2, Bot, Brain, Settings, Plus,
  Trash2, Cpu, Globe, Zap, Sparkles, Search, ArrowRight, Keyboard, FlaskConical,
  LayoutDashboard, Library, Play, Check, Terminal, FileText, FolderOpen, Layers,
  Shield, Clipboard, KanbanSquare, Compass, Github, Send, Rocket,
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useProjectStore } from '@/store/bertos/projects'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { fetchLocalDaemonBridge } from '@/lib/bertos/browser-daemon'

interface Command {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  category: string
  action: () => void
  keywords: string[]
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveView, setSelectedModel, settings, updateSettings } = useUIStore()
  const { createSession, clearSession, getActiveSession } = useChatStore()
  const { projects, setActiveProject } = useProjectStore()
  const router = useRouter()
  const [query, setQuery] = useState('')

  const navigate = (view: Parameters<typeof setActiveView>[0], href: string) => {
    setActiveView(view)
    router.push(href)
    setCommandPaletteOpen(false)
  }

  const runCommand = async (command: string) => {
    const allowed: Record<string, { executable: string; args: string[]; timeoutMs: number }> = {
      'npm run typecheck': { executable: 'npm', args: ['run', 'typecheck'], timeoutMs: 180000 },
      'npm run build': { executable: 'npm', args: ['run', 'build'], timeoutMs: 240000 },
    }
    const payload = allowed[command]
    if (!payload) {
      toast.error(`Command is not allowlisted: ${command}`)
      return
    }

    setCommandPaletteOpen(false)
    toast.promise(
      fetchLocalDaemonBridge('/api/local-daemon/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json()),
      {
        loading: `Running: ${command}`,
        success: (data) => data.success ? 'Command completed' : `Failed: ${data.error}`,
        error: 'Command failed',
      }
    )
  }

  const runAutomation = async (label: string, actions: string[]) => {
    setCommandPaletteOpen(false)
    toast.promise(
      fetch('/api/automations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions }),
      }).then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || data.summary || `${label} failed`)
        return data
      }),
      {
        loading: `Running ${label}...`,
        success: (data) => data.summary || `${label} completed`,
        error: (error) => error instanceof Error ? error.message : `${label} failed`,
      }
    )
  }

  const COMMANDS: Command[] = [
    // Quick Actions
    {
      id: 'open-cockpit',
      label: 'Open Dev Cockpit',
      description: 'Your daily coding sanctuary — projects, validation, patch forge, gates',
      icon: <Terminal className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['cockpit', 'coding', 'dev', 'daily', 'home', 'forge', 'patch'],
      action: () => navigate('cockpit', '/cockpit'),
    },
    {
      id: 'open-assistant',
      label: 'Open AI Assistant',
      description: 'Project-aware AI — explain repo, plan, review diff, fix build, write tests',
      icon: <Bot className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['assistant', 'ai', 'chat', 'agent', 'explain', 'plan', 'review', 'project'],
      action: () => navigate('chat', '/assistant'),
    },
    {
      id: 'open-providers',
      label: 'Open AI Provider Hub',
      description: 'Use Claude/Codex/Gemini/Ollama/Hermes from one place — status, test, setup',
      icon: <Cpu className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['providers', 'models', 'ollama', 'claude', 'codex', 'gemini', 'hermes', 'hub', 'test'],
      action: () => navigate('providers', '/providers'),
    },
    {
      id: 'open-onboarding',
      label: 'Setup & Onboarding',
      description: 'Guided first-run setup: storage, provider, project, safety',
      icon: <Sparkles className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['onboarding', 'setup', 'getting started', 'guide', 'first run', 'welcome'],
      action: () => navigate('dashboard', '/onboarding'),
    },
    {
      id: 'open-approvals',
      label: 'Open Approval Center',
      description: 'Review and approve risky actions (Guardian Gates)',
      icon: <Shield className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['approvals', 'gates', 'guardian', 'approve', 'risk', 'safety'],
      action: () => navigate('approvals', '/approvals'),
    },
    {
      id: 'new-chat',
      label: 'New Chat',
      description: 'Start a fresh conversation',
      icon: <Plus className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['new', 'chat', 'start', 'fresh'],
      action: () => { createSession(); navigate('chat', '/chat') },
    },
    {
      id: 'new-agent',
      label: 'New Agent Run',
      description: 'Start an autonomous task',
      icon: <Play className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['agent', 'autonomous', 'task', 'run'],
      action: () => navigate('agents', '/agents'),
    },
    {
      id: 'ask-all-models',
      label: 'Ask All Models',
      description: 'Compare multiple AI responses',
      icon: <Layers className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['compare', 'all', 'models', 'council', 'multi'],
      action: () => navigate('compare', '/compare'),
    },
    {
      id: 'run-typecheck',
      label: 'Run TypeCheck',
      description: 'Verify TypeScript types',
      icon: <Check className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['typecheck', 'typescript', 'types', 'verify'],
      action: () => runCommand('npm run typecheck'),
    },
    {
      id: 'run-build',
      label: 'Run Build',
      description: 'Build the project',
      icon: <Terminal className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['build', 'compile', 'next'],
      action: () => runCommand('npm run build'),
    },
    {
      id: 'toggle-local-mode',
      label: 'Toggle Local Mode',
      description: settings.enableApiProviders ? 'Disable API providers' : 'Enable API providers',
      icon: <Globe className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['local', 'api', 'toggle', 'mode'],
      action: () => {
        updateSettings({ enableApiProviders: !settings.enableApiProviders })
        toast.success(settings.enableApiProviders ? 'API providers disabled' : 'API providers enabled')
        setCommandPaletteOpen(false)
      },
    },
    {
      id: 'run-provider-health',
      label: 'Run Provider Health Check',
      description: 'Check Ollama, daemon, and local CLI provider health',
      icon: <Cpu className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['autopilot', 'provider', 'health', 'check', 'daemon'],
      action: () => runAutomation('Provider Health Check', ['check-provider-health']),
    },
    {
      id: 'run-project-build-check',
      label: 'Run Project Build Check',
      description: 'Run typecheck and build through Autopilot safety gates',
      icon: <Shield className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['autopilot', 'build', 'typecheck', 'project', 'check'],
      action: () => runAutomation('Project Build Check', ['run-typecheck', 'run-build']),
    },
    {
      id: 'run-git-status-snapshot',
      label: 'Run Git Status Snapshot',
      description: 'Run git status and git diff --stat safely',
      icon: <GitCompare className="w-4 h-4" />,
      category: 'Actions',
      keywords: ['autopilot', 'git', 'status', 'diff', 'snapshot'],
      action: () => runAutomation('Git Status Snapshot', ['git-status', 'git-diff-stat']),
    },

    // Navigation
    {
      id: 'open-dashboard',
      label: 'Dashboard',
      description: 'Go to command center',
      icon: <LayoutDashboard className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['dashboard', 'home', 'command', 'center'],
      action: () => navigate('dashboard', '/dashboard'),
    },
    {
      id: 'open-chat',
      label: 'Chat',
      icon: <MessageSquare className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['chat', 'go', 'open'],
      action: () => navigate('chat', '/chat'),
    },
    {
      id: 'open-hermes',
      label: 'Hermes Power Agent',
      description: 'Open the Hermes operating system workspace',
      icon: <Sparkles className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['hermes', 'agent', 'soul', 'goal', 'brief', 'power'],
      action: () => navigate('hermes', '/hermes'),
    },
    {
      id: 'open-prompts',
      label: 'Prompt Library',
      description: 'Browse and manage prompts',
      icon: <Library className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['prompts', 'library', 'templates'],
      action: () => navigate('prompts', '/prompts'),
    },
    {
      id: 'open-skills',
      label: 'Skills',
      description: 'Open reusable slash-command workflows',
      icon: <Sparkles className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['skills', 'slash', 'workflow', 'creator'],
      action: () => navigate('skills', '/skills'),
    },
    {
      id: 'open-plugins',
      label: 'Plugins',
      description: 'Open @mention capability bundles and setup gates',
      icon: <Cpu className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['plugins', 'tools', 'gmail', 'youtube', 'buffer'],
      action: () => navigate('plugins', '/plugins'),
    },
    {
      id: 'open-outputs',
      label: 'Output Registry',
      description: 'Search generated artifacts and previews',
      icon: <FolderOpen className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['outputs', 'artifacts', 'files', 'registry'],
      action: () => navigate('outputs', '/outputs'),
    },
    {
      id: 'open-runs',
      label: 'Runs / Logs',
      description: 'Inspect workflow runs and sub-agent lanes',
      icon: <Terminal className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['runs', 'logs', 'workflow', 'lanes'],
      action: () => navigate('runs', '/runs'),
    },
    {
      id: 'open-publishing-queue',
      label: 'Publishing Queue',
      description: 'Open local Buffer-style publishing drafts',
      icon: <Send className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['publishing', 'buffer', 'queue', 'social', 'content'],
      action: () => navigate('publishing-queue', '/publishing-queue'),
    },
    {
      id: 'open-compare',
      label: 'Multi-AI Compare',
      description: 'Compare responses side-by-side',
      icon: <GitCompare className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['compare', 'side', 'vs', 'versus'],
      action: () => navigate('compare', '/compare'),
    },
    {
      id: 'open-coding',
      label: 'Coding Mission Center',
      description: 'Compile big prompts into provider-routed missions',
      icon: <Zap className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['coding', 'mission', 'codex', 'build', 'prompt'],
      action: () => navigate('coding', '/coding'),
    },
    {
      id: 'open-brief',
      label: 'Daily Brief',
      description: 'Open today\'s priorities, provider health, and next actions',
      icon: <Clipboard className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['brief', 'daily', 'today', 'priorities'],
      action: () => navigate('brief', '/brief'),
    },
    {
      id: 'open-playbooks',
      label: 'Playbooks',
      description: 'Open safe auto-triage and workflow templates',
      icon: <FileText className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['playbook', 'triage', 'workflow', 'template'],
      action: () => navigate('playbooks', '/playbooks'),
    },
    {
      id: 'open-tasks',
      label: 'Tasks',
      description: 'Track self-coding tasks from prompt to review',
      icon: <KanbanSquare className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['tasks', 'todo', 'board', 'self coding', 'work'],
      action: () => navigate('tasks', '/tasks'),
    },
    {
      id: 'open-migrations',
      label: 'Migrations',
      description: 'Manage Gemini CLI and Google Anti-Gravity migration risk',
      icon: <Compass className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['migration', 'gemini', 'anti gravity', 'antigravity', 'google'],
      action: () => navigate('migrations', '/migrations'),
    },
    {
      id: 'open-github',
      label: 'GitHub / Repo',
      description: 'Open safe repository status and read-only git actions',
      icon: <Github className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['github', 'git', 'repo', 'branch', 'remote'],
      action: () => navigate('github', '/github'),
    },
    {
      id: 'open-launch',
      label: 'Launch Readiness',
      description: 'Check publishability, install state, local bridge, and safety gates',
      icon: <Rocket className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['launch', 'publish', 'readiness', 'pwa', 'mobile', 'domain'],
      action: () => navigate('launch', '/launch'),
    },
    {
      id: 'open-workspace',
      label: 'Coding Workspace',
      description: 'Open the coding environment',
      icon: <Code2 className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['code', 'workspace', 'repo', 'git'],
      action: () => navigate('workspace', '/workspace'),
    },
    {
      id: 'open-evolution',
      label: 'Evolution Lab',
      description: 'Scan BertOS and generate approval-gated improvements',
      icon: <FlaskConical className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['evolution', 'improve', 'scan', 'backlog', 'self improve'],
      action: () => navigate('evolution', '/evolution'),
    },
    {
      id: 'open-agents',
      label: 'Agent Tasks',
      description: 'Manage autonomous AI tasks',
      icon: <Bot className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['agent', 'task', 'autonomous', 'background'],
      action: () => navigate('agents', '/agents'),
    },
    {
      id: 'open-autopilot',
      label: 'Autopilot',
      description: 'Open automation rules, queue, logs, and safety gates',
      icon: <Cpu className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['autopilot', 'automation', 'queue', 'rules', 'background'],
      action: () => navigate('autopilot', '/autopilot'),
    },
    {
      id: 'open-automation-queue',
      label: 'Open Automation Queue',
      description: 'Review queued, running, failed, and approval-gated runs',
      icon: <Clipboard className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['autopilot', 'automation', 'queue', 'approval', 'runs'],
      action: () => navigate('autopilot', '/autopilot'),
    },
    {
      id: 'open-memory',
      label: 'Project Memory',
      description: 'View project context and history',
      icon: <Brain className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['memory', 'project', 'history', 'context'],
      action: () => navigate('memory', '/memory'),
    },
    {
      id: 'open-settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['settings', 'config', 'preferences'],
      action: () => navigate('settings', '/settings'),
    },
    {
      id: 'keyboard-shortcuts',
      label: 'Keyboard Shortcuts',
      description: 'View all keyboard shortcuts',
      icon: <Keyboard className="w-4 h-4" />,
      category: 'Navigate',
      keywords: ['keyboard', 'shortcuts', 'hotkeys', 'keybindings'],
      action: () => { setCommandPaletteOpen(false); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', metaKey: true, ctrlKey: false })), 50) },
    },
    {
      id: 'use-ollama-pro',
      label: 'Switch to Ollama Pro',
      description: 'Set Ollama Pro as primary model (default)',
      icon: <Bot className="w-4 h-4 text-orange-400" />,
      category: 'Model',
      keywords: ['ollama', 'pro', 'model', 'default'],
      action: () => { setSelectedModel('ollama-pro'); setCommandPaletteOpen(false) },
    },
    {
      id: 'use-claude-code',
      label: 'Switch to Claude Code',
      description: 'Set Claude Code CLI as primary model',
      icon: <Cpu className="w-4 h-4 text-violet-400" />,
      category: 'Model',
      keywords: ['claude', 'anthropic', 'model', 'cli'],
      action: () => { setSelectedModel('claude-code'); setCommandPaletteOpen(false) },
    },
    {
      id: 'use-codex-cli',
      label: 'Switch to Codex CLI',
      description: 'Set Codex CLI as primary model',
      icon: <Zap className="w-4 h-4 text-emerald-400" />,
      category: 'Model',
      keywords: ['codex', 'openai', 'model', 'code', 'cli'],
      action: () => { setSelectedModel('codex-cli'); setCommandPaletteOpen(false) },
    },
    {
      id: 'use-gemini-cli',
      label: 'Switch to Gemini CLI',
      description: 'Set Gemini CLI as primary model',
      icon: <Globe className="w-4 h-4 text-blue-400" />,
      category: 'Model',
      keywords: ['gemini', 'google', 'model', 'cli'],
      action: () => { setSelectedModel('gemini-cli'); setCommandPaletteOpen(false) },
    },
    {
      id: 'use-auto',
      label: 'Switch to Auto Router',
      description: 'Enable intelligent routing',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      category: 'Model',
      keywords: ['auto', 'router', 'smart', 'automatic'],
      action: () => { setSelectedModel('auto'); setCommandPaletteOpen(false) },
    },
    {
      id: 'clear-chat',
      label: 'Clear Current Chat',
      description: 'Remove all messages in this session',
      icon: <Trash2 className="w-4 h-4 text-red-400" />,
      category: 'Actions',
      keywords: ['clear', 'delete', 'remove', 'reset'],
      action: () => {
        const s = getActiveSession()
        if (s) clearSession(s.id)
        setCommandPaletteOpen(false)
      },
    },
  ]

  const filtered = query.trim()
    ? COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(query.toLowerCase()) ||
        cmd.keywords.some(k => k.includes(query.toLowerCase()))
      )
    : COMMANDS

  const grouped = filtered.reduce<Record<string, Command[]>>((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  useEffect(() => {
    if (!commandPaletteOpen) setQuery('')
  }, [commandPaletteOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
      if (e.key === 'Escape') setCommandPaletteOpen(false)
      if (!commandPaletteOpen) return
      if (e.key === 'ArrowDown') setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
      if (e.key === 'ArrowUp') setSelectedIdx(i => Math.max(i - 1, 0))
      if (e.key === 'Enter' && filtered[selectedIdx]) {
        e.preventDefault()
        filtered[selectedIdx].action()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, filtered, selectedIdx, setCommandPaletteOpen])

  let flatIdx = 0

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#030207]/78 backdrop-blur-md"
            onClick={() => setCommandPaletteOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[16vh] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="pointer-events-auto relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[rgba(246,196,83,0.24)] bg-[radial-gradient(circle_at_50%_0%,rgba(246,196,83,0.14),transparent_32%),linear-gradient(145deg,rgba(9,7,16,0.96),rgba(5,3,10,0.94))] shadow-[0_28px_100px_rgba(0,0,0,0.82),0_0_60px_rgba(246,196,83,0.12)] backdrop-blur-2xl"
            >
              <div className="pointer-events-none absolute inset-0 hermes-grid-fine opacity-20" />
              <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(103,232,249,0.62)] to-transparent" />
              {/* Search input */}
              <div className="relative z-10 flex items-center gap-3 border-b border-[rgba(246,196,83,0.14)] px-4 py-4">
                <Search className="w-4 h-4 text-[#F6C453] flex-shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Invoke Hermes Messenger Layer..."
                  className="flex-1 bg-transparent text-sm text-[#F8F2DF] placeholder:text-[#6A5A3A] outline-none"
                />
                <kbd className="rounded border border-[rgba(246,196,83,0.18)] bg-[rgba(246,196,83,0.06)] px-1.5 py-0.5 text-[10px] text-[#9A8A68]">ESC</kbd>
              </div>

              {/* Results */}
              <div className="relative z-10 max-h-[430px] overflow-y-auto">
                {Object.keys(grouped).length === 0 ? (
                  <div className="py-12 text-center text-sm text-[#9A8A68]">No messenger route found</div>
                ) : (
                  <div className="p-2 space-y-2">
                    {Object.entries(grouped).map(([category, commands]) => (
                      <div key={category}>
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9A8A68]">
                          {category}
                        </p>
                        <div className="space-y-0.5">
                          {commands.map(cmd => {
                            const isSelected = flatIdx === selectedIdx
                            const currentIdx = flatIdx++
                            return (
                              <button
                                key={cmd.id}
                                onClick={cmd.action}
                                onMouseEnter={() => setSelectedIdx(currentIdx)}
                                className={cn(
                                  'w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-150',
                                  isSelected
                                    ? 'border-[rgba(103,232,249,0.34)] bg-[rgba(103,232,249,0.10)] text-[#F8F2DF] shadow-[0_0_24px_rgba(103,232,249,0.10)]'
                                    : 'border-transparent text-[#A89A7D] hover:border-[rgba(246,196,83,0.18)] hover:bg-[rgba(246,196,83,0.06)]'
                                )}
                              >
                                <span className={cn(isSelected ? 'text-[#67E8F9]' : 'text-[#B8894B]')}>
                                  {cmd.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium">{cmd.label}</p>
                                  {cmd.description && (
                                    <p className="truncate text-[11px] text-[#6A5A3A]">{cmd.description}</p>
                                  )}
                                </div>
                                {isSelected && <ArrowRight className="w-3.5 h-3.5 text-[#67E8F9]" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 px-4 py-2 border-t border-zinc-800 bg-zinc-950/50">
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                  <kbd className="bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[9px]">Up/Down</kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
                  <kbd className="bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-[9px]">Enter</kbd>
                  <span>Execute</span>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
