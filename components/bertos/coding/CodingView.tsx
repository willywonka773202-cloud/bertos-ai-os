'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clipboard,
  Code2,
  Copy,
  GitBranch,
  History,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CODING_MISSION_TEMPLATES,
  compileCodingMission,
  providerToAIModel,
  type CodingMission,
} from '@/lib/bertos/missions'
import type { AIModel } from '@/lib/bertos/types'
import type { MissionProvider } from '@/lib/bertos/missions'
import { useDaemonHealth } from '@/hooks/useDaemonHealth'
import { DaemonHealthBanner } from '@/components/bertos/shell/DaemonHealthBanner'
import { SelfCodingSafetyContract } from '@/components/bertos/shared/SelfCodingSafetyContract'
import {
  AGENT_ROSTER,
  TASK_TYPE_OPTIONS,
  buildSelfCodingPrompt,
  recommendAgentForTask,
  type CommandCenterAgentId,
  type CommandCenterMode,
  type CommandCenterTaskType,
} from '@/lib/bertos/command-center'
import { AGENT_TEAMS, buildAgentTeamPrompt, getAgentTeam, type AgentTeamId } from '@/lib/bertos/agent-teams'
import { RouteHero } from '@/components/bertos/hermes'

interface RepoStatus {
  online?: boolean
  repo?: {
    root: string
    branch: string
    remote: string
    status: string
    safeRepo: boolean
    blockedReason?: string
  }
  error?: string
}

interface DirectRepoStatus {
  ok: boolean
  repoRoot?: string
  branch: string
  dirty: boolean
  changedFiles: number
  lastCommit: string
  diffStat: string
  safetyStatus: string
  selfBuildMode: boolean
  error?: string
}

interface PatchFile {
  path: string
  operation: 'modify' | 'create' | 'delete'
  before?: string
  after?: string
}

interface PatchProposal {
  summary: string
  provider?: string
  files: PatchFile[]
  commandsToRun: string[]
  riskLevel: 'low' | 'medium' | 'high'
}

interface PatchResponse {
  ok: boolean
  proposal?: PatchProposal
  provider?: {
    providerId?: string
    providerName?: string
    modelOrTool?: string
    source?: string
    latencyMs?: number
    fallbackUsed?: string
  }
  error?: string
  debug?: {
    serialization?: {
      promptChars: number
      includedFileCount: number
      includedFilePaths: string[]
      serializedContextPreview: string
      serializedPayloadPreview: string
      fileBodiesPresent: boolean
      truncationWarnings: string[]
    }
    parseError?: string
  }
  routeDebug?: {
    selectedProvider?: string
    routerMode?: string
    taskType?: string
    inventoryShortcutUsed?: boolean
  }
}

interface CommandResult {
  ok?: boolean
  stdout?: string
  stderr?: string
  exitCode?: number | null
  durationMs?: number
  error?: string
}

interface BuilderHistoryItem {
  id: string
  title: string
  templateId: string
  provider: MissionProvider
  risk: CodingMission['risk']
  scope: CodingMission['estimatedScope']
  status: 'compiled' | 'running' | 'proposed' | 'failed'
  createdAt: string
  prompt: string
  missionPrompt: string
}

const DEFAULT_PROMPT = `Add a focused improvement to BertOS.

Goal:
- Describe the exact app, workflow, bug, or feature here.

Constraints:
- Keep the patch focused.
- Preserve daemon, provider routing, Workspace, Evolution Lab, and chat.
- Never touch Sylistly.
- Validate before commit.`

const VALIDATION_COMMANDS = new Map<string, { executable: string; args: string[]; timeoutMs?: number }>([
  ['npm run typecheck', { executable: 'npm', args: ['run', 'typecheck'], timeoutMs: 180000 }],
  ['npm run build', { executable: 'npm', args: ['run', 'build'], timeoutMs: 240000 }],
  ['npm run bertos:safety', { executable: 'npm', args: ['run', 'bertos:safety'], timeoutMs: 120000 }],
  ['npm run smoke', { executable: 'npm', args: ['run', 'smoke'], timeoutMs: 180000 }],
  ['npm run validate', { executable: 'npm', args: ['run', 'validate'], timeoutMs: 300000 }],
])

const PROVIDER_OPTIONS: Array<{ id: 'recommended' | MissionProvider; label: string; description: string }> = [
  { id: 'recommended', label: 'Recommended', description: 'Use BertOS mission routing.' },
  { id: 'ollama', label: 'Ollama', description: 'Cheap/default summaries and low-risk work.' },
  { id: 'gemini', label: 'Gemini CLI', description: 'Long planning and research.' },
  { id: 'claude', label: 'Claude Code', description: 'Architecture, UI review, refactors.' },
  { id: 'codex', label: 'Codex CLI', description: 'Implementation and repo edits.' },
  { id: 'team', label: 'Team Mode', description: 'Plan, implement, then review.' },
]

const MODE_OPTIONS = [
  { id: 'plan', label: 'Plan only', description: 'Compile a mission and copy prompts. No patch request.' },
  { id: 'prompt', label: 'Generate prompt', description: 'Produce provider-specific CLI prompts.' },
  { id: 'local', label: 'Safe local task', description: 'Use BertOS patch flow and daemon safety gates.' },
  { id: 'external', label: 'External CLI task', description: 'Prepare prompts for Claude, Codex, Gemini, Hermes, or FCC.' },
] as const

function normalizeCommand(command: string) {
  return command.trim().replace(/\s+/g, ' ')
}

