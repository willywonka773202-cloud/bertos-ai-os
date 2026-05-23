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
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useUIStore } from '@/store/bertos/ui'
import { useChatStore } from '@/store/bertos/chat'
import { useDaemonStore } from '@/store/bertos/daemon' // accessed via .getState() in polling interval
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRouter } from 'next/navigation'
import { ErrorBoundary } from '../shared/ErrorBoundary'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { rightPanelOpen, setRightPanelOpen, sidebarCollapsed, setSidebarCollapsed,
          setCommandPaletteOpen, setActiveView } = useUIStore()
  const { getOrCreateSession } = useChatStore()
  const { showOnboarding, complete } = useOnboarding()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const router = useRouter()

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
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'k') { e.preventDefault(); setCommandPaletteOpen(true) }
      if (mod && e.key === 'b') { e.preventDefault(); setSidebarCollapsed(!sidebarCollapsedRef.current) }
      if (mod && e.key === 'p') { e.preventDefault(); setRightPanelOpen(!rightPanelOpenRef.current) }
      if (mod && e.key === 'n') { e.preventDefault(); getOrCreateSession(); setActiveView('chat'); router.push('/chat') }
      if (mod && e.key === ',') { e.preventDefault(); setActiveView('settings'); router.push('/settings') }
      if (mod && e.key === '0') { e.preventDefault(); setActiveView('dashboard'); router.push('/dashboard') }
      if (mod && e.key === '1') { e.preventDefault(); setActiveView('chat'); router.push('/chat') }
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
      <div className="relative flex h-dvh overflow-hidden bg-[#070503] text-[#F0EAD8]">
        {/* Divine radial light — warm gold descending from heaven above */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_42%_at_50%_0%,rgba(212,180,131,0.13),transparent),radial-gradient(circle_at_88%_18%,rgba(184,137,75,0.07),transparent_32%),radial-gradient(circle_at_10%_28%,rgba(212,180,131,0.05),transparent_26%),linear-gradient(172deg,#0E0B07_0%,#080604_48%,#040302_100%)]" />
        {/* Imperial stone grid */}
        <div className="hermes-grid pointer-events-none absolute inset-0 opacity-30" />
        {/* Atmospheric depth veil — subtle, not sci-fi */}
        <div className="hermes-scanlines pointer-events-none absolute inset-0 opacity-[0.06]" />

        {/* Desktop sidebar */}
        <div className="relative z-20 hidden md:flex flex-shrink-0 h-full">
          <Sidebar />
        </div>

        {/* Mobile sidebar — Sheet drawer */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="md:hidden p-0">
            <Sidebar isMobile onMobileClose={() => setMobileSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
          <DemoBanner />
          <TopBar onMobileMenuToggle={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 overflow-hidden">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>

        {/* Right panel — desktop only */}
        <AnimatePresence>
          {rightPanelOpen && (
            <div className="relative z-20 hidden md:block">
              <RightPanel />
            </div>
          )}
        </AnimatePresence>

        {/* Mobile bottom navigation */}
        <BottomNav />

        {/* Overlays */}
        <CommandPalette />
        <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

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
      </div>
    </TooltipProvider>
  )
}
