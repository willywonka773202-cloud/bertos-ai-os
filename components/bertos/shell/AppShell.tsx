'use client'
import { useEffect, useState } from 'react'
import { AnimatePresence, MotionConfig } from 'framer-motion'
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
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/bertos/cn'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { rightPanelOpen, setRightPanelOpen, sidebarCollapsed, setSidebarCollapsed,
          setCommandPaletteOpen, setActiveView, selectedModel, settings } = useUIStore()
  const { getOrCreateSession, setActiveSession } = useChatStore()
  const { showOnboarding, complete } = useOnboarding()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'k') { e.preventDefault(); setCommandPaletteOpen(true) }
      if (mod && e.key === 'b') { e.preventDefault(); setSidebarCollapsed(!sidebarCollapsed) }
      if (mod && e.key === 'p') { e.preventDefault(); setRightPanelOpen(!rightPanelOpen) }
      if (mod && e.key === 'n') {
        e.preventDefault()
        const s = getOrCreateSession(selectedModel)
        setActiveSession(s.id)
        setActiveView('chat')
        router.push('/chat')
      }
      if (mod && e.key === ',') { e.preventDefault(); setActiveView('settings'); router.push('/settings') }
      if (mod && e.key === '0') { e.preventDefault(); setActiveView('dashboard'); router.push('/dashboard') }
      if (mod && e.key === '1') { e.preventDefault(); setActiveView('chat'); router.push('/chat') }
      if (mod && e.key === '2') { e.preventDefault(); setActiveView('compare'); router.push('/compare') }
      if (mod && e.key === '3') { e.preventDefault(); setActiveView('workspace'); router.push('/workspace') }
      if (mod && e.key === '4') { e.preventDefault(); setActiveView('evolution'); router.push('/evolution') }
      if (mod && e.key === '5') { e.preventDefault(); setActiveView('coding'); router.push('/coding') }
      if (mod && e.key === '6') { e.preventDefault(); setActiveView('agents'); router.push('/agents') }
      if (mod && e.key === '?') { e.preventDefault(); setShortcutsOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sidebarCollapsed, rightPanelOpen, setCommandPaletteOpen, setSidebarCollapsed,
      setRightPanelOpen, getOrCreateSession, setActiveSession, selectedModel, setActiveView, router])

  return (
    <TooltipProvider delayDuration={400}>
      <MotionConfig transition={settings.animationsEnabled === false ? { duration: 0 } : undefined}>
      <div className={cn(
        'relative flex h-dvh overflow-hidden text-cyan-50',
        // Deep navy radial with cyan top glow + bronze bottom ember
        'bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.10),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(217,119,6,0.06),_transparent_50%),#02050B]',
      )}>
        {/* Tactical grid overlay */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hermes-grid opacity-50" />
        {/* Subtle scanlines */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hermes-scanlines" />

        {/* Desktop sidebar */}
        <div className="hidden md:flex flex-shrink-0 h-full relative z-20">
          <Sidebar />
        </div>

        {/* Mobile sidebar — Sheet drawer */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="md:hidden p-0 bg-[#05080F] border-cyan-500/20">
            <Sidebar isMobile onMobileClose={() => setMobileSidebarOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          <DemoBanner />
          <TopBar onMobileMenuToggle={() => setMobileSidebarOpen(true)} />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>

        {/* Right panel — desktop only */}
        <AnimatePresence>
          {rightPanelOpen && (
            <div className="hidden md:block relative z-20">
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
              background: 'rgba(10, 15, 26, 0.95)',
              border: '1px solid rgba(34, 211, 238, 0.25)',
              color: '#ECFEFF',
              borderRadius: '12px',
              backdropFilter: 'blur(12px)',
            },
          }}
        />
      </div>
      </MotionConfig>
    </TooltipProvider>
  )
}