function operationLabel(operation: PatchFile['operation']) {
  if (operation === 'create') return 'Created file'
  if (operation === 'delete') return 'Deleted file'
  return 'Modified file'
}

function badgeForRisk(risk: PatchProposal['riskLevel']) {
  if (risk === 'high') return 'error'
  if (risk === 'medium') return 'warning'
  return 'success'
}

function applyProviderOverride(mission: CodingMission, providerOverride: 'recommended' | MissionProvider): CodingMission {
  if (providerOverride === 'recommended' || providerOverride === mission.provider) return mission
  return {
    ...mission,
    provider: providerOverride,
    providerReason: `Manually selected ${providerOverride} for this mission. BertOS will still keep safety and validation gates active.`,
    mode: providerOverride === 'team' ? 'team' : mission.mode,
  }
}

type CopyPromptTarget = 'claude' | 'codex' | 'gemini' | 'hermes' | 'fcc' | 'devin' | 'qwen' | 'hyperframes' | 'remotion' | 'generic'

function buildCopyPrompt(mission: CodingMission, target: CopyPromptTarget, teamPrompt?: string) {
  const role = target === 'claude'
    ? 'Claude Code reviewer/architect'
    : target === 'codex'
      ? 'Codex implementation agent'
      : target === 'gemini'
        ? 'Gemini planning/research agent'
        : target === 'hermes'
          ? 'Hermes/Nous paid proxy reviewer'
          : target === 'fcc'
            ? 'Free Claude Code Proxy experimental reviewer'
            : target === 'devin'
              ? 'Devin external cloud coding teammate'
              : target === 'qwen'
                ? 'Qwen experimental long-context reviewer'
                : target === 'hyperframes'
                  ? 'Hyperframes planned local video pipeline planner'
                  : target === 'remotion'
                    ? 'Remotion planned local video pipeline planner'
                    : 'general AI engineering agent'
  return [
    `You are the ${role} for BertOS.`,
    '',
    mission.suggestedPrompt,
    ...(teamPrompt ? ['', 'Agent team handoff:', teamPrompt] : []),
    '',
    'Provider role:',
    target === 'claude'
      ? '- Focus on architecture, UI quality, safety risks, and reviewable diffs.'
      : target === 'codex'
        ? '- Focus on implementation, exact files, patch quality, and validation.'
        : target === 'gemini'
          ? '- Focus on planning, context gaps, file discovery, and risk analysis.'
        : target === 'hermes'
          ? '- Only use this if paid Hermes/Nous credits were explicitly approved. Do not assume free models are available.'
          : target === 'fcc'
            ? '- Treat this as experimental. Official Claude Code remains the trusted provider.'
            : target === 'devin'
              ? '- Treat this as a scoped PR task. Do not auto-merge and do not push without explicit approval.'
              : target === 'qwen'
                ? '- Use long-context planning/review. Do not assume free unlimited usage.'
                : target === 'hyperframes'
                  ? '- Generate setup/implementation guidance for Hyperframes only. Verify Node, FFmpeg, and Hyperframes first. Do not claim rendering works.'
                  : target === 'remotion'
                    ? '- Generate setup/implementation guidance for Remotion only. Verify Node, FFmpeg, and Remotion first. Do not claim rendering works.'
                : '- Keep the work scoped, honest, and validation-focused.',
    '',
    'Output requirements:',
    '- Do not claim success unless validation passed.',
    '- Do not push to GitHub.',
    '- Do not touch Sylistly.',
    '- Do not expose or request secrets.',
  ].join('\n')
}

