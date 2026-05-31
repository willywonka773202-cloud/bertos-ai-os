'use client'

import { Bot, Code2, LayoutDashboard, MessageSquare, Settings, Sparkles, TerminalSquare } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { BrandSigil, type OlympusBrand } from './BrandSigil'

const DOCK_ROUTES = [
  { id: 'dashboard', href: '/dashboard', label: 'Olympus Command', icon: LayoutDashboard },
  { id: 'chat', href: '/chat', label: 'Oracle Console', icon: MessageSquare },
  { id: 'coding', href: '/coding', label: 'Forge Bay', icon: TerminalSquare },
  { id: 'workspace', href: '/workspace', label: 'Archive Temple', icon: Code2 },
  { id: 'agents', href: '/agents', label: 'Divine Agents', icon: Bot },
  { id: 'settings', href: '/settings', label: 'Control Altar', icon: Settings },
] as const

const DOCK_BRANDS: OlympusBrand[] = ['claude', 'codex', 'ollama', 'hermes']

export function HermesDock() {
  const pathname = usePathname()
  const router = useRouter()
  const setActiveView = useUIStore(state => state.setActiveView)

  return (
    <div className="olympus-dock hidden md:flex" role="navigation" aria-label="Hermes OS dock">
      <div className="olympus-dock__section">
        <BrandSigil brand="bertos" size="sm" />
      </div>
      <div className="olympus-dock__divider" />
      <div className="olympus-dock__section">
        {DOCK_ROUTES.map(item => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              title={item.label}
              onClick={() => {
                setActiveView(item.id)
                router.push(item.href)
              }}
              className={cn('olympus-dock__button', active && 'is-active')}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>
      <div className="olympus-dock__divider" />
      <div className="olympus-dock__section">
        {DOCK_BRANDS.map(brand => (
          <button
            key={brand}
            type="button"
            aria-label={`${brand} module`}
            title={`${brand} module`}
            className="olympus-dock__brand"
            onClick={() => {
              setActiveView('agents')
              router.push(`/engines/${brand === 'claude' ? 'claude' : brand === 'codex' ? 'codex' : brand}`)
            }}
          >
            <BrandSigil brand={brand} size="xs" />
          </button>
        ))}
      </div>
      <div className="olympus-dock__flare" />
    </div>
  )
}
