'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gauge,
  Loader2,
  MessageSquare,
  RefreshCw,
  Router,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { fetchLocalDaemonBridge } from '@/lib/bertos/browser-daemon'
import {
  fetchBrowserAwareProviderStatus,
  type BrowserAwareProviderStatusResponse,
} from '@/lib/bertos/provider-status-client'
import {
  cleanCliAssistantText,
  compactAssistantText,
} from '@/lib/bertos/cli-output'
import type { AgentEngine } from '@/lib/bertos/agent-engines'
import type { LocalDaemonAskResult } from '@/lib/bertos/local-daemon'
import { cn } from '@/lib/bertos/cn'

const CONTROL_URL_STORAGE_KEY = 'bertos-openclaw-control-url'
const DEFAULT_CONTROL_URL = 'http://127.0.0.1:18789'
const OPENCLAW_COMPACTION_RESERVE_COMMAND =
  'openclaw config set agents.defaults.compaction.reserveTokensFloor 20000 --strict-json'

const OPENCLAW_ROUTES = [
  {
    id: 'chat',
    label: 'Chat',
    path: '/chat?session=agent%3Amain%3Amain',
    icon: MessageSquare,
  },
  { id: 'overview', label: 'Overview', path: '/overview', icon: Gauge },
  { id: 'sessions', label: 'Sessions', path: '/sessions', icon: Activity },
  { id: 'skills', label: 'Skills', path: '/skills', icon: Sparkles },
  { id: 'nodes', label: 'Nodes', path: '/nodes', icon: Router },
  { id: 'config', label: 'Config', path: '/config', icon: ShieldCheck },
]

const strengths = [
  'Self-hosted gateway that can bridge Telegram, Discord, Slack, iMessage, WhatsApp, WebChat, and plugin channels.',
  'Agent-native runtime for sessions, tools, memory, skills, multi-agent routing, and recurring jobs.',
  'Local-first model path through Ollama, with optional paid or cloud providers only when you choose them.',
  'Control UI exposes chat, sessions, channels, skills, nodes, cron jobs, logs, config, health, and update controls.',
]

const limits = [
  'It is a privileged local agent runtime, so tool access, channel access, and shell access need strict approval gates.',
  'Phone and remote access do not work through plain localhost; use a secured tunnel or Tailscale-style HTTPS setup.',
  'Small local models can run out of context quickly. The BertOS bridge should use a larger-context OpenClaw model for serious handoffs.',
  'Long OpenClaw sessions can fail auto-compaction recovery when reserve token headroom is too low.',
  'Third-party skills and hooks should be installed slowly. Each one expands the agent authority surface.',
  'The OpenClaw web UI owns its gateway token. BertOS should link or embed it, not copy tokens into app state.',
]

const nextSteps = [
  'Verify the BertOS daemon was restarted after installing OpenClaw.',
  'Keep OpenClaw Gateway bound to 127.0.0.1 unless a secured remote access layer is configured.',
  'Set a Telegram allowlist before treating the bot as private.',
  'If OpenClaw shows auto-compaction recovery errors, raise agents.defaults.compaction.reserveTokensFloor to 20000 or higher.',
  'Move OpenClaw from codegemma:7b to a larger-context model before routing long BertOS missions through it.',
  'Run an OpenClaw bridge test from BertOS before giving it real work.',
]

function trimBaseUrl(value: string) {
  return (value || DEFAULT_CONTROL_URL).trim().replace(/\/+$/, '')
}

function joinControlUrl(baseUrl: string, path: string) {
  return `${trimBaseUrl(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`
}

function StatusPill({
  online,
  unknown,
  label,
}: {
  online?: boolean
  unknown?: boolean
  label: string
}) {
  if (unknown) {
    return (
      <Badge variant="warning">
        <Activity className="h-3 w-3" />
        {label}: unknown
      </Badge>
    )
  }
  return online ? (
    <Badge variant="success">
      <CheckCircle2 className="h-3 w-3" />
      {label}: online
    </Badge>
  ) : (
    <Badge variant="error">
      <XCircle className="h-3 w-3" />
      {label}: offline
    </Badge>
  )
}

