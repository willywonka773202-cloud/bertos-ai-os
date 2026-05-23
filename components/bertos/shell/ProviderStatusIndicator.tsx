'use client'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, CheckCircle2, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/bertos/cn'

interface ProviderStatus {
  id: string
  name: string
  status: 'online' | 'offline' | 'unknown'
  latency?: number
  message?: string
}

export function ProviderStatusIndicator() {
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [lastCheck, setLastCheck] = useState<Date>(new Date())

  useEffect(() => {
    loadProviderStatus()
    // Refresh every 30 seconds
    const interval = setInterval(loadProviderStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadProviderStatus() {
    try {
      const res = await fetch('/api/providers/status')
      if (res.ok) {
        const data = await res.json()
        setProviders(data.providers || [])
        setLastCheck(new Date())
      }
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
                             provider.status === 'offline' ? 'text-red-400' : 'text-zinc-500'

                return (
                  <div key={provider.id} className="flex items-center gap-2 text-xs">
                    <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', color)} />
                    <span className="flex-1 text-zinc-300">{provider.name}</span>
                    {provider.latency && (
                      <span className="text-zinc-600">{provider.latency}ms</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="pt-2 border-t border-zinc-700/50 text-[10px] text-zinc-600">
            Last check: {lastCheck.toLocaleTimeString()}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
