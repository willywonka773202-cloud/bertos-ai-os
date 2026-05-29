'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Key, Globe, Zap, Sparkles, Monitor, Database,
  Shield, Sliders, Check, Eye, EyeOff, Bot, Server, Cpu, Terminal,
  RefreshCw, Wifi, WifiOff
} from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'
import { DEFAULT_BROWSER_DAEMON_URL, fetchBrowserDaemonStatus, fetchLocalDaemonBridge } from '@/lib/bertos/browser-daemon'
import type { LocalDaemonAskResult } from '@/lib/bertos/local-daemon'

interface OllamaStatus {
  online: boolean
  mode: 'local' | 'cloud'
  provider: string
  baseUrl: string
  chatUrl: string
  defaultModel: string
  models: Array<{ name: string; type?: string; recommended?: boolean }>
  error?: string
  testResult?: { success: boolean; error?: string }
}

interface LocalCliToolStatus {
  id: 'claude-code' | 'codex-cli' | 'gemini-cli' | 'openclaw-cli'
  label: string
  executable: 'claude' | 'codex' | 'gemini' | 'openclaw'
  installed: boolean
  version?: string
  loginStatus: 'available' | 'missing' | 'error' | 'unknown'
  error?: string
}

interface LocalDaemonStatus {
  online: boolean
  available: boolean
  host: string
  port: number
  tools: LocalCliToolStatus[]
  error?: string
  startCommand: string
}

interface ComposioStatus {
  configured: boolean
  reachable: boolean
  baseUrl: string
  error?: string
}

interface GeminiNativeStatus {
  available: boolean
  hasApiKey: boolean
  serverGateEnabled?: boolean
  models: string[]
  capabilities: string[]
  error?: string
}

interface TelegramBotStatus {
  configured: boolean
  chatEnabled: boolean
  ollamaModel: string
  webhookSecretConfigured?: boolean
  error?: string
}

interface HermesNousStatus {
  configured: boolean
  proxyReachable?: boolean
  enabled?: boolean
  endpointConfigured?: boolean
  apiKeyConfigured?: boolean
  mode?: string
  paidEnabled: boolean
  availableForRouting: boolean
  billing: string
  statusMessage: string
  defaultProvider: boolean
  autoRoutingDisabledUnless: string
  error?: string
}

const SECTIONS = [
  { id: 'providers', icon: Bot,      label: 'Providers'   },
  { id: 'api-keys',  icon: Key,      label: 'API Keys'    },
  { id: 'appearance',icon: Monitor,  label: 'Appearance'  },
  { id: 'memory',    icon: Database, label: 'Memory'      },
  { id: 'performance',icon: Sliders, label: 'Performance' },
  { id: 'security',  icon: Shield,   label: 'Security'    },
  { id: 'integrations', icon: Wifi,  label: 'Integrations' },
]

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        'relative w-9 h-5 rounded-full transition-all duration-200',
        value ? 'bg-[rgba(212,180,131,0.72)] shadow-[0_0_18px_rgba(212,180,131,0.18)]' : 'bg-[rgba(60,48,32,0.85)]'
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-4 h-4 rounded-full bg-[#F0E8D0] shadow transition-all duration-200',
        value ? 'left-4' : 'left-0.5'
      )} />
    </button>
  )
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[rgba(212,180,131,0.16)] bg-[rgba(10,8,5,0.72)] px-3 py-2 transition-colors focus-within:border-[rgba(212,180,131,0.38)]">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-[#F0E8D0] placeholder:text-[#5A4A2A] outline-none font-mono"
      />
      <button onClick={() => setShow(!show)} className="text-[#5A4A2A] hover:text-[#D4B483] transition-colors">
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

function cliToolStatusLabel(tool: LocalCliToolStatus) {
  if (!tool.installed) return 'Missing'
  if (tool.loginStatus === 'available') return 'Available'
  if (tool.loginStatus === 'error') return 'Auth/error'
  return 'Needs test'
}

function cliToolStatusVariant(tool: LocalCliToolStatus) {
  if (!tool.installed) return 'default'
  if (tool.loginStatus === 'available') return 'success'
  if (tool.loginStatus === 'error') return 'error'
  return 'warning'
}

