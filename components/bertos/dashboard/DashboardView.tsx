'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity, Zap, Clock, CheckCircle2, XCircle, AlertCircle,
  FolderOpen, MessageSquare, Code2, Play, TrendingUp, Server,
  Sparkles, GitBranch, Terminal, Box
} from 'lucide-react'
import { useProjectStore } from '@/store/bertos/projects'
import { useChatStore } from '@/store/bertos/chat'
import { useUIStore } from '@/store/bertos/ui'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/bertos/cn'
import { useRouter } from 'next/navigation'
import type { ProviderHealth } from '@/lib/bertos/providers/types'

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
  const { setActiveView, selectedModel } = useUIStore()
  const router = useRouter()
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [repoStatus, setRepoStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
          {/* System Status */}
          <section>
            <h2 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" />
              System Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatusCard
                label="Providers Online"
                value={`${onlineProviders.length}/${providers.length}`}
                icon={<Zap className="w-5 h-5" />}
                status={onlineProviders.length > 0 ? 'success' : 'error'}
                subtitle={onlineProviders.length > 0 ? 'System ready' : 'No providers available'}
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
                value={repoStatus?.inRepo ? 'Detected' : 'No Repo'}
                icon={<GitBranch className="w-5 h-5" />}
                status={repoStatus?.inRepo ? 'success' : 'warning'}
                subtitle={repoStatus?.branch || 'Not in git repo'}
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

            <TabsContent value="activity" className="space-y-3 mt-4">
              {recentSessions.length === 0 ? (
                <div className="p-12 rounded-xl border border-zinc-800/50 bg-zinc-900/20 text-center">
                  <Clock className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-400">No recent activity</p>
                </div>
              ) : (
                recentSessions.map((session) => (
                  <ActivityCard key={session.id} session={session} />
                ))
              )}
            </TabsContent>

            <TabsContent value="actions" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ActionCard
                  icon={<MessageSquare className="w-5 h-5" />}
                  label="New Chat"
                  description="Start a new conversation"
                  onClick={handleNewChat}
                />
                <ActionCard
                  icon={<Code2 className="w-5 h-5" />}
                  label="Open Coding"
                  description="Launch coding workspace"
                  onClick={() => {
                    setActiveView('coding')
                    router.push('/coding')
                  }}
                />
                <ActionCard
                  icon={<GitBranch className="w-5 h-5" />}
                  label="Open Workspace"
                  description="Manage files and patches"
                  onClick={() => {
                    setActiveView('workspace')
                    router.push('/workspace')
                  }}
                />
                <ActionCard
                  icon={<Activity className="w-5 h-5" />}
                  label="Run Agent"
                  description="Start autonomous task"
                  onClick={() => {
                    setActiveView('agents')
                    router.push('/agents')
                  }}
                />
                <ActionCard
                  icon={<Terminal className="w-5 h-5" />}
                  label="Compare Models"
                  description="Test multiple AIs"
                  onClick={() => {
                    setActiveView('compare')
                    router.push('/compare')
                  }}
                />
                <ActionCard
                  icon={<Box className="w-5 h-5" />}
                  label="Settings"
                  description="Configure providers"
                  onClick={() => {
                    setActiveView('settings')
                    router.push('/settings')
                  }}
                />
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