export function CodingView() {
  const [taskTitle, setTaskTitle] = useState('')
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [taskType, setTaskType] = useState<CommandCenterTaskType>('ui-react-change')
  const [executionShape, setExecutionShape] = useState<'single' | 'team'>('single')
  const [selectedTeamId, setSelectedTeamId] = useState<AgentTeamId>('coding-team')
  const [agentTarget, setAgentTarget] = useState<'auto' | CommandCenterAgentId>('auto')
  const [templateId, setTemplateId] = useState(CODING_MISSION_TEMPLATES[0]?.id ?? '')
  const [providerOverride, setProviderOverride] = useState<'recommended' | MissionProvider>('recommended')
  const [builderMode, setBuilderMode] = useState<typeof MODE_OPTIONS[number]['id']>('local')
  const [mission, setMission] = useState<CodingMission | null>(null)
  const [repoStatus, setRepoStatus] = useState<RepoStatus | null>(null)
  const [patchResponse, setPatchResponse] = useState<PatchResponse | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [buildingMission, setBuildingMission] = useState(false)
  const [runningMission, setRunningMission] = useState(false)
  const [applyingPatch, setApplyingPatch] = useState(false)
  const [runningChecks, setRunningChecks] = useState(false)
  const [commandResults, setCommandResults] = useState<Array<{ command: string; result: CommandResult }>>([])
  const [runLog, setRunLog] = useState<string[]>([])
  const [history, setHistory] = useState<BuilderHistoryItem[]>([])
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
  const activeHistoryIdRef = useRef<string | null>(null)
  const [directRepo, setDirectRepo] = useState<DirectRepoStatus | null>(null)
  const [chatDraftLoaded, setChatDraftLoaded] = useState(false)
  const [directCheckResults, setDirectCheckResults] = useState<Record<string, { ok: boolean; output: string; exitCode: number; durationMs: number }> | null>(null)
  const [runningDirectChecks, setRunningDirectChecks] = useState(false)
  const { health: daemonHealth, loading: daemonLoading, refresh: refreshDaemonHealth } = useDaemonHealth(30000)

  const template = useMemo(
    () => CODING_MISSION_TEMPLATES.find(item => item.id === templateId),
    [templateId],
  )
  const safe = Boolean(repoStatus?.repo?.safeRepo)
  const daemonOnline = Boolean(daemonHealth?.daemonOnline)
  const canRunLocalMission = builderMode === 'local' && executionShape === 'single'
  const recommendedAgent = useMemo(() => recommendAgentForTask(taskType, prompt), [taskType, prompt])
  const selectedAgent = useMemo(
    () => agentTarget === 'auto' ? recommendedAgent : (AGENT_ROSTER.find(agent => agent.id === agentTarget) ?? recommendedAgent),
    [agentTarget, recommendedAgent],
  )
  const selectedTeam = useMemo(() => getAgentTeam(selectedTeamId), [selectedTeamId])
  const commandCenterMode: CommandCenterMode = builderMode === 'plan'
    ? 'plan-only'
    : builderMode === 'local'
      ? 'patch-proposal'
      : builderMode === 'external'
        ? 'external-prompt'
        : 'external-prompt'
  const proposal = patchResponse?.proposal
  const safeValidationCommands = useMemo(() => {
    return (proposal?.commandsToRun ?? [])
      .map(normalizeCommand)
      .filter(command => VALIDATION_COMMANDS.has(command))
  }, [proposal])

  const refreshRepoStatus = async () => {
    try {
      const res = await fetch('/api/local-daemon/repo/status', { cache: 'no-store' })
      const data = await res.json() as RepoStatus
      setRepoStatus(data)
    } catch (error) {
      setRepoStatus({ online: false, error: error instanceof Error ? error.message : 'Could not reach local daemon.' })
    }
  }

  useEffect(() => {
    void refreshRepoStatus()
    // Direct repo status (works without daemon)
    fetch('/api/bertos/repo/status', { cache: 'no-store' })
      .then(res => res.json())
      .then((data: DirectRepoStatus) => setDirectRepo(data))
      .catch(() => setDirectRepo({ ok: false, branch: 'unknown', dirty: false, changedFiles: 0, lastCommit: 'unknown', diffStat: 'unavailable', safetyStatus: 'unknown', selfBuildMode: false, error: 'Could not read direct repo status.' }))
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('bertos-builder-history')
      if (raw) setHistory(JSON.parse(raw) as BuilderHistoryItem[])
    } catch {
      setHistory([])
    }

    try {
      const teamRequestRaw = window.localStorage.getItem('bertos-builder-team-request')
      if (teamRequestRaw) {
        const request = JSON.parse(teamRequestRaw) as { teamId?: AgentTeamId; task?: string }
        if (request.teamId && AGENT_TEAMS.some(team => team.id === request.teamId)) {
          setExecutionShape('team')
          setSelectedTeamId(request.teamId)
          setBuilderMode('external')
          if (request.task) setPrompt(request.task)
          window.localStorage.removeItem('bertos-builder-team-request')
        }
      }
    } catch {
      // Ignore malformed handoff data and leave Builder in its default state.
    }

    // Chat-to-coding bridge: pick up draft from chat if present
    try {
      const chatDraft = window.localStorage.getItem('bertos-coding-draft')
      if (chatDraft) {
        setPrompt(chatDraft)
        setChatDraftLoaded(true)
        window.localStorage.removeItem('bertos-coding-draft')
      }
    } catch {
      // Ignore storage errors.
    }
  }, [])

  const persistHistory = (items: BuilderHistoryItem[]) => {
    setHistory(items)
    try {
      window.localStorage.setItem('bertos-builder-history', JSON.stringify(items.slice(0, 20)))
    } catch {
      // Local history is a convenience; ignore storage quota/private-mode failures.
    }
  }

  const appendLog = (line: string) => {
    setRunLog(current => [`${new Date().toLocaleTimeString()} ${line}`, ...current].slice(0, 80))
  }

  const compileBuilderMission = () => {
    const teamPrompt = executionShape === 'team'
      ? buildAgentTeamPrompt(selectedTeam, prompt)
      : ''
    const commandCenterPrompt = buildSelfCodingPrompt({
      title: taskTitle.trim() || prompt.trim().split(/\r?\n/).find(Boolean) || 'BertOS self-coding task',
      description: executionShape === 'team'
        ? `${prompt}\n\n${teamPrompt}`
        : prompt,
      taskType,
      mode: executionShape === 'team' ? 'external-prompt' : commandCenterMode,
      agentId: executionShape === 'team' ? 'bertos-orchestrator' : selectedAgent.id,
    })
    return applyProviderOverride(compileCodingMission(commandCenterPrompt, template), providerOverride)
  }

  const upsertHistory = (compiled: CodingMission, status: BuilderHistoryItem['status']) => {
    const id = activeHistoryIdRef.current ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    activeHistoryIdRef.current = id
    setActiveHistoryId(id)
    const item: BuilderHistoryItem = {
      id,
      title: compiled.title,
      templateId,
      provider: compiled.provider,
      risk: compiled.risk,
      scope: compiled.estimatedScope,
      status,
      createdAt: new Date().toISOString(),
      prompt,
      missionPrompt: compiled.suggestedPrompt,
    }
    persistHistory([item, ...history.filter(existing => existing.id !== id)].slice(0, 20))
  }

  const buildMission = () => {
    setBuildingMission(true)
    try {
      const compiled = compileBuilderMission()
      setMission(compiled)
      setPatchResponse(null)
      setSelectedFiles(new Set())
      upsertHistory(compiled, 'compiled')
      appendLog(`Mission compiled: ${compiled.title}`)
      if (compiled.warnings.length) toast.warning(compiled.warnings[0])
      else toast.success('Mission compiled.')
    } finally {
      setBuildingMission(false)
    }
  }

  const runMission = async () => {
    const compiled = mission ?? compileBuilderMission()
    setMission(compiled)
    upsertHistory(compiled, 'running')
    setRunningMission(true)
    setPatchResponse(null)
    setCommandResults([])
    appendLog(`Patch generation started with ${compiled.provider}.`)
    try {
      const provider = providerToAIModel(compiled.provider)
      const res = await fetch('/api/workspace/patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: compiled.suggestedPrompt,
          provider: provider satisfies AIModel,
          context: {
            repo: repoStatus?.repo,
            gitStatus: repoStatus?.repo?.status,
            fileTree: compiled.likelyFiles,
            memories: [
              'BertOS is a standalone AI operating system.',
              'Never touch Sylistly.',
              'Use daemon-safe file and terminal operations only.',
            ],
          },
        }),
      })
      const data = await res.json() as PatchResponse
      setPatchResponse(data)
      if (!res.ok || !data.ok || !data.proposal) {
        upsertHistory(compiled, 'failed')
        appendLog(`Patch generation failed: ${data.error ?? `HTTP ${res.status}`}`)
        toast.error(data.error ?? 'Patch generation failed.')
        return
      }
      setSelectedFiles(new Set(data.proposal.files.map(file => file.path)))
      upsertHistory(compiled, 'proposed')
      appendLog(`Patch proposed: ${data.proposal.files.length} file(s).`)
      toast.success(`Patch proposed by ${data.provider?.providerName ?? data.proposal.provider ?? 'provider'}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Mission run failed.'
      upsertHistory(compiled, 'failed')
      appendLog(message)
      toast.error(message)
    } finally {
      setRunningMission(false)
    }
  }

  const applySelectedPatch = async () => {
    if (!proposal || selectedFiles.size === 0) return
    if (!safe) return toast.error('Patch apply requires a safe local daemon repo.')
    const files = proposal.files.filter(file => selectedFiles.has(file.path))
    if (files.some(file => file.operation === 'delete') && !window.confirm('This patch deletes files. Continue through the safe daemon delete endpoint?')) return
    setApplyingPatch(true)
    const patchHistoryId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      for (const file of files) {
        const body = file.operation === 'delete'
          ? {
              path: file.path,
              operation: 'delete',
              confirm: true,
              patchHistoryId,
              confirmPatchHistoryId: patchHistoryId,
            }
          : {
              path: file.path,
              operation: file.operation === 'create' ? 'create' : 'write',
              content: file.after ?? '',
            }
        const res = await fetch('/api/local-daemon/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `Could not apply ${file.path}.`)
        appendLog(`Applied ${file.operation}: ${file.path}`)
      }
      toast.success(`Applied ${files.length} file(s).`)
      await refreshRepoStatus()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Patch apply failed.'
      appendLog(message)
      toast.error(message)
    } finally {
      setApplyingPatch(false)
    }
  }

  const runChecks = async () => {
    if (!safe) return toast.error('Validation requires the local daemon.')
    if (!safeValidationCommands.length) return toast.message('No safe validation commands are available for this patch.')
    setRunningChecks(true)
    setCommandResults([])
    try {
      for (const command of safeValidationCommands) {
        const config = VALIDATION_COMMANDS.get(command)
        if (!config) continue
        appendLog(`Running ${command}`)
        const res = await fetch('/api/local-daemon/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        })
        const result = await res.json() as CommandResult
        setCommandResults(current => [...current, { command, result }])
        appendLog(`${command} finished with exit ${result.exitCode ?? (res.ok ? 0 : 1)}.`)
        if (!res.ok || result.ok === false || (typeof result.exitCode === 'number' && result.exitCode !== 0)) break
      }
    } finally {
      setRunningChecks(false)
    }
  }

  const runDirectChecks = async () => {
    setRunningDirectChecks(true)
    setDirectCheckResults(null)
    appendLog('Running direct checks (no daemon required)...')
    try {
      const res = await fetch('/api/bertos/repo/run-checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checks: ['typecheck', 'bertos:safety'] }),
      })
      const data = await res.json() as { ok: boolean; results: typeof directCheckResults; summary: string }
      setDirectCheckResults(data.results)
      appendLog(data.summary ?? (data.ok ? 'Checks passed.' : 'Some checks failed.'))
      // Refresh direct repo status after checks
      fetch('/api/bertos/repo/status', { cache: 'no-store' })
        .then(r => r.json()).then((d: DirectRepoStatus) => setDirectRepo(d)).catch(() => null)
    } catch (error) {
      appendLog(error instanceof Error ? error.message : 'Direct check run failed.')
    } finally {
      setRunningDirectChecks(false)
    }
  }

  const copyMission = async () => {
    const compiled = mission ?? compileBuilderMission()
    await navigator.clipboard.writeText(compiled.suggestedPrompt)
    toast.success('Mission prompt copied.')
  }

  const copyProviderPrompt = async (target: CopyPromptTarget) => {
    const compiled = mission ?? compileBuilderMission()
    const teamPrompt = executionShape === 'team' ? buildAgentTeamPrompt(selectedTeam, prompt) : undefined
    await navigator.clipboard.writeText(buildCopyPrompt(compiled, target, teamPrompt))
    const label = target === 'claude' ? 'Claude' : target === 'codex' ? 'Codex' : target === 'gemini' ? 'Gemini' : target === 'hermes' ? 'Hermes' : target === 'fcc' ? 'FCC' : target === 'devin' ? 'Devin' : target === 'qwen' ? 'Qwen' : target === 'hyperframes' ? 'Hyperframes' : target === 'remotion' ? 'Remotion' : 'Generic'
    toast.success(`${label} prompt copied.`)
  }

  const loadHistoryItem = (item: BuilderHistoryItem) => {
    setPrompt(item.prompt)
    setTemplateId(item.templateId)
    setProviderOverride(item.provider)
    setMission(null)
    setPatchResponse(null)
    setSelectedFiles(new Set())
    activeHistoryIdRef.current = item.id
    setActiveHistoryId(item.id)
    appendLog(`Loaded history item: ${item.title}`)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="hidden w-72 shrink-0 border-r border-zinc-800/50 bg-zinc-950/70 md:block">
        <div className="border-b border-zinc-800/50 p-4">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-violet-400" />
            <h1 className="text-sm font-semibold text-zinc-100">Builder / Code Lab</h1>
          </div>
          <p className="mt-1 text-xs text-zinc-600">Mission compiler for large build prompts.</p>
        </div>
        <ScrollArea className="h-[calc(100%-73px)]">
          <div className="space-y-4 p-3">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-zinc-300">Daemon</span>
                </div>
                <Badge variant={daemonOnline ? 'success' : 'warning'} className="text-[9px]">
                  {daemonLoading ? 'checking' : daemonOnline ? 'online' : 'offline'}
                </Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-600">
                {daemonOnline
                  ? 'Repo commands, patch apply, and validation checks are available.'
                  : 'Start npm run bertos:daemon for file edits, checks, and CLI agents.'}
              </p>
              <button
                onClick={() => void refreshDaemonHealth()}
                className="mt-2 flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh daemon
              </button>
            </section>

            <section>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-700">Templates</div>
              <div className="space-y-1">
                {CODING_MISSION_TEMPLATES.map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setTemplateId(item.id)
                      setPrompt(current => current === DEFAULT_PROMPT ? item.seedPrompt : current)
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                      templateId === item.id
                        ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                        : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                    }`}
                  >
                    <div className="font-medium">{item.label}</div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] text-zinc-600">{item.description}</div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-700">
                <History className="h-3 w-3" />
                Task history
              </div>
              <div className="space-y-1">
                {history.length === 0 && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-[11px] text-zinc-600">
                    Compiled missions will appear here.
                  </div>
                )}
                {history.map(item => (
                  <button
                    key={item.id}
                    onClick={() => loadHistoryItem(item)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                      activeHistoryId === item.id
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                    }`}
                  >
                    <div className="truncate text-xs font-medium text-zinc-300">{item.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant={item.status === 'failed' ? 'error' : item.status === 'proposed' ? 'success' : 'default'} className="text-[9px]">
                        {item.status}
                      </Badge>
                      <Badge variant="default" className="text-[9px]">{item.provider}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      </aside>

      <main className="grid min-w-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex min-w-0 flex-col border-r border-zinc-800/50">
          <div className="border-b border-zinc-800/50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h2 className="text-sm font-semibold text-zinc-100">Mission Builder 2.0</h2>
                  <Badge variant="success" className="text-[9px]">Self-Build Mode: Safe</Badge>
                  {directRepo?.branch && directRepo.branch !== 'unknown' && (
                    <Badge variant="default" className="text-[9px] font-mono">
                      <GitBranch className="h-2.5 w-2.5 mr-0.5" />{directRepo.branch}
                    </Badge>
                  )}
                  {directRepo?.dirty && (
                    <Badge variant="warning" className="text-[9px]">{directRepo.changedFiles} file{directRepo.changedFiles !== 1 ? 's' : ''} dirty</Badge>
                  )}
                  {directRepo && !directRepo.dirty && directRepo.ok && (
                    <Badge variant="success" className="text-[9px]">clean</Badge>
                  )}
                  {chatDraftLoaded && (
                    <Badge variant="warning" className="text-[9px]">Chat draft loaded</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-zinc-600">
                  BertOS cockpit — compile, route, patch, validate.
                  {directRepo?.lastCommit && directRepo.lastCommit !== 'unknown' && (
                    <span className="ml-1 font-mono opacity-60">{directRepo.lastCommit}</span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={safe ? 'success' : 'warning'} className="text-[10px]">
                  {safe ? 'daemon safe' : 'daemon offline'}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => void runDirectChecks()} disabled={runningDirectChecks}>
                  {runningDirectChecks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Run Checks
                </Button>
                <Button size="sm" variant="outline" onClick={() => void refreshRepoStatus()}>
                  <GitBranch className="h-3.5 w-3.5" />Refresh
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              <RouteHero
                eyebrow="engineering forge"
                title="Mission Builder 2.0"
                subtitle="Compile large implementation prompts into safety-scoped missions with explicit files, commands, provider routing, and proof gates before any patch is applied."
                status={buildingMission || runningMission || applyingPatch || runningChecks ? 'active' : daemonOnline ? 'nominal' : 'warning'}
                seal={<Code2 className="h-5 w-5" />}
                metrics={[
                  { label: 'Daemon', value: daemonLoading ? 'checking' : daemonOnline ? 'online' : 'offline', detail: daemonHealth?.workspaceRoot ?? 'local bridge', tone: daemonOnline ? 'cyan' : 'amber' },
                  { label: 'Mission', value: mission ? 'compiled' : 'draft', detail: template?.label ?? 'custom prompt', tone: mission ? 'emerald' : 'bronze' },
                  { label: 'Executor', value: executionShape === 'team' ? 'agent team' : providerOverride, detail: executionShape === 'team' ? selectedTeam.name : 'single provider', tone: 'cyan' },
                  { label: 'Proof Gate', value: patchResponse ? patchResponse.proposal?.riskLevel ?? 'proposal' : 'pending', detail: 'typecheck/build before commit', tone: patchResponse ? 'amber' : 'zinc' },
                ]}
              />
              <DaemonHealthBanner health={daemonHealth} loading={daemonLoading} onRefresh={refreshDaemonHealth} />

              <section className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="lg:col-span-2">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-zinc-100">Task definition</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Give the mission a title, choose the type of work, and BertOS will recommend the agent/provider before compiling the prompt.
                  </p>
                </div>
                <input
                  value={taskTitle}
                  onChange={event => setTaskTitle(event.target.value)}
                  placeholder="Task title, e.g. Add route smoke checks"
                  className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-violet-500/60"
                />
                <select
                  value={taskType}
                  onChange={event => setTaskType(event.target.value as CommandCenterTaskType)}
                  className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-violet-500/60"
                >
                  {TASK_TYPE_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <div className="lg:col-span-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                    <div className="text-xs font-semibold text-zinc-300">Recommended agent</div>
                    <div className="mt-1 text-sm text-zinc-100">{recommendedAgent.name}</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">{recommendedAgent.bestUse}</p>
                  </div>
                  <select
                    value={agentTarget}
                    onChange={event => setAgentTarget(event.target.value as 'auto' | CommandCenterAgentId)}
                    className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-emerald-500/60"
                  >
                    <option value="auto">Auto recommendation</option>
                    {AGENT_ROSTER.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-2 grid gap-2 md:grid-cols-[180px_minmax(0,1fr)]">
                  <select
                    value={executionShape}
                    onChange={event => setExecutionShape(event.target.value as 'single' | 'team')}
                    className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-amber-500/60"
                  >
                    <option value="single">Single agent mode</option>
                    <option value="team">Team mode</option>
                  </select>
                  {executionShape === 'team' ? (
                    <select
                      value={selectedTeamId}
                      onChange={event => setSelectedTeamId(event.target.value as AgentTeamId)}
                      className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-amber-500/60"
                    >
                      {AGENT_TEAMS.map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-xs text-zinc-600">
                      Single agent mode uses the recommended or selected provider. Switch to Team Mode for role-based handoffs.
                    </div>
                  )}
                  {executionShape === 'team' && (
                    <div className="md:col-span-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="warning" className="text-[9px]">{selectedTeam.status}</Badge>
                        <span className="text-xs font-semibold text-amber-100">{selectedTeam.name}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-amber-200/75">{selectedTeam.bestUse}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedTeam.agents.slice(0, 6).map(agent => (
                          <Badge key={agent.id} variant={agent.status === 'live' ? 'success' : agent.status === 'planned' ? 'default' : 'warning'} className="text-[9px]">
                            {agent.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Bot className="h-4 w-4 text-violet-400" />
                    <h3 className="text-sm font-semibold text-zinc-100">Provider route</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Choose Recommended for BertOS routing, or force a provider when preparing a patch request.
                    External agent target is currently {selectedAgent.name}; Hermes / Nous remains paid-gated.
                  </p>
                </div>
                <select
                  value={providerOverride}
                  onChange={event => setProviderOverride(event.target.value as 'recommended' | MissionProvider)}
                  className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-violet-500/60"
                >
                  {PROVIDER_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <div className="lg:col-span-2 grid gap-2 md:grid-cols-3">
                  {PROVIDER_OPTIONS.filter(option => option.id !== 'recommended').slice(0, 3).map(option => (
                    <div key={option.id} className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
                      <div className="text-xs font-medium text-zinc-300">{option.label}</div>
                      <div className="mt-1 text-[11px] text-zinc-600">{option.description}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Clipboard className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-zinc-100">Workflow mode</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-500">
                    Use Plan/Prompt modes when you only want copyable instructions. Use Safe local task when the daemon is running and you want BertOS patch review.
                  </p>
                </div>
                <select
                  value={builderMode}
                  onChange={event => setBuilderMode(event.target.value as typeof MODE_OPTIONS[number]['id'])}
                  className="h-10 rounded-lg border border-zinc-800 bg-zinc-900 px-3 text-sm text-zinc-200 outline-none focus:border-emerald-500/60"
                >
                  {MODE_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <div className="lg:col-span-2 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 text-xs text-zinc-500">
                  {MODE_OPTIONS.find(option => option.id === builderMode)?.description}
                  <div className="mt-2 text-[11px] text-zinc-600">
                    Planned creative agents: Hyperframes setup and Remotion setup prompts are copy-only until local installation and FFmpeg/tool detection are verified.
                  </div>
                </div>
              </section>

              <textarea
                value={prompt}
                onChange={event => {
                  setPrompt(event.target.value)
                  activeHistoryIdRef.current = null
                  setActiveHistoryId(null)
                }}
                placeholder="Paste a huge Claude/Codex/Gemini-style build prompt..."
                className="min-h-72 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-violet-500/60"
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={buildMission} disabled={buildingMission || !prompt.trim()}>
                  {buildingMission ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Build mission
                </Button>
                <Button variant="secondary" onClick={() => void runMission()} disabled={runningMission || !prompt.trim() || !canRunLocalMission}>
                  {runningMission ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {canRunLocalMission ? 'Run mission' : 'Copy-only mode'}
                </Button>
                <Button variant="outline" onClick={() => void copyMission()}>
                  <Copy className="h-4 w-4" />Copy mission
                </Button>
              </div>

              <SelfCodingSafetyContract />

              {mission && (
                <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-100">{mission.title}</h3>
                    <Badge variant={mission.risk === 'high' ? 'error' : mission.risk === 'medium' ? 'warning' : 'success'} className="text-[10px]">{mission.risk} risk</Badge>
                    <Badge variant="default" className="text-[10px]">{mission.estimatedScope}</Badge>
                    <Badge variant={mission.worktreeRecommended ? 'warning' : 'default'} className="text-[10px]">
                      {mission.worktreeRecommended ? 'worktree recommended' : 'main ok with review'}
                    </Badge>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-600">Provider</div>
                      <div className="text-sm text-zinc-200">{mission.provider}</div>
                      <p className="mt-1 text-xs text-zinc-500">{mission.providerReason}</p>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-600">Validation</div>
                      <div className="flex flex-wrap gap-1">
                        {mission.validation.map(command => <Badge key={command} variant="default" className="text-[10px]">{command}</Badge>)}
                      </div>
                    </div>
                  </div>
                  {mission.warnings.length > 0 && (
                    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                      {mission.warnings.map(warning => <div key={warning}>• {warning}</div>)}
                    </div>
                  )}
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-600">Likely files</div>
                      <div className="space-y-1 text-xs text-zinc-500">
                        {mission.likelyFiles.length ? mission.likelyFiles.map(file => <div key={file} className="truncate font-mono">{file}</div>) : <div>Context search will locate files.</div>}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-600">Context queries</div>
                      <div className="flex flex-wrap gap-1">
                        {mission.contextQueries.slice(0, 18).map(term => <Badge key={term} variant="default" className="text-[10px]">{term}</Badge>)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Copy className="h-3.5 w-3.5 text-zinc-500" />
                      <div className="text-xs font-semibold text-zinc-300">Copy for external CLIs</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void copyProviderPrompt('claude')}>
                        Claude prompt
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void copyProviderPrompt('codex')}>
                        Codex prompt
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void copyProviderPrompt('gemini')}>
                        Gemini prompt
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void copyProviderPrompt('hermes')}>
                        Hermes prompt
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void copyProviderPrompt('fcc')}>
                        FCC prompt
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void copyProviderPrompt('devin')}>
                        Devin prompt
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void copyProviderPrompt('qwen')}>
                        Qwen prompt
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void copyProviderPrompt('hyperframes')}>
                        Hyperframes setup
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void copyProviderPrompt('remotion')}>
                        Remotion setup
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void copyProviderPrompt('generic')}>
                        Generic prompt
                      </Button>
                    </div>
                    <p className="mt-2 text-[11px] text-zinc-600">
                      These prompts include BertOS safety rules, likely files, validation commands, and done-when checks. Devin, Hermes, FCC, Qwen, Hyperframes, Remotion, and planned agents are copy-only unless a verified backend exists.
                    </p>
                  </div>
                  <details className="mt-4 rounded-lg border border-zinc-800 bg-black/30 p-3">
                    <summary className="cursor-pointer text-xs font-semibold text-zinc-300">Output panel: compiled mission prompt</summary>
                    <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-relaxed text-zinc-500">
                      {mission.suggestedPrompt}
                    </pre>
                  </details>
                </section>
              )}

              <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-zinc-100">Provider logs</h3>
                </div>
                <div className="max-h-48 overflow-auto rounded-lg border border-zinc-800 bg-black/40 p-3 font-mono text-[11px] text-zinc-500">
                  {runLog.length ? runLog.map(line => <div key={line}>{line}</div>) : <div>No mission activity yet.</div>}
                </div>
              </section>
            </div>
          </ScrollArea>
        </section>

        <aside className="min-h-0 overflow-hidden bg-zinc-950/60">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-sky-400" />
                    <h3 className="text-sm font-semibold text-zinc-100">Repo status</h3>
                  </div>
                  <Badge variant="success" className="text-[9px]">Self-Build</Badge>
                </div>
                <div className="space-y-1 text-xs text-zinc-500">
                  <div>Branch: <span className="font-mono text-zinc-300">{directRepo?.branch ?? repoStatus?.repo?.branch ?? 'unknown'}</span></div>
                  <div className="flex items-center gap-1">
                    State:{' '}
                    {directRepo?.dirty
                      ? <span className="text-amber-300">{directRepo.changedFiles} file(s) modified</span>
                      : directRepo?.ok
                        ? <span className="text-emerald-300">clean</span>
                        : <span className="text-zinc-400">checking…</span>
                    }
                  </div>
                  <div className="truncate font-mono">Last: <span className="text-zinc-300">{directRepo?.lastCommit ?? 'unknown'}</span></div>
                  {directRepo?.diffStat && directRepo.diffStat !== 'clean' && directRepo.diffStat !== 'unavailable' && (
                    <div className="text-zinc-600">{directRepo.diffStat}</div>
                  )}
                  {repoStatus?.repo && (
                    <>
                      <div className="mt-1 border-t border-zinc-800 pt-1">Remote: <span className="break-all text-zinc-400">{repoStatus.repo.remote}</span></div>
                      <div>Root: <span className="break-all text-zinc-400">{repoStatus.repo.root}</span></div>
                      {repoStatus.repo.blockedReason && <div className="text-red-300">{repoStatus.repo.blockedReason}</div>}
                    </>
                  )}
                  {!repoStatus?.repo && !directRepo?.ok && (
                    <div className="mt-1 text-zinc-600">Start <span className="font-mono">npm run bertos:daemon</span> for full repo bridge.</div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100">Patch proposal</h3>
                  {proposal && <Badge variant={badgeForRisk(proposal.riskLevel)} className="text-[10px]">{proposal.riskLevel}</Badge>}
                </div>
                {!patchResponse && <p className="text-xs text-zinc-600">Run a mission to generate a reviewable patch.</p>}
                {patchResponse?.error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    {patchResponse.error}
                    {patchResponse.debug?.parseError && <div className="mt-1 opacity-80">{patchResponse.debug.parseError}</div>}
                  </div>
                )}
                {proposal && (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed text-zinc-500">{proposal.summary}</p>
                    {patchResponse.provider && (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-[11px] text-zinc-500">
                        Provider: {patchResponse.provider.providerName ?? patchResponse.provider.providerId} · {patchResponse.provider.source ?? 'source'} · {patchResponse.provider.latencyMs ?? 0}ms
                      </div>
                    )}
                    {patchResponse.debug?.serialization && (
                      <details className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
                        <summary className="cursor-pointer text-[11px] text-zinc-400">Context payload debug</summary>
                        <div className="mt-2 space-y-1 text-[11px] text-zinc-500">
                          <div>Prompt chars: {patchResponse.debug.serialization.promptChars}</div>
                          <div>Included files: {patchResponse.debug.serialization.includedFileCount}</div>
                          <div>File bodies present: {patchResponse.debug.serialization.fileBodiesPresent ? 'yes' : 'no'}</div>
                          <div className="break-all">Paths: {patchResponse.debug.serialization.includedFilePaths.join(', ') || 'none'}</div>
                        </div>
                      </details>
                    )}
                    <div className="space-y-2">
                      {proposal.files.map(file => (
                        <label key={file.path} className="block rounded-lg border border-zinc-800 bg-zinc-900/30 p-2 text-xs">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedFiles.has(file.path)}
                              onChange={event => {
                                setSelectedFiles(current => {
                                  const next = new Set(current)
                                  if (event.target.checked) next.add(file.path)
                                  else next.delete(file.path)
                                  return next
                                })
                              }}
                            />
                            <span className="min-w-0 flex-1 truncate font-mono text-zinc-300">{file.path}</span>
                            <Badge variant={file.operation === 'delete' ? 'error' : file.operation === 'create' ? 'success' : 'default'} className="text-[10px]">
                              {operationLabel(file.operation)}
                            </Badge>
                          </div>
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-black/40 p-2 text-[10px] text-zinc-500">
                            {(file.after ?? file.before ?? '').slice(0, 3000) || '(delete)'}
                          </pre>
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void applySelectedPatch()} disabled={applyingPatch || !safe || selectedFiles.size === 0}>
                        {applyingPatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Apply selected
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void runChecks()} disabled={runningChecks || !safeValidationCommands.length || !safe}>
                        {runningChecks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        Run checks
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Clipboard className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-zinc-100">Validation checks</h3>
                </div>
                {safeValidationCommands.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {safeValidationCommands.map(command => <Badge key={command} variant="success" className="text-[10px]">{command}</Badge>)}
                  </div>
                ) : (
                  <p className="mb-3 text-xs text-zinc-600">No safe checks are available yet.</p>
                )}
                <div className="space-y-2">
                  {commandResults.map(item => (
                    <div key={item.command} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-zinc-300">{item.command}</span>
                        <Badge variant={(item.result.exitCode ?? 0) === 0 && item.result.ok !== false ? 'success' : 'error'} className="text-[10px]">
                          exit {item.result.exitCode ?? (item.result.ok === false ? 1 : 0)}
                        </Badge>
                      </div>
                      {(item.result.stdout || item.result.stderr || item.result.error) && (
                        <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-[10px] text-zinc-500">
                          {item.result.error ?? item.result.stderr ?? item.result.stdout}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {directCheckResults && (
                <section className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-zinc-100">Direct check results</h3>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(directCheckResults).map(([name, result]) => (
                      <div key={name} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-zinc-300">{name}</span>
                          <Badge variant={result.ok ? 'success' : 'error'} className="text-[9px]">
                            {result.ok ? 'passed' : `exit ${result.exitCode}`}
                          </Badge>
                        </div>
                        {result.output && (
                          <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-[10px] text-zinc-500">
                            {result.output}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {mission?.worktreeRecommended && (
                <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-100">
                  <div className="mb-1 flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    Worktree recommended
                  </div>
                  <p>Worktree execution is scaffolded in BertOS but not automatically enabled here. Use this mission as a plan first, then run implementation in an isolated worktree when available.</p>
                </section>
              )}
            </div>
          </ScrollArea>
        </aside>
      </main>
    </div>
  )
}
