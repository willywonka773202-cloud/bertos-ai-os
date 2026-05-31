'use client'
import { MessageSquare, Code2, Zap, Settings, LayoutDashboard, Sparkles } from 'lucide-react'
import { cn } from '@/lib/bertos/cn'
import { useUIStore } from '@/store/bertos/ui'
import { usePathname, useRouter } from 'next/navigation'

const ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Home',     href: '/dashboard' },
  { id: 'chat',      icon: MessageSquare, label: 'Chat',     href: '/chat'      },
  { id: 'hermes',    icon: Sparkles,      label: 'Hermes',   href: '/hermes'    },
  { id: 'coding',    icon: Zap,           label: 'Code',     href: '/coding'    },
  { id: 'workspace', icon: Code2,         label: 'Files',    href: '/workspace' },
  { id: 'settings',  icon: Settings,      label: 'Settings', href: '/settings'  },
] as const

export function BottomNav() {
  const { activeView, setActiveView } = useUIStore()
  const router = useRouter()
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[rgba(246,196,83,0.22)] bg-[#05030A]/88 pb-safe shadow-[0_-16px_55px_rgba(0,0,0,0.42),0_0_34px_rgba(246,196,83,0.08)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(103,232,249,0.55)] to-transparent" />
      <div className="flex items-center justify-around px-1 pt-1.5 pb-1.5">
        {ITEMS.map(item => {
          const isActive = activeView === item.id || pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id); router.push(item.href) }}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-all active:scale-95',
                isActive ? 'bg-[rgba(246,196,83,0.10)] text-[#F6C453]' : 'text-[#786A54]',
              )}
            >
              {isActive && <span className="absolute inset-x-5 -top-1 h-px bg-gradient-to-r from-transparent via-[#F6C453] to-transparent" />}
              <item.icon className={cn('w-5 h-5', isActive && 'text-[#F6C453]')} style={isActive ? { filter: 'drop-shadow(0 0 8px rgba(246,196,83,0.55))' } : undefined} />
              <span className={cn('text-[9px] font-semibold tracking-wide', isActive ? 'text-[#F6C453]' : 'text-[#6A5A3A]')}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
