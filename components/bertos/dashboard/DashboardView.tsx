'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, Zap, Clock, CheckCircle2, XCircle, AlertCircle,
  FolderOpen, MessageSquare, Code2, Server,
  Sparkles, GitBranch, Terminal, Box, Bot, Library, Scale, Cpu,
} from 'lucide-react'
import { useProjectStore } from '@/store/bertos/projects'
import { useChatStore } from '@/store/bertos/chat'
import { useUIStore } from '@/store/bertos/ui'
import { useAgentStore } from '@/store/bertos/agents'
import { usePromptStore } from '@/store/bertos/prompts'
import { useAutomationStore } from '@/store/bertos/automations'
import { useDaemonHealth } from '@/hooks/useDaemonHealth'
import { DaemonHealthBanner } from '@/components/bertos/shell/DaemonHealthBanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/bertos/cn'
import { useRouter } from 'next/navigation'
import type { ProviderHealth } from '@/lib/bertos/providers/types'
import type { AutomationRun } from '@/lib/bertos/types'

interface ProviderStatus {
  id: string
  name: string
  status: 'online' | 'offline' | 'unknown'
  latency?: number
  message?: string
}

export function DashboardView() {
  const { projects, activeProjectId, setActiveProject } = useProjectStore()
  const { sessions, createSession } = useChatStore()
  const { setActiveView, selectedModel, setPendingAgentTask } = useUIStore()
  const { tasks: agentTasks } = useAgentStore()
  const { prompts } = usePromptStore()
  const { rules: automationRules, runs: automationRuns } = useAutomationStore()
  const { health: daemonHealth, loading: daemonHealthLoading, refresh: refreshDaemonHealth } = useDaemonHealth()
  const router = useRouter()
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [repoStatus, setRepoStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [runningCmd, setRunningCmd] = useState<string | null>(null)
  const [cmdResult, setCmdResult] = useState<{ cmd: string; ok: boolean; output: string } | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  async function loadDashboardData() {
    setLoading(true)
    try {
      // Load provider status
      const res = await fetch('/api/providers/status')
      if (res.ok) {
        const data = await res.json()
        setProviders(data.providers || [])
      }

      // Load repo status
      const repoRes = await fetch('/api/local-daemon/repo/status')
      if (repoRes.ok) {
        const repoData = await repoRes.json()
        setRepoStatus(repoData)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const activeProject = projects.find(p => p.id === activeProjectId)
  const recentSessions = sessions.slice(-5).reverse()
  const onlineProviders = providers.filter(p => p.status === 'online')
  const offlineProviders = providers.filter(p => p.status === 'offline')
  const doneAgentTasks = agentTasks.filter(t => t.status === 'done').length
  const runningAgentTasks = agentTasks.filter(t => t.status === 'running').length
  const enabledAutomationRules = automationRules.filter(rule => rule.enabled).length
  const automationNeedsApproval = automationRuns.filter(run => run.status === 'needs-approval').length
  const automationRunning = automationRuns.filter(run => run.status === 'running').length
  const recentAutomationRuns = automationRuns.slice(0, 5)
  const daemonOnline = Boolean(daemonHealth?.daemonOnline)

  const handleNewChat = () => {
    createSession(selectedModel)
    setActiveView('chat')
    router.push('/chat')
  }

  const handleOpenProject = (projectId: string) => {
    setActiveProject(projectId)
    setActiveView('workspace')
    router.push('/workspace')
  }

  const handleStartAgentRun = () => {
    setPendingAgentTask({ title: 'New Agent Task', description: '' })
    setActiveView('agents')
    router.push('/agents')
  }

  const handleRunCmd = async (cmd: 'typecheck' | 'build') => {
    if (!daemonOnline) {
      setCmdResult({
        cmd,
        ok: false,
        output: 'Local daemon is offline. Start it with npm run bertos:daemon from C:\\Users\\owner\\bertos-ai-os.',
      })
      return
    }
    setRunningCmd(cmd)
    setCmdResult(null)
    try {
      const res = await fetch('/api/local-daemon/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executable: 'npm', args: ['run', cmd], timeoutMs: 120000 }),
      })
      const data = await res.json()
      setCmdResult({
        cmd,
        ok: data.exitCode === 0,
        output: (data.stdout || '') + (data.stderr || '') || data.error || 'Done',
      })
    } catch (e) {
      setCmdResult({ cmd, ok: false, output: e instanceof Error ? e.message : 'Failed' })
    } finally {
      setRunningCmd(null)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#0A0A0B]">
      {/* Header */}
      <div className="border-b border-zinc-800/50 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <Activity className="w-6 h-6 text-violet-400" />
              Command Center
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Your AI operating system dashboard
            </p>
          </div>
          <Button onClick={handleNewChat} className="gap-2">
            <Sparkles className="w-4 h-4" />
            New Chat
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          <DaemonHealthBanner health={daemonHealth} loading={daemonHealthLoading} onRefresh={refreshDaemonHealth} />

          {/* System Status */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" />
              System Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatusCard
                label="Providers Online"
                value={`${onlineProviders.length}/${providers.length}`}
                icon={<Zap className="w-5 h-5" />}
                status={onlineProviders.length > 0 ? 'success' : 'error'}
                subtitle={onlineProviders.length > 0 ? 'System ready' : 'No providers available'}
              />
              <StatusCard
                label="Agent Tasks"
                value={runningAgentTasks > 0 ? `${runningAgentTasks} running` : `${doneAgentTasks} done`}
                icon={<Bot className="w-5 h-5" />}
                status={runningAgentTasks > 0 ? 'warning' : doneAgentTasks > 0 ? 'success' : 'info'}
                subtitle={`${agentTasks.length} total tasks`}
              />
              <StatusCard
                label="Prompt Library"
                value={prompts.length.toString()}
                icon={<Library className="w-5 h-5" />}
                status="info"
                subtitle={`${prompts.filter(p => (p.usageCount ?? 0) > 0).length} used`}
              />
              <StatusCard
                label="Autopilot"
                value={automationNeedsApproval > 0 ? `${automationNeedsApproval} approval` : automationRunning > 0 ? `${automationRunning} running` : `${enabledAutomationRules} rules`}
                icon={<Cpu className="w-5 h-5" />}
                status={automationNeedsApproval > 0 ? 'warning' : automationRunning > 0 ? 'info' : enabledAutomationRules > 0 ? 'success' : 'warning'}
                subtitle={`${automationRuns.length} recent runs`}
              />
              <StatusCard
                label="Active Projects"
                value={projects.length.toString()}
                icon={<FolderOpen className="w-5 h-5" />}
                status="success"
                subtitle={`${activeProject?.name || 'None'} selected`}
              />
              <StatusCard
                label="Chat Sessions"
                value={sessions.length.toString()}
                icon={<MessageSquare className="w-5 h-5" />}
                status="info"
                subtitle={`${recentSessions.length} recent`}
              />
              <StatusCard
                label="Repo Status"
                value={daemonHealth?.repoDetected ? 'Detected' : 'No Repo'}
                icon={<GitBranch className="w-5 h-5" />}
                status={daemonHealth?.repoDetected ? 'success' : 'warning'}
                subtitle={repoStatus?.repo?.branch || daemonHealth?.workspaceRoot || 'Daemon required'}
              />
              <StatusCard
                label="Local Daemon"
                value={daemonOnline ? 'Online' : 'Offline'}
                icon={<Server className="w-5 h-5" />}
                status={daemonOnline ? 'success' : 'warning'}
                subtitle={daemonOnline ? 'Workspace bridge ready' : 'Copy start command above'}
              />
            </div>
          </section>

          {/* Provider Health */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Provider Health
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-zinc-900/50 animate-pulse" />
                ))
              ) : providers.length === 0 ? (
                <div className="col-span-full p-8 rounded-xl border border-zinc-800/50 bg-zinc-900/20 text-center">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-zinc-400">No provider data available</p>
                </div>
              ) : (
                providers.map((provider) => (
                  <ProviderCard key={provider.id} provider={provider} />
                ))
              )}
            </div>
          </section>

          {/* Projects & Activity */}
          <Tabs defaultValue="projects" className="w-full">
            <TabsList className="bg-zinc-900/50 border border-zinc-800/50">
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="activity">Recent Activity</TabsTrigger>
              <TabsTrigger value="actions">Quick Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="space-y-3 mt-4">
              {projects.length === 0 ? (
                <div className="p-12 rounded-xl border border-zinc-800/50 bg-zinc-900/20 text-center">
                  <FolderOpen className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400 mb-4">No projects yet</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      useProjectStore.getState().createProject({ name: 'New Project' })
                    }}
                  >
                    Create First Project
                  </Button>
                </div>
              ) : (
                projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isActive={project.id === activeProjectId}
                    onClick={() => handleOpenProject(project.id)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 mt-4">
              {agentTasks.length === 0 && recentSessions.length === 0 && recentAutomationRuns.length === 0 ? (
                <div className="p-12 rounded-xl border border-zinc-800/50 bg-zinc-900/20 text-center">
                  <Clock className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">No recent activity</p>
                </div>
              ) : (
                <>
                  {agentTasks.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                        <Bot className="w-4 h-4" />
                        Recent Agent Runs
                      </h3>
                      <div className="space-y-2">
                        {agentTasks.slice(-5).reverse().map((task) => (
                          <AgentActivityCard key={task.id} task={task} />
                        ))}
                      </div>
                    </div>
                  )}
                  {recentAutomationRuns.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                        <Cpu className="w-4 h-4" />
                        Recent Autopilot Runs
                      </h3>
                      <div className="space-y-2">
                        {recentAutomationRuns.map((run) => (
                          <AutomationActivityCard key={run.id} run={run} />
                        ))}
                      </div>
                    </div>
                  )}
                  {recentSessions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Recent Chats
                      </h3>
                      <div className="space-y-2">
                        {recentSessions.map((session) => (
                          <ActivityCard key={session.id} session={session} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="actions" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ActionCard
                  icon={<MessageSquare className="w-5 h-5" />}
                  label="New Chat"
                  description="Start a new AI conversation"
                  onClick={handleNewChat}
                />
                <ActionCard
                  icon={<Scale className="w-5 h-5" />}
                  label="Start Council"
                  description="Run multi-model comparison"
                  onClick={() => {
                    setActiveView('compare')
                    router.push('/compare')
                  }}
                />
                <ActionCard
                  icon={<Bot className="w-5 h-5" />}
                  label="Start Agent Run"
                  description="Launch autonomous agent task"
                  onClick={handleStartAgentRun}
                />
                <ActionCard
                  icon={<Code2 className="w-5 h-5" />}
                  label="Open Workspace"
                  description="Manage files and patches"
                  onClick={() => {
                    setActiveView('workspace')
                    router.push('/workspace')
                  }}
                />
                <ActionCard
                  icon={<Library className="w-5 h-5" />}
                  label="Prompt Library"
                  description="Browse and run saved prompts"
                  onClick={() => {
                    setActiveView('prompts')
                    router.push('/prompts')
                  }}
                />
                <ActionCard
                  icon={<GitBranch className="w-5 h-5" />}
                  label="Open Coding"
                  description="Launch coding assistant"
                  onClick={() => {
                    setActiveView('coding')
                    router.push('/coding')
                  }}
                />
                <ActionCard
                  icon={<Cpu className="w-5 h-5" />}
                  label="Open Autopilot"
                  description="Manage automation rules and runs"
                  onClick={() => {
                    setActiveView('autopilot')
                    router.push('/autopilot')
                  }}
                />
              </div>
              {!daemonOnline && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100/70">
                  Project health checks are available after the local daemon is running. Use the banner above to copy the start command.
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Dev Commands
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    disabled={!!runningCmd || !daemonOnline}
                    onClick={() => handleRunCmd('typecheck')}
                    className="p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-zinc-700/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-zinc-200">
                        {runningCmd === 'typecheck' ? 'Running typecheck…' : 'Run Typecheck'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">npm run typecheck</p>
                  </button>
                  <button
                    disabled={!!runningCmd || !daemonOnline}
                    onClick={() => handleRunCmd('build')}
                    className="p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-zinc-700/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Box className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-medium text-zinc-200">
                        {runningCmd === 'build' ? 'Running build…' : 'Run Build'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">npm run build</p>
                  </button>
                </div>
                {cmdResult && (
                  <div className={cn(
                    'mt-3 p-3 rounded-xl border text-xs font-mono',
                    cmdResult.ok
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/5 border-red-500/20 text-red-300'
                  )}>
                    <div className="flex items-center gap-2 mb-2 font-sans">
                      {cmdResult.ok
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        : <XCircle className="w-4 h-4 text-red-400" />}
                      <span className="font-medium">{cmdResult.cmd} {cmdResult.ok ? 'passed' : 'failed'}</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-[11px] max-h-40 overflow-auto opacity-80">
                      {cmdResult.output.slice(0, 2000)}
                    </pre>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  )
}

interface StatusCardProps {
  label: string
  value: string
  icon: React.ReactNode
  status: 'success' | 'error' | 'warning' | 'info'
  subtitle: string
}

function StatusCard({ label, value, icon, status, subtitle }: StatusCardProps) {
  const colors = {
    success: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    error: 'text-red-400 bg-red-500/10 border-red-500/20',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-4 rounded-xl border backdrop-blur-sm',
        colors[status]
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm text-zinc-400">{label}</div>
        <div className="opacity-70">{icon}</div>
      </div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs text-zinc-500">{subtitle}</div>
    </motion.div>
  )
}

interface ProviderCardProps {
  provider: ProviderStatus
}

function ProviderCard({ provider }: ProviderCardProps) {
  const isOnline = provider.status === 'online'
  const StatusIcon = isOnline ? CheckCircle2 : XCircle

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'p-4 rounded-xl border backdrop-blur-sm transition-all',
        isOnline
          ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
          : 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700/50'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-sm font-medium text-zinc-200">{provider.name}</div>
        <StatusIcon className={cn('w-4 h-4', isOnline ? 'text-emerald-400' : 'text-zinc-600')} />
      </div>
      <div className={cn('text-xs', isOnline ? 'text-emerald-400' : 'text-zinc-500')}>
        {isOnline ? 'Available' : 'Offline'}
      </div>
      {provider.latency && (
        <div className="text-xs text-zinc-500 mt-1">{provider.latency}ms</div>
      )}
      {provider.message && (
        <div className="text-xs text-zinc-500 mt-2 line-clamp-2">{provider.message}</div>
      )}
    </motion.div>
  )
}

interface ProjectCardProps {
  project: any
  isActive: boolean
  onClick: () => void
}

function ProjectCard({ project, isActive, onClick }: ProjectCardProps) {
  const todoCount = project.todos?.length || 0
  const doneCount = project.todos?.filter((t: any) => t.done).length || 0

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'p-4 rounded-xl border cursor-pointer transition-all',
        isActive
          ? 'bg-violet-500/10 border-violet-500/30 shadow-lg shadow-violet-500/10'
          : 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{project.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-zinc-100 truncate">{project.name}</h3>
            {isActive && <Badge variant="success" className="text-[10px]">Active</Badge>}
          </div>
          {project.description && (
            <p className="text-xs text-zinc-500 line-clamp-2 mb-2">{project.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            {todoCount > 0 && (
              <span>
                {doneCount}/{todoCount} todos
              </span>
            )}
            <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface ActivityCardProps {
  session: any
}

function ActivityCard({ session }: ActivityCardProps) {
  const messageCount = session.messages?.length || 0

  return (
    <div className="p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-zinc-200 truncate mb-1">{session.title}</h4>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span>{messageCount} messages</span>
            <span>•</span>
            <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
            {session.model && (
              <>
                <span>•</span>
                <Badge className="text-[10px]">{session.model}</Badge>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface AgentActivityCardProps {
  task: any
}

function AgentActivityCard({ task }: AgentActivityCardProps) {
  const statusColor = {
    done: 'text-emerald-400',
    running: 'text-blue-400',
    failed: 'text-red-400',
    pending: 'text-zinc-400',
  }[task.status as string] ?? 'text-zinc-400'

  return (
    <div className="p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-zinc-200 truncate">{task.title}</h4>
          <div className="flex items-center gap-2 mt-0.5 text-xs">
            <span className={statusColor}>{task.status}</span>
            {task.steps?.length > 0 && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-500">{task.steps.length} steps</span>
              </>
            )}
            {task.createdAt && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-600">{new Date(task.createdAt).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface AutomationActivityCardProps {
  run: AutomationRun
}

function AutomationActivityCard({ run }: AutomationActivityCardProps) {
  const statusColor = {
    queued: 'text-zinc-400',
    running: 'text-blue-400',
    completed: 'text-emerald-400',
    failed: 'text-red-400',
    blocked: 'text-red-400',
    'needs-approval': 'text-amber-400',
  }[run.status]

  return (
    <div className="p-3 rounded-xl border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-zinc-200 truncate">{run.title}</h4>
          <div className="flex items-center gap-2 mt-0.5 text-xs">
            <span className={statusColor}>{run.status}</span>
            <span className="text-zinc-600">-</span>
            <span className="text-zinc-500">{run.actions.length} actions</span>
            <span className="text-zinc-600">-</span>
            <span className="text-zinc-600">{new Date(run.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ActionCardProps {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}

function ActionCard({ icon, label, description, onClick }: ActionCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-zinc-700/50 transition-all text-left"
    >
      <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-3 text-violet-400">
        {icon}
      </div>
      <h4 className="text-sm font-medium text-zinc-200 mb-1">{label}</h4>
      <p className="text-xs text-zinc-500">{description}</p>
    </motion.button>
  )
}
