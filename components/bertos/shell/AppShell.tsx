'use client'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'sonner'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { RightPanel } from './RightPanel'
import { BottomNav } from './BottomNav'
import { CommandPalette } from '../command/CommandPalette'
import { OnboardingModal, useOnboarding } from './OnboardingModal'
import { DemoBanner } from './DemoBanner'
import { KeyboardShortcuts } from '../panels/KeyboardShortcuts'
import { AutomationScheduler } from '../autopilot/AutomationScheduler'
import { BertOSGameLayer } from '../game/BertOSGameLayer'
import { PWAController } from './PWAController'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useDaemonStore } from '@/store/bertos/daemon' // accessed via .getState() in polling interval
import { useProgressionStore } from '@/store/bertos/progression'
import { TooltipProvider } from '@/components/ui/tooltip'
import { usePathname, useRouter } from 'next/navigation'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { HermesDock, OlympusShell, type MythicStageVariant } from '@/components/bertos/olympus'

function stageVariantForPath(pathname: string): MythicStageVariant {
  if (pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/hermes')) return 'dashboard'
  if (pathname.startsWith('/agents') || pathname.startsWith('/skills') || pathname.startsWith('/plugins') || pathname.startsWith('/engines') || pathname.startsWith('/compare')) return 'agents'
  if (pathname.startsWith('/coding') || pathname.startsWith('/builder') || pathname.startsWith('/chat')) return 'terminal'
  if (pathname.startsWith('/workspace') || pathname.startsWith('/github') || pathname.startsWith('/prompts') || pathname.startsWith('/playbooks')) return 'files'
  if (pathname.startsWith('/settings') || pathname.startsWith('/launch')) return 'settings'
  if (pathname.startsWith('/memory') || pathname.startsWith('/memory-review') || pathname.startsWith('/brief')) return 'memory'
  if (pathname.startsWith('/outputs') || pathname.startsWith('/runs') || pathname.startsWith('/studio') || pathname.startsWith('/publishing-queue') || pathname.startsWith('/autopilot') || pathname.startsWith('/tasks') || pathname.startsWith('/evolution') || pathname.startsWith('/max') || pathname.startsWith('/migrations')) return 'automation'
  return 'generic'
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { rightPanelOpen, setRightPanelOpen, sidebarCollapsed, setSidebarCollapsed,
          setCommandPaletteOpen, setActiveView } = useUIStore()
  const { getOrCreateSession } = useChatStore()
  const { showOnboarding, complete } = useOnboarding()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const daemonStatus = useDaemonStore(s => s.status)
  const recordProgression = useProgressionStore(s => s.recordAction)
  const router = useRouter()
  const pathname = usePathname()
  const daemonProgressionRecordedRef = useRef(false)
  const mainScrollRef = useRef<HTMLElement | null>(null)
  const stageVariant = stageVariantForPath(pathname)

  // Use refs so the keyboard handler always reads latest values without re-registering
  const sidebarCollapsedRef = useRef(sidebarCollapsed)
  const rightPanelOpenRef = useRef(rightPanelOpen)
  useEffect(() => { sidebarCollapsedRef.current = sidebarCollapsed }, [sidebarCollapsed])
  useEffect(() => { rightPanelOpenRef.current = rightPanelOpen }, [rightPanelOpen])

  // Global daemon polling — runs once; interval reads live store state to avoid stale ref
  useEffect(() => {
    void useDaemonStore.getState().refresh()
    const interval = window.setInterval(() => {
      const state = useDaemonStore.getState()
      if (!state.loading) void state.refresh()
    }, 30000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if ((daemonStatus === 'connected' || daemonStatus === 'degraded') && !daemonProgressionRecordedRef.current) {
      daemonProgressionRecordedRef.current = true
      recordProgression('daemon-online')
    }
  }, [daemonStatus, recordProgression])

  useEffect(() => {
    const main = mainScrollRef.current
    if (!main) return

    let touchY: number | null = null
    const ignoreSelector = 'input, textarea, select, [contenteditable="true"], [data-no-main-scroll]'

    const hasScrollableParent = (target: EventTarget | null) => {
      let node = target instanceof Element ? target : null
      while (node && node !== main && node !== document.body) {
        if (node instanceof HTMLElement) {
          const style = window.getComputedStyle(node)
          const scrollable = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1
          if (scrollable) return true
        }
        node = node.parentElement
      }
      return false
    }

    const scrollMain = (deltaY: number) => {
      if (!deltaY || main.scrollHeight <= main.clientHeight + 1) return false
      const nextTop = Math.max(0, Math.min(main.scrollHeight - main.clientHeight, main.scrollTop + deltaY))
      if (nextTop === main.scrollTop) return false
      main.scrollTop = nextTop
      return true
    }

    const shouldHandle = (target: EventTarget | null) => {
      if (target instanceof Element && target.closest(ignoreSelector)) return false
      return !hasScrollableParent(target)
    }

    const handleWheel = (event: WheelEvent) => {
      if (!shouldHandle(event.target)) return
      if (scrollMain(event.deltaY)) event.preventDefault()
    }

    const handleTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (touchY === null || !shouldHandle(event.target)) return
      const nextY = event.touches[0]?.clientY ?? touchY
      const deltaY = touchY - nextY
      touchY = nextY
      if (scrollMain(deltaY)) event.preventDefault()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!shouldHandle(event.target)) return
      const page = Math.max(160, main.clientHeight * 0.82)
      const deltas: Record<string, number> = {
        ArrowDown: 64,
        ArrowUp: -64,
        PageDown: page,
        PageUp: -page,
      }
      if (event.key === 'Home') {
        if (main.scrollTop > 0) {
          main.scrollTop = 0
          event.preventDefault()
        }
        return
      }
      if (event.key === 'End') {
        const maxTop = main.scrollHeight - main.clientHeight
        if (main.scrollTop < maxTop) {
          main.scrollTop = maxTop
          event.preventDefault()
        }
        return
      }
      const deltaY = deltas[event.key] ?? (event.key === ' ' && !event.shiftKey ? page : event.key === ' ' && event.shiftKey ? -page : 0)
      if (deltaY && scrollMain(deltaY)) event.preventDefault()
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'k') { e.preventDefault(); setCommandPaletteOpen(true) }
      if (mod && e.key === 'b') { e.preventDefault(); setSidebarCollapsed(!sidebarCollapsedRef.current) }
      if (mod && e.key === 'p') { e.preventDefault(); setRightPanelOpen(!rightPanelOpenRef.current) }
      if (mod && e.key === 'n') { e.preventDefault(); getOrCreateSession(); setActiveView('chat'); router.push('/chat') }
      if (mod && e.key === ',') { e.preventDefault(); setActiveView('settings'); router.push('/settings') }
      if (mod && e.key === '0') { e.preventDefault(); setActiveView('dashboard'); router.push('/dashboard') }
      if (mod && e.key === '1') { e.preventDefault(); setActiveView('chat'); router.push('/chat') }
      if (mod && e.key === 'h') { e.preventDefault(); setActiveView('hermes'); router.push('/hermes') }
      if (mod && e.key === '2') { e.preventDefault(); setActiveView('compare'); router.push('/compare') }
      if (mod && e.key === '3') { e.preventDefault(); setActiveView('coding'); router.push('/coding') }
      if (mod && e.key === 'm') { e.preventDefault(); setActiveView('max'); router.push('/max') }
      if (mod && e.key === '4') { e.preventDefault(); setActiveView('workspace'); router.push('/workspace') }
      if (mod && e.key === '5') { e.preventDefault(); setActiveView('evolution'); router.push('/evolution') }
      if (mod && e.key === '?') { e.preventDefault(); setShortcutsOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setCommandPaletteOpen, setSidebarCollapsed, setRightPanelOpen, getOrCreateSession, setActiveView, router])

  return (
    <TooltipProvider delayDuration={400}>
      <OlympusShell variant={stageVariant}>
        {/* Desktop sidebar */}
        <div className="relative z-20 hidden h-full min-h-0 flex-shrink-0 md:flex">
          <Sidebar />
        </div>

        {/* Mobile sidebar — Sheet drawer */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="md:hidden p-0">
            <Sidebar isMobile onMobileClose={() => setMobileSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="relative z-10 flex-1 flex min-h-0 flex-col min-w-0 overflow-hidden">
          <DemoBanner />
          <TopBar onMobileMenuToggle={() => setMobileSidebarOpen(true)} />
          <BertOSGameLayer />
          <main ref={mainScrollRef} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain md:pl-16">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>

        {/* Right panel — desktop only */}
        <AnimatePresence>
          {rightPanelOpen && (
            <div className="relative z-20 hidden h-full min-h-0 md:block">
              <RightPanel />
            </div>
          )}
        </AnimatePresence>

        {/* Mobile bottom navigation */}
        <BottomNav />

        {/* Overlays */}
        <PWAController />
        <AutomationScheduler />
        <CommandPalette />
        <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        <HermesDock />

        <AnimatePresence>
          {showOnboarding && <OnboardingModal onComplete={complete} />}
        </AnimatePresence>

        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#18181B',
              border: '1px solid #27272A',
              color: '#F4F4F5',
              borderRadius: '12px',
            },
          }}
        />
      </OlympusShell>
    </TooltipProvider>
  )
}