function InfoPanel({
  title,
  icon,
  tone = 'neutral',
  children,
}: {
  title: string
  icon: React.ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  children: ReactNode
}) {
  const tones = {
    neutral: 'border-white/10 bg-black/35',
    success: 'border-emerald-400/20 bg-emerald-500/[0.08]',
    warning: 'border-amber-400/25 bg-amber-500/10',
    danger: 'border-red-400/25 bg-red-500/10',
  }
  return (
    <section className={cn('rounded-lg border p-4', tones[tone])}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-100">
        {icon}
        {title}
      </div>
      {children}
    </section>
  )
}

export function OpenClawControlView({ engine }: { engine: AgentEngine }) {
  const [status, setStatus] =
    useState<BrowserAwareProviderStatusResponse | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [controlUrl, setControlUrl] = useState(DEFAULT_CONTROL_URL)
  const [controlUrlDraft, setControlUrlDraft] = useState(DEFAULT_CONTROL_URL)
  const [activeRoute, setActiveRoute] = useState(OPENCLAW_ROUTES[0].id)
  const [frameKey, setFrameKey] = useState(0)
  const [frameLoaded, setFrameLoaded] = useState(false)
  const [testRunning, setTestRunning] = useState(false)
  const [testOutput, setTestOutput] = useState('')
  const provider = status?.providers?.find((item) => item.id === 'openclaw-cli')
  const daemon = status?.localDaemon
  const gateway = daemon?.openClawGateway
  const route =
    OPENCLAW_ROUTES.find((item) => item.id === activeRoute) ??
    OPENCLAW_ROUTES[0]
  const iframeUrl = useMemo(
    () => joinControlUrl(controlUrl, route.path),
    [controlUrl, route.path],
  )
  const daemonOnline = Boolean(daemon?.online)
  const cliInstalled = Boolean(
    daemon?.tools?.find((tool) => tool.id === 'openclaw-cli')?.installed,
  )
  const cliVerified = provider?.status === 'online'
  const gatewayOnline = gateway?.online
  const frameBlocked = gateway?.frameEmbedding === 'blocked'

  useEffect(() => {
    const stored =
      window.localStorage.getItem(CONTROL_URL_STORAGE_KEY) ||
      DEFAULT_CONTROL_URL
    setControlUrl(trimBaseUrl(stored))
    setControlUrlDraft(trimBaseUrl(stored))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      setLoadingStatus(true)
      try {
        const next = await fetchBrowserAwareProviderStatus()
        if (!cancelled) setStatus(next)
      } catch {
        if (!cancelled) setStatus(null)
      } finally {
        if (!cancelled) setLoadingStatus(false)
      }
    }

    void refresh()
    const interval = window.setInterval(refresh, 20000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  const saveControlUrl = () => {
    const next = trimBaseUrl(controlUrlDraft)
    setControlUrl(next)
    window.localStorage.setItem(CONTROL_URL_STORAGE_KEY, next)
    setFrameLoaded(false)
    setFrameKey((key) => key + 1)
    toast.success('OpenClaw Control URL saved for this browser.')
  }

  const copyCommand = async (command: string) => {
    await navigator.clipboard.writeText(command)
    toast.success('Command copied.')
  }

  const runBridgeTest = async () => {
    setTestRunning(true)
    setTestOutput('')
    try {
      const prompt = [
        'You are OpenClaw inside BertOS.',
        'Reply in one short paragraph.',
        'Confirm whether the BertOS to OpenClaw bridge is working and mention the configured local model if you can see it.',
      ].join('\n')
      const res = await fetchLocalDaemonBridge('/api/local-daemon/ask', {
        method: 'POST',
        body: JSON.stringify({
          providerId: 'openclaw-cli',
          prompt,
          timeoutMs: 180000,
        }),
      })
      const result = (await res.json()) as LocalDaemonAskResult
      if (!res.ok || !result.ok) {
        const detail = [
          cleanCliAssistantText(result.stdout ?? ''),
          cleanCliAssistantText(result.stderr ?? ''),
          result.error,
        ]
          .filter(Boolean)
          .join('\n\n')
        throw new Error(
          detail || `OpenClaw bridge returned HTTP ${res.status}.`,
        )
      }
      const output = compactAssistantText(
        result.stdout || result.stderr || 'OpenClaw returned no visible text.',
      )
      setTestOutput(output)
      const refreshed = await fetchBrowserAwareProviderStatus()
      setStatus(refreshed)
      toast.success('OpenClaw bridge responded.')
    } catch (error) {
      setTestOutput(
        error instanceof Error ? error.message : 'OpenClaw bridge test failed.',
      )
      toast.error('OpenClaw bridge test failed.')
    } finally {
      setTestRunning(false)
    }
  }

  return (
    <div className="min-h-full bg-[#07090d] text-zinc-100">
      <section className="border-b border-white/10 bg-[linear-gradient(140deg,rgba(239,68,68,0.18),rgba(8,12,18,0.96)_45%,rgba(212,180,131,0.12))] px-4 py-5 md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant="error">
                  <Bot className="h-3 w-3" />
                  OpenClaw OS bridge
                </Badge>
                <StatusPill online={daemonOnline} label="BertOS daemon" />
                <StatusPill
                  online={gatewayOnline}
                  unknown={!gateway}
                  label="Gateway"
                />
                <StatusPill online={cliVerified} label="CLI verified" />
              </div>
              <h1 className="text-2xl font-semibold tracking-normal text-white md:text-3xl">
                OpenClaw inside BertOS
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
                This view makes OpenClaw a first-class BertOS engine: local
                gateway status, Control UI launch routes, bridge testing, and
                the safety map for using it as an always-on personal agent.
              </p>
            </div>
            <div className="grid gap-2 rounded-lg border border-white/10 bg-black/35 p-3 text-xs text-zinc-300 sm:min-w-72">
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">Engine</span>
                <span className="font-medium text-zinc-100">
                  {engine.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">BertOS provider</span>
                <span className="font-medium text-zinc-100">
                  {provider?.status ?? 'checking'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">Control URL</span>
                <span className="max-w-44 truncate font-medium text-zinc-100">
                  {controlUrl}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">Token handling</span>
                <span className="font-medium text-emerald-300">
                  OpenClaw-owned
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_0.9fr]">
            <InfoPanel
              title="Control UI Routes"
              icon={<Router className="h-4 w-4 text-red-300" />}
            >
              <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={controlUrlDraft}
                  onChange={(event) => setControlUrlDraft(event.target.value)}
                  className="min-h-10 flex-1 rounded-lg border border-white/10 bg-black/45 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                  placeholder="http://127.0.0.1:18789"
                />
                <Button variant="outline" onClick={saveControlUrl}>
                  <RefreshCw className="h-4 w-4" />
                  Save URL
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {OPENCLAW_ROUTES.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveRoute(item.id)
                        setFrameLoaded(false)
                      }}
                      className={cn(
                        'inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs transition',
                        activeRoute === item.id
                          ? 'border-red-400/40 bg-red-500/15 text-red-100'
                          : 'border-white/10 bg-black/35 text-zinc-400 hover:text-zinc-100',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </button>
                  )
                })}
              </div>
              {frameBlocked && (
                <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                  OpenClaw is reachable, but its Control UI blocks iframe
                  embedding. BertOS will launch the selected route in a tab
                  instead of stripping OpenClaw safety headers.
                </div>
              )}
            </InfoPanel>

            <InfoPanel
              title="BertOS Bridge Test"
              icon={<Terminal className="h-4 w-4 text-amber-300" />}
            >
              <p className="text-sm leading-6 text-zinc-300">
                This tests BertOS → local daemon → OpenClaw CLI in the dedicated
                OpenClaw session key{' '}
                <span className="font-mono text-zinc-100">bertos</span>. It does
                not use the gateway token and it does not call paid APIs from
                BertOS.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={() => void runBridgeTest()}
                  disabled={testRunning || !daemonOnline || !cliInstalled}
                >
                  {testRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4" />
                  )}
                  Test OpenClaw
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    void copyCommand(
                      'cd ~/Documents/BertOS\nlsof -tiTCP:8787 -sTCP:LISTEN | xargs kill\nnpm run bertos:daemon',
                    )
                  }
                >
                  <Copy className="h-4 w-4" />
                  Restart daemon command
                </Button>
              </div>
              {testOutput && (
                <pre className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/50 p-3 text-xs leading-5 text-zinc-200">
                  {testOutput}
                </pre>
              )}
            </InfoPanel>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-5 md:px-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 rounded-lg border border-white/10 bg-black/35">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-3">
            <div>
              <div className="text-sm font-semibold text-zinc-100">
                {frameBlocked
                  ? 'OpenClaw Control Launcher'
                  : 'Embedded OpenClaw Control'}
              </div>
              <div className="text-xs text-zinc-500">{iframeUrl}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFrameLoaded(false)
                  setFrameKey((key) => key + 1)
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reload
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={iframeUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open tab
                </a>
              </Button>
            </div>
          </div>
          {frameBlocked ? (
            <div className="grid min-h-[520px] place-items-center rounded-b-lg bg-[#0b0f14] p-6">
              <div className="max-w-xl rounded-lg border border-amber-400/25 bg-amber-500/10 p-5 text-center">
                <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-amber-200" />
                <h2 className="text-lg font-semibold text-zinc-100">
                  OpenClaw Protects Its Control UI
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  The gateway is online, but OpenClaw sends frame-blocking
                  headers. That is the right default for a local agent that can
                  access tools, channels, sessions, and commands.
                </p>
                {gateway?.frameBlockers?.length ? (
                  <ul className="mt-4 space-y-2 text-left text-xs leading-5 text-amber-100">
                    {gateway.frameBlockers.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button asChild>
                    <a href={iframeUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Open selected route
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void copyCommand('openclaw dashboard --no-open')
                    }
                  >
                    <Copy className="h-4 w-4" />
                    Copy dashboard command
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative h-[68vh] min-h-[520px] overflow-hidden rounded-b-lg bg-[#0b0f14]">
              {!frameLoaded && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0b0f14] text-sm text-zinc-400">
                  <Loader2 className="h-5 w-5 animate-spin text-red-300" />
                  Loading local OpenClaw Control UI
                </div>
              )}
              <iframe
                key={frameKey}
                src={iframeUrl}
                title="OpenClaw Control UI"
                className="h-full w-full border-0"
                onLoad={() => setFrameLoaded(true)}
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="border-t border-white/10 p-3 text-xs leading-5 text-zinc-500">
            BertOS does not store the OpenClaw gateway token. If OpenClaw asks
            for auth, enter it directly in OpenClaw Control.
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <InfoPanel
            title="What OpenClaw Adds"
            icon={<Sparkles className="h-4 w-4 text-emerald-300" />}
            tone="success"
          >
            <ul className="space-y-2 text-sm leading-5 text-zinc-300">
              {strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </InfoPanel>

          <InfoPanel
            title="Where It Gets Risky"
            icon={<ShieldAlert className="h-4 w-4 text-amber-300" />}
            tone="warning"
          >
            <ul className="space-y-2 text-sm leading-5 text-zinc-300">
              {limits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </InfoPanel>

          <InfoPanel
            title="Publishable BertOS Path"
            icon={<ShieldCheck className="h-4 w-4 text-blue-300" />}
            tone="neutral"
          >
            <ul className="space-y-2 text-sm leading-5 text-zinc-300">
              {nextSteps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </InfoPanel>

          <InfoPanel
            title="Useful Commands"
            icon={<Terminal className="h-4 w-4 text-zinc-300" />}
          >
            <div className="space-y-2">
              {[
                ['Dashboard', 'openclaw dashboard --no-open'],
                ['Security audit', 'openclaw security audit --deep'],
                [
                  'Compaction reserve',
                  OPENCLAW_COMPACTION_RESERVE_COMMAND,
                ],
                ['Gateway logs', 'tail -f ~/Library/Logs/openclaw/gateway.log'],
              ].map(([label, command]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => void copyCommand(command)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-left text-xs text-zinc-300 hover:border-white/20 hover:text-zinc-100"
                >
                  <span>{label}</span>
                  <Copy className="h-3.5 w-3.5 shrink-0" />
                </button>
              ))}
            </div>
          </InfoPanel>

          {loadingStatus && (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/35 p-3 text-xs text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing local status...
            </div>
          )}
        </aside>
      </section>
    </div>
  )
}