export function SettingsView() {
  const { settings, updateSettings } = useUIStore()
  const [activeSection, setActiveSection] = useState('providers')
  const [saved, setSaved] = useState(false)
  const [anthropicKey, setAnthropicKey] = useState((settings.apiKeys ?? {}).anthropic ?? '')
  const [openaiKey, setOpenaiKey] = useState((settings.apiKeys ?? {}).openai ?? '')
  const [googleKey, setGoogleKey] = useState((settings.apiKeys ?? {}).google ?? '')
  const [ollamaCloudKey, setOllamaCloudKey] = useState((settings.apiKeys ?? {}).ollamaCloud ?? '')
  const [ollamaEndpoint, setOllamaEndpoint] = useState(settings.ollamaEndpoint ?? '')
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [localDaemonStatus, setLocalDaemonStatus] = useState<LocalDaemonStatus | null>(null)
  const [composioStatus, setComposioStatus] = useState<ComposioStatus | null>(null)
  const [geminiNativeStatus, setGeminiNativeStatus] = useState<GeminiNativeStatus | null>(null)
  const [hermesNousStatus, setHermesNousStatus] = useState<HermesNousStatus | null>(null)
  const [telegramStatus, setTelegramStatus] = useState<TelegramBotStatus | null>(null)
  const [hermesTestMessage, setHermesTestMessage] = useState<string | null>(null)
  const [hermesTesting, setHermesTesting] = useState(false)
  const [daemonUrl, setDaemonUrl] = useState(() => typeof window !== 'undefined' ? window.localStorage.getItem('bertos-daemon-url') || DEFAULT_BROWSER_DAEMON_URL : DEFAULT_BROWSER_DAEMON_URL)
  const [daemonToken, setDaemonToken] = useState(() => typeof window !== 'undefined' ? window.localStorage.getItem('bertos-daemon-token') || '' : '')
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [daemonLoading, setDaemonLoading] = useState(false)
  const [testingCloud, setTestingCloud] = useState(false)
  const [testingCliTool, setTestingCliTool] = useState<LocalCliToolStatus['id'] | null>(null)
  const [cliToolMessages, setCliToolMessages] = useState<Record<string, string>>({})

  const fetchOllamaStatus = async (testCloud = false) => {
    setOllamaLoading(true)
    if (testCloud) setTestingCloud(true)
    try {
      const res = await fetch('/api/ollama/status', {
        method: testCloud || ollamaCloudKey ? 'POST' : 'GET',
        headers: testCloud || ollamaCloudKey ? { 'Content-Type': 'application/json' } : undefined,
        body: testCloud || ollamaCloudKey ? JSON.stringify({ testCloud, key: ollamaCloudKey || undefined }) : undefined,
        cache: 'no-store',
      })
      const data = await res.json() as OllamaStatus
      setOllamaStatus(data)
    } catch {
      setOllamaStatus(null)
    } finally {
      setOllamaLoading(false)
      setTestingCloud(false)
    }
  }

  const fetchLocalDaemonStatus = async () => {
    setDaemonLoading(true)
    try {
      const browserDaemon = await fetchBrowserDaemonStatus()
      if (browserDaemon?.online) {
        setLocalDaemonStatus(browserDaemon)
        return
      }
      const res = await fetchLocalDaemonBridge('/api/local-daemon/status', { cache: 'no-store' })
      const data = await res.json() as LocalDaemonStatus
      setLocalDaemonStatus(data)
    } catch {
      setLocalDaemonStatus(null)
    } finally {
      setDaemonLoading(false)
    }
  }

  const saveDaemonBridgeSettings = async () => {
    if (typeof window !== 'undefined') {
      const normalizedUrl = daemonUrl.trim().replace(/\/+$/, '') || DEFAULT_BROWSER_DAEMON_URL
      window.localStorage.setItem('bertos-daemon-url', normalizedUrl)
      if (daemonToken.trim()) window.localStorage.setItem('bertos-daemon-token', daemonToken.trim())
      else window.localStorage.removeItem('bertos-daemon-token')
      setDaemonUrl(normalizedUrl)
    }
    await fetchLocalDaemonStatus()
  }

  const testCliTool = async (tool: LocalCliToolStatus) => {
    if (!tool.installed) return
    setTestingCliTool(tool.id)
    setCliToolMessages(messages => ({ ...messages, [tool.id]: 'Running live verification prompt...' }))
    try {
      const res = await fetchLocalDaemonBridge('/api/local-daemon/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: tool.id,
          prompt: `Reply with exactly: BERTOS_${tool.id}_OK`,
          timeoutMs: 120000,
        }),
      })
      const result = await res.json() as LocalDaemonAskResult
      const detail = [result.stdout?.trim(), result.stderr?.trim(), result.error].filter(Boolean).join('\n\n')
      setCliToolMessages(messages => ({
        ...messages,
        [tool.id]: res.ok && result.ok
          ? `Verified: ${(result.stdout || '').trim().slice(0, 120) || tool.label}`
          : `Blocked: ${detail || `HTTP ${res.status}`}`,
      }))
      await fetchLocalDaemonStatus()
    } catch (error) {
      setCliToolMessages(messages => ({
        ...messages,
        [tool.id]: `Test failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      }))
    } finally {
      setTestingCliTool(null)
    }
  }

  const fetchComposioStatus = async () => {
    try {
      const res = await fetch('/api/tools/composio/status', { cache: 'no-store' })
      setComposioStatus(await res.json() as ComposioStatus)
    } catch {
      setComposioStatus({
        configured: false,
        reachable: false,
        baseUrl: 'https://backend.composio.dev/api/v1',
        error: 'Could not check Composio status.',
      })
    }
  }

  const fetchGeminiNativeStatus = async () => {
    try {
      const res = await fetch('/api/providers/gemini-native', { cache: 'no-store' })
      setGeminiNativeStatus(await res.json() as GeminiNativeStatus)
    } catch {
      setGeminiNativeStatus({
        available: false,
        hasApiKey: false,
        models: [],
        capabilities: [],
        error: 'Could not check Gemini Native API status.',
      })
    }
  }

  const fetchTelegramStatus = async () => {
    setTelegramLoading(true)
    try {
      const res = await fetch('/api/telegram/webhook', { cache: 'no-store' })
      setTelegramStatus(await res.json() as TelegramBotStatus)
    } catch {
      setTelegramStatus({ configured: false, chatEnabled: false, ollamaModel: 'llama3', error: 'Could not check Telegram status.' })
    } finally {
      setTelegramLoading(false)
    }
  }

  const fetchProviderStatus = async () => {
    try {
      const res = await fetch('/api/providers/status', { cache: 'no-store' })
      const data = await res.json() as { hermesNous?: HermesNousStatus }
      setHermesNousStatus(data.hermesNous ?? null)
    } catch {
      setHermesNousStatus({
        configured: false,
        proxyReachable: false,
        enabled: false,
        endpointConfigured: false,
        apiKeyConfigured: false,
        mode: 'free/local or custom endpoint',
        paidEnabled: false,
        availableForRouting: false,
        billing: 'No paid API key required by BertOS',
        statusMessage: 'Hermes is not connected yet.',
        defaultProvider: false,
        autoRoutingDisabledUnless: 'manual Hermes route or explicit engine selection',
        error: 'Could not check Hermes status.',
      })
    }
  }

  const sendHermesTestMessage = async () => {
    setHermesTesting(true)
    setHermesTestMessage(null)
    try {
      const res = await fetch('/api/hermes/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Say hello from Hermes and confirm Bert OS integration is working.' }),
      })
      const data = await res.json() as { ok?: boolean; text?: string; error?: string }
      setHermesTestMessage(data.ok ? `Hermes is connected and responding. ${data.text ?? ''}` : data.error ?? 'Hermes test failed.')
    } catch (error) {
      setHermesTestMessage(error instanceof Error ? error.message : 'Hermes test failed.')
    } finally {
      setHermesTesting(false)
    }
  }

  useEffect(() => {
    if (activeSection === 'providers') {
      fetchOllamaStatus()
      fetchLocalDaemonStatus()
      fetchComposioStatus()
      fetchGeminiNativeStatus()
      fetchProviderStatus()
    }
    if (activeSection === 'integrations') {
      fetchTelegramStatus()
      fetchProviderStatus()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection])

  const saveSettings = () => {
    updateSettings({
      apiKeys: {
        anthropic: anthropicKey,
        openai: openaiKey,
        google: googleKey,
        ollamaCloud: ollamaCloudKey,
      },
      ollamaEndpoint: ollamaEndpoint.trim() || undefined,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Section nav */}
      <div className="min-h-0 w-48 flex-shrink-0 overflow-y-auto border-r border-zinc-800/50 p-3">
        <div className="space-y-0.5">
          <p className="px-2 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Settings</p>
          {SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150',
                activeSection === section.id
                  ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
              )}
            >
              <section.icon className={cn('w-3.5 h-3.5', activeSection === section.id && 'text-violet-400')} />
              <span className="text-xs font-medium">{section.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Settings content */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
          <RouteHero
            eyebrow="systems sanctum"
            title="Settings"
            subtitle="Provider gates, local daemon configuration, API-key separation, and honest experimental states. Paid services stay disabled unless explicitly configured."
            status={saved ? 'nominal' : 'idle'}
            seal={<Settings className="h-5 w-5" />}
            metrics={[
              { label: 'Active Section', value: SECTIONS.find(section => section.id === activeSection)?.label ?? activeSection, detail: 'configuration deck', tone: 'cyan' },
              { label: 'Subscription', value: 'local-first', detail: 'CLI/provider routes', tone: 'bronze' },
              { label: 'Paid APIs', value: 'gated', detail: 'keys never printed', tone: 'amber' },
              { label: 'Save State', value: saved ? 'saved' : 'ready', detail: 'local settings store', tone: saved ? 'emerald' : 'zinc' },
            ]}
          />

          <ChamberCard
            tone="bronze"
            eyebrow="configuration chamber"
            title="Guarded control plane"
            description="Subscription CLIs, local daemon status, optional paid APIs, and external integrations remain separated so BertOS never routes paid or experimental systems silently."
          />

          {/* ── Providers ─────────────────────────────────────────────────── */}
          {activeSection === 'providers' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Subscription Providers</h3>
                <p className="text-xs text-zinc-500">BertOS routes through providers you already subscribe to — no separate API billing required.</p>
              </div>

              {/* Always-on: Ollama Pro */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Always-On Default</h4>

                {/* Live Ollama status card */}
                <div className={cn(
                  'flex items-start gap-3 p-3.5 rounded-xl border',
                  ollamaStatus?.online
                    ? 'border-orange-500/20 bg-orange-500/5'
                    : ollamaStatus
                      ? 'border-red-500/20 bg-red-500/5'
                      : 'border-zinc-800 bg-zinc-900/30'
                )}>
                  <Bot className={cn('w-4 h-4 flex-shrink-0 mt-0.5', ollamaStatus?.online ? 'text-orange-400' : ollamaStatus ? 'text-red-400' : 'text-zinc-600')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-zinc-200">Ollama Pro</p>
                      <span className="text-[10px] text-zinc-600">
                        {ollamaStatus ? `${ollamaStatus.provider} · ${ollamaStatus.mode}` : 'Checking…'}
                      </span>
                    </div>
                    {ollamaStatus ? (
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {ollamaStatus.defaultModel} · No API billing ·{' '}
                        <code className="text-zinc-600 text-[10px]">{ollamaStatus.chatUrl}</code>
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-600 mt-0.5">Loading status…</p>
                    )}
                    {ollamaStatus?.mode === 'cloud' && (
                      <p className="text-[11px] text-zinc-600 mt-1">
                        Used for deployed BertOS on Vercel. Requires <code className="text-zinc-500">OLLAMA_API_KEY</code> in Vercel environment variables.
                      </p>
                    )}
                    {ollamaStatus?.mode === 'local' && (
                      <p className="text-[11px] text-zinc-600 mt-1">
                        Used for local development. Requires Ollama running on this computer (<code className="text-zinc-500">ollama serve</code>).
                      </p>
                    )}
                    {ollamaStatus?.error && (
                      <p className="text-[11px] text-red-400/80 mt-1">{ollamaStatus.error}</p>
                    )}
                    {ollamaStatus?.testResult && (
                      <p className={cn('text-[11px] mt-1', ollamaStatus.testResult.success ? 'text-emerald-400' : 'text-red-400')}>
                        {ollamaStatus.testResult.success
                          ? 'Connection test passed'
                          : `Connection test failed: ${ollamaStatus.testResult.error}`}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => fetchOllamaStatus(false)}
                        disabled={ollamaLoading}
                        className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={cn('w-3 h-3', ollamaLoading && !testingCloud && 'animate-spin')} />
                        Refresh
                      </button>
                      {ollamaStatus?.mode === 'cloud' && (
                        <button
                          onClick={() => fetchOllamaStatus(true)}
                          disabled={ollamaLoading}
                          className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50"
                        >
                          <Wifi className={cn('w-3 h-3', testingCloud && 'animate-pulse')} />
                          Test Connection
                        </button>
                      )}
                    </div>
                  </div>
                  {ollamaLoading && !testingCloud ? (
                    <RefreshCw className="w-3.5 h-3.5 text-zinc-600 animate-spin flex-shrink-0" />
                  ) : ollamaStatus?.online ? (
                    <Badge variant="success" className="text-[9px] h-4 flex-shrink-0">Connected</Badge>
                  ) : ollamaStatus ? (
                    <Badge variant="error" className="text-[9px] h-4 flex-shrink-0">Offline</Badge>
                  ) : (
                    <Badge variant="default" className="text-[9px] h-4 flex-shrink-0">Checking</Badge>
                  )}
                </div>

                {/* Ollama Cloud API key (shown in cloud mode or always as optional override) */}
                {ollamaStatus?.mode === 'cloud' || !ollamaStatus?.online ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-orange-400" />
                      <p className="text-sm font-medium text-zinc-300">Ollama Cloud API Key</p>
                      <Badge variant={ollamaCloudKey ? 'success' : 'warning'} className="text-[9px] h-4 ml-auto">
                        {ollamaCloudKey ? 'Set' : 'Required'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-relaxed">
                      Your Ollama API key from{' '}
                      <span className="text-zinc-500 font-mono">ollama.com/settings/api-keys</span>.
                      Saved locally in your browser — never sent to BertOS servers.
                      You can also set <code className="text-zinc-500">OLLAMA_API_KEY</code> in Vercel environment variables.
                    </p>
                    <SecretInput
                      value={ollamaCloudKey}
                      onChange={setOllamaCloudKey}
                      placeholder="ollama_..."
                    />
                    <Button onClick={saveSettings} size="sm" variant="outline" className="h-7 text-xs">
                      {saved ? <><Check className="w-3 h-3" /> Saved</> : 'Save Key'}
                    </Button>
                  </div>
                ) : null}

                {/* Ollama endpoint config (local mode only, or for override) */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-orange-400" />
                    <p className="text-sm font-medium text-zinc-300">Custom Ollama Endpoint</p>
                    <Badge variant={ollamaEndpoint ? 'success' : 'default'} className="text-[9px] h-4 ml-auto">
                      {ollamaEndpoint ? 'Custom' : 'Auto-detected'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    Override the Ollama endpoint. Leave blank to use auto-detection (cloud or local based on deployment mode).
                  </p>
                  <input
                    type="url"
                    value={ollamaEndpoint}
                    onChange={e => setOllamaEndpoint(e.target.value)}
                    placeholder="http://your-server:11434"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-zinc-700 font-mono"
                  />
                  {ollamaEndpoint && (
                    <button
                      onClick={() => setOllamaEndpoint('')}
                      className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      Clear — revert to auto-detected endpoint
                    </button>
                  )}
                </div>
              </div>

              {/* Local CLI bridge */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Local CLI Bridge</h4>
                <div className={cn(
                  'rounded-xl border p-4 space-y-3',
                  localDaemonStatus?.online
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-zinc-800 bg-zinc-900/30'
                )}>
                  <div className="flex items-start gap-3">
                    {localDaemonStatus?.online ? (
                      <Wifi className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-zinc-200">Local CLI Bridge</p>
                        <code className="text-[10px] text-zinc-600">
                          {localDaemonStatus ? `${localDaemonStatus.host}:${localDaemonStatus.port}` : 'checking'}
                        </code>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Runs Claude Code, Codex CLI, Gemini CLI, and safe local commands from your Mac or local terminal.
                      </p>
                      {!localDaemonStatus?.online && (
                        <p className="text-[11px] text-amber-300/80 mt-2">
                          Start it from this repo with <code className="text-amber-200">npm run bertos:daemon</code>. On the hosted domain, restart the daemon after updating so it allows the Vercel origin.
                        </p>
                      )}
                      {localDaemonStatus?.error && (
                        <p className="text-[11px] text-zinc-600 mt-1">{localDaemonStatus.error}</p>
                      )}
                    </div>
                    <Badge variant={localDaemonStatus?.online ? 'success' : 'warning'} className="text-[9px] h-4 flex-shrink-0">
                      {localDaemonStatus?.online ? 'Online' : 'Offline'}
                    </Badge>
                  </div>

                  <div className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Browser daemon URL</label>
                    <input
                      value={daemonUrl}
                      onChange={event => setDaemonUrl(event.target.value)}
                      placeholder={DEFAULT_BROWSER_DAEMON_URL}
                      className="h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-3 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-500/50"
                    />
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Daemon token</label>
                    <input
                      value={daemonToken}
                      onChange={event => setDaemonToken(event.target.value)}
                      placeholder="Optional for desktop, required for HTTPS tunnel mode"
                      type="password"
                      className="h-9 rounded-lg border border-zinc-800 bg-zinc-950 px-3 font-mono text-xs text-zinc-200 outline-none focus:border-emerald-500/50"
                    />
                    <p className="text-[10px] leading-relaxed text-zinc-600">
                      Desktop default: <code>{DEFAULT_BROWSER_DAEMON_URL}</code>. For phone access, run a secure HTTPS tunnel to the daemon, set <code>BERTOS_DAEMON_TOKEN</code> when starting it, then save the tunnel URL and token here.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => void saveDaemonBridgeSettings()} disabled={daemonLoading}>
                      <RefreshCw className={cn('w-3 h-3', daemonLoading && 'animate-spin')} />
                      Save Bridge Settings
                    </Button>
                  </div>

                  <div className="grid gap-2">
                    {(localDaemonStatus?.tools ?? []).map(tool => (
                      <div key={tool.id} className="rounded-lg bg-zinc-950/50 border border-zinc-800 px-2.5 py-2">
                        <div className="flex items-center gap-2">
                          {tool.id === 'claude-code' ? <Cpu className="w-3.5 h-3.5 text-violet-400" /> :
                           tool.id === 'codex-cli' ? <Zap className="w-3.5 h-3.5 text-emerald-400" /> :
                           tool.id === 'openclaw-cli' ? <Bot className="w-3.5 h-3.5 text-red-400" /> :
                           <Globe className="w-3.5 h-3.5 text-blue-400" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-zinc-300">{tool.label}</p>
                            <p className="text-[10px] text-zinc-600 truncate">
                              {tool.installed ? (tool.version || tool.error || `${tool.executable} detected`) : (tool.error || `${tool.executable} missing`)}
                            </p>
                          </div>
                          <Badge variant={cliToolStatusVariant(tool)} className="text-[9px] h-4">
                            {cliToolStatusLabel(tool)}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void testCliTool(tool)}
                            disabled={!tool.installed || testingCliTool === tool.id}
                            className="h-6 px-2 text-[10px]"
                          >
                            <RefreshCw className={cn('w-3 h-3', testingCliTool === tool.id && 'animate-spin')} />
                            Test
                          </Button>
                        </div>
                        {cliToolMessages[tool.id] && (
                          <p className={cn(
                            'mt-2 whitespace-pre-wrap break-words rounded border px-2 py-1.5 text-[10px] leading-relaxed',
                            cliToolMessages[tool.id].startsWith('Verified')
                              ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                              : cliToolMessages[tool.id].startsWith('Running')
                                ? 'border-blue-500/20 bg-blue-500/5 text-blue-300'
                                : 'border-amber-500/20 bg-amber-500/5 text-amber-300',
                          )}>
                            {cliToolMessages[tool.id]}
                          </p>
                        )}
                      </div>
                    ))}
                    {localDaemonStatus && localDaemonStatus.tools.length === 0 && (
                      <p className="text-[11px] text-zinc-600">No CLI tools reported yet. Start the daemon and refresh.</p>
                    )}
                  </div>

                  <button
                    onClick={fetchLocalDaemonStatus}
                    disabled={daemonLoading}
                    className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={cn('w-3 h-3', daemonLoading && 'animate-spin')} />
                    Refresh CLI Bridge
                  </button>
                </div>
              </div>

              {/* CLI subscription providers */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">CLI + Local Agent Providers</h4>
                <p className="text-[11px] text-zinc-600">These use local CLI tools, subscriptions, or Ollama-backed local agents. No paid API key is required by BertOS.</p>
                {([
                  {
                    id: 'claude-code', label: 'Claude Code', color: '#8B5CF6',
                    icon: <Cpu className="w-4 h-4 text-violet-400" />,
                    desc: 'Anthropic Pro subscription · Claude Code CLI',
                    install: 'npm install -g @anthropic-ai/claude-code',
                    login: 'claude login',
                  },
                  {
                    id: 'gemini-cli', label: 'Gemini CLI', color: '#3B82F6',
                    icon: <Globe className="w-4 h-4 text-blue-400" />,
                    desc: 'Google One AI Premium · Gemini CLI',
                    install: 'npm install -g @google/gemini-cli',
                    login: 'gemini auth login',
                  },
                  {
                    id: 'codex-cli', label: 'Codex CLI', color: '#10B981',
                    icon: <Zap className="w-4 h-4 text-emerald-400" />,
                    desc: 'ChatGPT Plus subscription · OpenAI Codex CLI',
                    install: 'npm install -g @openai/codex',
                    login: 'codex login',
                  },
                  {
                    id: 'openclaw-cli', label: 'OpenClaw', color: '#EF4444',
                    icon: <Bot className="w-4 h-4 text-red-400" />,
                    desc: 'Local/OpenClaw agent · Ollama launch or OpenClaw onboarding',
                    install: 'ollama launch openclaw --config',
                    login: 'npm install -g openclaw@latest && openclaw onboard --install-daemon',
                  },
                ]).map(p => (
                  <div key={p.id} className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/30 space-y-2">
                    <div className="flex items-center gap-3">
                      {p.icon}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-zinc-200">{p.label}</p>
                        <p className="text-xs text-zinc-500">{p.desc}</p>
                      </div>
                      <Badge variant="warning" className="text-[9px] h-4">CLI Only</Badge>
                    </div>
                    <div className="flex items-start gap-2 rounded-lg bg-zinc-950/60 p-2.5 border border-zinc-800">
                      <Terminal className="w-3 h-3 text-zinc-600 mt-0.5 flex-shrink-0" />
                      <div className="space-y-0.5">
                        <p className="text-[10px] text-zinc-600 font-mono">{p.install}</p>
                        <p className="text-[10px] text-zinc-600 font-mono">{p.login}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Routing options */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Routing Options</h4>
                {[
                  { key: 'routingEnabled',    label: 'Smart Routing',       desc: 'Auto-select the best provider for each task' },
                  { key: 'streamingEnabled',  label: 'Streaming Responses', desc: 'Show responses as they are generated' },
                  { key: 'memoryEnabled',     label: 'Project Memory',      desc: 'Include project context in conversations' },
                  { key: 'animationsEnabled', label: 'Animations',          desc: 'Enable smooth transitions and motion effects' },
                ].map(option => (
                  <div key={option.key} className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/30">
                    <div>
                      <p className="text-sm font-medium text-zinc-300">{option.label}</p>
                      <p className="text-xs text-zinc-600">{option.desc}</p>
                    </div>
                    <ToggleSwitch
                      value={settings[option.key as keyof typeof settings] as boolean}
                      onChange={v => updateSettings({ [option.key]: v })}
                    />
                  </div>
                ))}
              </div>

              {/* Tool integrations */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tool Integrations</h4>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-zinc-200">Composio</p>
                        <Badge
                          variant={composioStatus?.reachable ? 'success' : composioStatus?.configured ? 'warning' : 'default'}
                          className="text-[9px] h-4"
                        >
                          {composioStatus?.reachable ? 'Connected' : composioStatus?.configured ? 'Error' : 'Missing Key'}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Server-side tool connector for app actions. Requires <code className="text-zinc-500">COMPOSIO_API_KEY</code>.
                      </p>
                      {composioStatus?.error && (
                        <p className="text-[11px] text-amber-300/80 mt-1">{composioStatus.error}</p>
                      )}
                      <p className="text-[10px] text-zinc-700 mt-1 font-mono">{composioStatus?.baseUrl ?? 'https://backend.composio.dev/api/v1'}</p>
                    </div>
                  </div>
                  <button
                    onClick={fetchComposioStatus}
                    className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh Composio
                  </button>
                </div>

                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Bot className="w-4 h-4 text-violet-300 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-zinc-200">Hermes Agent Backend</p>
                        <Badge variant={hermesNousStatus?.availableForRouting ? 'success' : hermesNousStatus?.configured ? 'warning' : 'default'} className="text-[9px] h-4">
                          {hermesNousStatus?.availableForRouting ? 'Connected' : hermesNousStatus?.configured ? 'Configured' : 'Setup required'}
                        </Badge>
                        <Badge variant="success" className="text-[9px] h-4">No paid key required</Badge>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Server-side OpenAI-compatible Hermes gateway. Use Ollama/local models, a custom endpoint, or a free-tier provider behind Hermes.
                      </p>
                      <p className="text-[11px] text-violet-200/80 mt-2">
                        Configure <code className="text-violet-100">HERMES_ENABLED</code>, <code className="text-violet-100">HERMES_BASE_URL</code>, and a server-side <code className="text-violet-100">HERMES_API_KEY</code>. The key is never sent to browser code.
                      </p>
                      <div className="mt-2 grid gap-1 text-[10px] text-zinc-600">
                        <p>Status: {hermesNousStatus?.availableForRouting ? 'connected' : hermesNousStatus?.statusMessage ?? 'not connected'}</p>
                        <p>Proxy configured: {hermesNousStatus?.configured ? 'Yes' : 'No'}</p>
                        <p>API key: {hermesNousStatus?.apiKeyConfigured ? '******** configured' : 'missing'}</p>
                        <p>Mode: {hermesNousStatus?.mode ?? 'free/local or custom endpoint'}</p>
                        <p>Required env: <code>HERMES_ENABLED</code>, <code>HERMES_BASE_URL</code>, <code>HERMES_API_KEY</code></p>
                        {hermesNousStatus?.error && <p className="text-amber-300/80">{hermesNousStatus.error}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={fetchProviderStatus}
                      className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Refresh Hermes
                    </button>
                    <button
                      onClick={sendHermesTestMessage}
                      disabled={hermesTesting}
                      className="flex items-center gap-1 text-[11px] text-violet-200 hover:text-violet-100 transition-colors disabled:opacity-50"
                    >
                      <Zap className="w-3 h-3" />
                      {hermesTesting ? 'Testing Hermes...' : 'Send Test Message'}
                    </button>
                  </div>
                  {hermesTestMessage && <p className="text-[11px] text-zinc-400">{hermesTestMessage}</p>}
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Experimental / Planned Integrations</p>
                    <p className="text-xs text-zinc-600 mt-0.5">Visible roadmap only. These are not claimed as live providers.</p>
                  </div>
                  {[
                    {
                      name: 'Free Claude Code Proxy',
                      badge: 'Experimental proxy',
                      detail: 'Optional future bridge. Official Claude Code CLI remains separate and preferred.',
                    },
                    {
                      name: 'OpenClaw',
                      badge: 'Local agent',
                      detail: 'Available through the local daemon once installed. Recommended setup: ollama launch openclaw --config, or OpenClaw onboard with its daemon.',
                    },
                    {
                      name: 'Devin-style Auto Triage',
                      badge: 'Cloud teammate',
                      detail: 'External copy-prompt/PR workflow unless a safe Devin API route is configured. BertOS never auto-merges Devin output.',
                    },
                    {
                      name: 'Google Anti-Gravity CLI',
                      badge: 'Migration planned',
                      detail: 'Planned/experimental. Gemini CLI remains supported until official docs and local command detection verify migration.',
                    },
                    {
                      name: 'Google Managed Agents API',
                      badge: 'Planned cloud',
                      detail: 'Future cloud sandbox/managed-agent runtime. No live paid calls and not a replacement for the local daemon.',
                    },
                    {
                      name: 'Browser Skills',
                      badge: 'Planned verification',
                      detail: 'Future browser smoke-test and visual verification workflow. No direct BertOS route is wired yet.',
                    },
                    {
                      name: 'Hyperframes Video Agent',
                      badge: 'Planned media',
                      detail: 'Planned local HTML/CSS/JS animated video pipeline. Requires Node, FFmpeg, and Hyperframes setup before BertOS can claim rendering works.',
                    },
                    {
                      name: 'Remotion Video Agent',
                      badge: 'Planned media',
                      detail: 'Planned local React video rendering pipeline. Requires Node and FFmpeg/Remotion setup before BertOS can claim rendering works.',
                    },
                    {
                      name: 'Qwen / Experimental Models',
                      badge: 'Manual/API experimental',
                      detail: 'Manual or future API adapter only. Do not assume free unlimited usage and do not make it default.',
                    },
                  ].map(item => (
                    <div key={item.name} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-zinc-300">{item.name}</p>
                        <Badge variant="default" className="text-[9px] h-4">{item.badge}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-600">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={saveSettings} className="w-full">
                {saved ? <><Check className="w-4 h-4" /> Saved</> : 'Save Settings'}
              </Button>
            </motion.div>
          )}

          {/* ── API Keys ──────────────────────────────────────────────────── */}
          {activeSection === 'api-keys' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Optional API Providers</h3>
                <p className="text-xs text-zinc-500">
                  These create a separate metered bill. They are <strong className="text-zinc-400">NOT</strong> included in ChatGPT Plus, Claude Pro, or Google One subscriptions.
                </p>
              </div>

              {/* Billing warning */}
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-red-300 mb-1">Separate API billing — disabled by default</p>
                    <p className="text-xs text-red-400/70 leading-relaxed">
                      ChatGPT Plus does NOT include OpenAI API credits. Claude Pro does NOT include Anthropic API credits.
                      Google One AI Premium does NOT include Gemini API credits. Enabling these will charge your API account separately.
                    </p>
                  </div>
                </div>
              </div>

              <div className={cn(
                'rounded-xl border p-4',
                geminiNativeStatus?.available
                  ? 'border-blue-500/20 bg-blue-500/5'
                  : 'border-zinc-800 bg-zinc-900/30'
              )}>
                <div className="flex items-start gap-3">
                  <Globe className={cn('mt-0.5 h-4 w-4 shrink-0', geminiNativeStatus?.available ? 'text-blue-400' : 'text-zinc-600')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-300">Gemini Native API</p>
                      <Badge variant={geminiNativeStatus?.available ? 'success' : 'default'} className="text-[9px]">
                        {geminiNativeStatus?.available ? 'Ready' : geminiNativeStatus?.hasApiKey ? 'Gate off' : 'Missing key'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      Structured JSON planning, long context, council judging, workspace planning, and multimodal foundation.
                    </p>
                    <p className="mt-2 text-[11px] text-zinc-700">
                      Required env var: <code>GEMINI_API_KEY</code>. Optional fallback: <code>GOOGLE_API_KEY</code>. API usage is billed separately.
                    </p>
                    {geminiNativeStatus?.error && <p className="mt-2 text-[11px] text-amber-400">{geminiNativeStatus.error}</p>}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(geminiNativeStatus?.capabilities ?? ['structured-json', 'long-context', 'planning', 'council-judge']).slice(0, 6).map(capability => (
                        <Badge key={capability} variant="default" className="text-[9px]">{capability}</Badge>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={fetchGeminiNativeStatus}
                    className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Enable API providers toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/30">
                <div>
                  <p className="text-sm font-medium text-zinc-300">Enable API Providers</p>
                  <p className="text-xs text-zinc-600">Allow claude-api, openai-api, gemini-api, and gemini-api-native models</p>
                </div>
                <ToggleSwitch
                  value={settings.enableApiProviders ?? false}
                  onChange={v => updateSettings({ enableApiProviders: v })}
                />
              </div>

              {(settings.enableApiProviders ?? false) && (
                <>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                    <div className="flex items-start gap-2.5">
                      <Key className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-300 mb-1">Local Storage Only</p>
                        <p className="text-xs text-amber-400/70 leading-relaxed">
                          API keys are stored in your browser's local storage and are never sent to BertOS servers.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    {[
                      { label: 'Anthropic API Key',  placeholder: 'sk-ant-...', value: anthropicKey, setter: setAnthropicKey, model: 'claude-api',  color: '#8B5CF6', icon: <Cpu className="w-4 h-4" />   },
                      { label: 'OpenAI API Key',      placeholder: 'sk-...',     value: openaiKey,    setter: setOpenaiKey,    model: 'openai-api',  color: '#10B981', icon: <Zap className="w-4 h-4" />   },
                      { label: 'Google AI API Key',   placeholder: 'AIza...',    value: googleKey,    setter: setGoogleKey,    model: 'gemini-api',  color: '#3B82F6', icon: <Globe className="w-4 h-4" /> },
                    ].map(field => (
                      <div key={field.label} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span style={{ color: field.color }}>{field.icon}</span>
                          <label className="text-sm font-medium text-zinc-300">{field.label}</label>
                          <Badge variant={field.value ? 'success' : 'default'} className="text-[9px] h-4 ml-auto">
                            {field.value ? 'Connected' : 'Not Set'}
                          </Badge>
                        </div>
                        <SecretInput value={field.value} onChange={field.setter} placeholder={field.placeholder} />
                        <p className="text-[11px] text-zinc-700">Used for {field.model} calls</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <Button onClick={saveSettings} className="w-full">
                {saved ? <><Check className="w-4 h-4" /> Saved Successfully</> : 'Save Settings'}
              </Button>
            </motion.div>
          )}

          {activeSection === 'appearance' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Appearance</h3>
                <p className="text-xs text-zinc-500">Customize the visual style of BertOS.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'dark',     label: 'Dark',     preview: 'bg-zinc-900'    },
                  { value: 'darker',   label: 'Darker',   preview: 'bg-zinc-950'    },
                  { value: 'midnight', label: 'Midnight', preview: 'bg-[#05050A]'   },
                ].map(t => (
                  <button
                    key={t.value}
                    onClick={() => updateSettings({ theme: t.value as 'dark' | 'darker' | 'midnight' })}
                    className={cn(
                      'rounded-xl border p-4 text-center transition-all',
                      settings.theme === t.value
                        ? 'border-violet-500/40 bg-violet-500/10'
                        : 'border-zinc-800 hover:border-zinc-700'
                    )}
                  >
                    <div className={cn('w-full h-16 rounded-lg mb-2 border border-zinc-800', t.preview)} />
                    <p className="text-xs font-medium text-zinc-300">{t.label}</p>
                    {settings.theme === t.value && <Check className="w-3.5 h-3.5 text-violet-400 mx-auto mt-1" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Integrations ──────────────────────────────────────────────── */}
          {activeSection === 'integrations' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1">Integrations</h3>
                <p className="text-xs text-zinc-500">Messaging control, Hermes Hostinger, and external bridges. No paid calls are made from these status checks.</p>
              </div>

              {/* Telegram */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Telegram Messaging Bridge</h4>
                <div className={cn(
                  'rounded-xl border p-4 space-y-3',
                  telegramStatus?.configured
                    ? 'border-cyan-500/20 bg-cyan-500/5'
                    : 'border-zinc-800 bg-zinc-900/30'
                )}>
                  <div className="flex items-start gap-3">
                    <Bot className={cn('w-4 h-4 mt-0.5 flex-shrink-0', telegramStatus?.configured ? 'text-cyan-400' : 'text-zinc-600')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-zinc-200">Telegram Bot</p>
                        <Badge
                          variant={telegramStatus?.configured ? 'success' : 'default'}
                          className="text-[9px] h-4"
                        >
                          {telegramLoading ? 'Checking…' : telegramStatus?.configured ? 'Configured' : 'Not configured'}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Control BertOS via Telegram: /status, /daemon, /providers, /hermes, /brief, /coding review notes, /run-check.
                      </p>
                      {!telegramStatus?.configured && !telegramLoading && (
                        <p className="text-[11px] text-amber-300/80 mt-2">
                          Add <code className="text-amber-200">TELEGRAM_BOT_TOKEN</code> and{' '}
                          <code className="text-amber-200">TELEGRAM_ALLOWED_CHAT_ID</code> to your .env.local.
                        </p>
                      )}
                      {telegramStatus?.configured && (
                        <div className="mt-2 grid gap-1 text-[10px] text-zinc-600">
                          <p>Chat commands: /status /daemon /providers /hermes /brief /tasks /evolution /memory /coding /run-check /help</p>
                          <p>
                            AI chat (/chat): {telegramStatus.chatEnabled
                              ? `enabled — model: ${telegramStatus.ollamaModel}`
                              : 'disabled (set TELEGRAM_ALLOW_CHAT=true to enable Ollama-only chat)'}
                          </p>
                          <p>Webhook secret: {telegramStatus.webhookSecretConfigured ? 'configured' : 'not configured'}</p>
                          <p className="text-zinc-700">File writes, git push, paid API calls, and destructive ops are blocked.</p>
                        </div>
                      )}
                      {telegramStatus?.error && (
                        <p className="text-[11px] text-red-400/80 mt-1">{telegramStatus.error}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={fetchTelegramStatus}
                    disabled={telegramLoading}
                    className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={cn('w-3 h-3', telegramLoading && 'animate-spin')} />
                    Refresh Telegram Status
                  </button>
                </div>
              </div>

              {/* Hermes Hostinger */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Hermes Hostinger / Free Backend</h4>
                <div className={cn(
                  'rounded-xl border p-4 space-y-3',
                  hermesNousStatus?.availableForRouting
                    ? 'border-violet-500/20 bg-violet-500/5'
                    : 'border-zinc-800 bg-zinc-900/30'
                )}>
                  <div className="flex items-start gap-3">
                    <Globe className={cn('w-4 h-4 mt-0.5 flex-shrink-0', hermesNousStatus?.configured ? 'text-violet-300' : 'text-zinc-600')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-zinc-200">Hermes on Hostinger</p>
                        <Badge
                          variant={hermesNousStatus?.availableForRouting ? 'success' : hermesNousStatus?.configured ? 'warning' : 'default'}
                          className="text-[9px] h-4"
                        >
                          {hermesNousStatus?.availableForRouting
                            ? 'Connected'
                            : hermesNousStatus?.configured
                              ? 'Configured — not reachable'
                              : 'Not configured'}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Preferred production path: BertOS backend route to a Hermes API server on the same Hostinger VPS or a separate HTTPS VPS endpoint. Do not call Hermes directly from the browser.
                      </p>
                      <div className="mt-2 grid gap-1 text-[10px] text-zinc-600">
                        <p>HERMES_ENABLED: {hermesNousStatus?.enabled ? 'true' : 'false or missing'}</p>
                        <p>Endpoint configured: {hermesNousStatus?.endpointConfigured ? 'yes' : 'no'}</p>
                        <p>Proxy reachable: {hermesNousStatus?.proxyReachable === true ? 'yes' : hermesNousStatus?.proxyReachable === false ? 'no' : 'unknown'}</p>
                        <p>API key: {hermesNousStatus?.apiKeyConfigured ? '******** configured' : 'missing'}</p>
                        <p>Paid provider: {hermesNousStatus?.paidEnabled ? 'optional enabled behind Hermes' : 'not required'}</p>
                        <p className="text-zinc-700">Health/model checks are server-side and safe. Chat tests call only your configured Hermes endpoint.</p>
                      </div>
                      {hermesNousStatus?.error && (
                        <p className="text-[11px] text-amber-300/80 mt-1">{hermesNousStatus.error}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={fetchProviderStatus}
                    className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Test Hermes Health
                  </button>
                </div>
              </div>

              {/* Messaging bridge summary */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-2">
                <p className="text-sm font-medium text-zinc-300">Messaging Bridge Safety</p>
                <div className="grid gap-1 text-[11px] text-zinc-600">
                  <p>All Telegram commands are read-only or draft-only by default.</p>
                  <p>No file writes, no git push, no paid API calls from Telegram.</p>
                  <p>Destructive operations require web UI approval.</p>
                  <p>/chat command uses local Ollama only — never paid providers.</p>
                  <p>/coding returns a review-ready task summary — nothing is auto-applied.</p>
                </div>
              </div>
            </motion.div>
          )}

          {(activeSection === 'memory' || activeSection === 'performance' || activeSection === 'security') && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-zinc-200 mb-1 capitalize">{activeSection.replace('-', ' ')}</h3>
                <p className="text-xs text-zinc-500">Advanced configuration options.</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-center">
                <Settings className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-zinc-600">Advanced settings coming soon</p>
                <p className="text-xs text-zinc-700 mt-1">These controls are being built into BertOS</p>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
