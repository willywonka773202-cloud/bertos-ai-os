'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/bertos/cn'
import { fetchBrowserAwareProviderStatus, type ProviderStatusEntry } from '@/lib/bertos/provider-status-client'

export function ProviderStatusIndicator() {
  const [providers, setProviders] = useState<ProviderStatusEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lastCheck, setLastCheck] = useState<Date>(new Date())
  const [source, setSource] = useState<'server' | 'browser-daemon'>('server')

  useEffect(() => {
    loadProviderStatus()
    // Refresh every 30 seconds
    const interval = setInterval(loadProviderStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadProviderStatus() {
    try {
      const data = await fetchBrowserAwareProviderStatus()
      setProviders(data.providers || [])
      setSource(data.providerStatusSource === 'browser-daemon' ? 'browser-daemon' : 'server')
      setLastCheck(new Date())
    } catch (error) {
      console.error('Failed to load provider status:', error)
    } finally {
      setLoading(false)
    }
  }

  const onlineCount = providers.filter(p => p.status === 'online').length
  const totalCount = providers.length
  const allOnline = onlineCount === totalCount && totalCount > 0
  const someOnline = onlineCount > 0 && onlineCount < totalCount
  const noneOnline = onlineCount === 0 && totalCount > 0

  let statusColor = 'text-zinc-600'
  let glowColor = 'rgba(113, 113, 122, 0.3)'

  if (allOnline) {
    statusColor = 'text-emerald-400'
    glowColor = 'rgba(52, 211, 153, 0.5)'
  } else if (someOnline) {
    statusColor = 'text-amber-400'
    glowColor = 'rgba(251, 191, 36, 0.5)'
  } else if (noneOnline) {
    statusColor = 'text-red-400'
    glowColor = 'rgba(248, 113, 113, 0.5)'
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={loadProviderStatus}
          className="relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[rgba(212,180,131,0.04)] border border-[rgba(212,180,131,0.12)] hover:border-[rgba(212,180,131,0.28)] transition-all group"
        >
          {/* Status orb with glow */}
          <div className="relative">
            <motion.div
              animate={{
                boxShadow: [`0 0 0 0 ${glowColor}`, `0 0 8px 2px ${glowColor}`, `0 0 0 0 ${glowColor}`]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className={cn('w-2 h-2 rounded-full', statusColor)}
              style={{ backgroundColor: 'currentColor' }}
            />
          </div>

          {/* Count */}
          <div className="flex items-center gap-1.5">
            <span className={cn('text-xs font-medium', statusColor)}>
              {loading ? '...' : `${onlineCount}/${totalCount}`}
            </span>
            <Activity className={cn('w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity', statusColor)} />
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-700/50">
            <Activity className="w-4 h-4 text-zinc-400" />
            <span className="font-semibold text-sm">Provider Status</span>
            <span className="ml-auto rounded border border-zinc-700/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-500">
              {source === 'browser-daemon' ? 'desktop bridge' : 'server'}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Checking...</span>
            </div>
          ) : providers.length === 0 ? (
            <div className="text-xs text-zinc-500">No providers configured</div>
          ) : (
            <div className="space-y-1.5">
              {providers.map(provider => {
                const Icon = provider.status === 'online' ? CheckCircle2 :
                            provider.status === 'offline' ? XCircle : AlertCircle
                const color = provider.status === 'online' ? 'text-emerald-400' :
                             provider.status === 'offline' ? 'text-red-400' : 'text-amber-400'

                return (
                  <div key={provider.id} className="rounded-md border border-zinc-800/70 bg-zinc-950/40 p-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', color)} />
                      <span className="min-w-0 flex-1 truncate text-zinc-300">{provider.name}</span>
                      {provider.source && (
                        <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-600">
                          {provider.source === 'browser-daemon' ? 'desktop' : provider.source}
                        </span>
                      )}
                      {provider.status !== 'online' && provider.status !== 'offline' && (
                        <span className="text-[10px] uppercase tracking-wide text-amber-400">{provider.status}</span>
                      )}
                      {provider.latency && (
                        <span className="text-zinc-600">{provider.latency}ms</span>
                      )}
                    </div>
                    {provider.message && (
                      <div className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-zinc-600">
                        {provider.message}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="space-y-1 border-t border-zinc-700/50 pt-2 text-[10px] leading-relaxed text-zinc-600">
            <div>
              {source === 'browser-daemon'
                ? 'Local CLI providers are checked through this desktop daemon. Phone access needs the desktop bridge reachable or a server-side provider.'
                : 'Server status cannot see your Mac daemon. Start the desktop daemon and refresh from this browser to check CLI tools.'}
            </div>
            <div>Last check: {lastCheck.toLocaleTimeString()} · {source === 'browser-daemon' ? 'browser bridge' : 'server'}</div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
