'use client'
import { useEffect, useState } from 'react'
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
import { TooltipProvider } from '@/components/ui/tooltip'
import { useRouter } from 'next/navigation'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { rightPanelOpen, setRightPanelOpen, sidebarCollapsed, setSidebarCollapsed,
          setCommandPaletteOpen, setActiveView } = useUIStore()
  const { getOrCreateSession } = useChatStore()
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
      if (mod && e.key === 'n') { e.preventDefault(); getOrCreateSession(); setActiveView('chat'); router.push('/chat') }
      if (mod && e.key === ',') { e.preventDefault(); setActiveView('settings'); router.push('/settings') }
      if (mod && e.key === '0') { e.preventDefault(); setActiveView('dashboard'); router.push('/dashboard') }
      if (mod && e.key === '1') { e.preventDefault(); setActiveView('chat'); router.push('/chat') }
      if (mod && e.key === '2') { e.preventDefault(); setActiveView('compare'); router.push('/compare') }
      if (mod && e.key === '3') { e.preventDefault(); setActiveView('coding'); router.push('/coding') }
      if (mod && e.key === '4') { e.preventDefault(); setActiveView('workspace'); router.push('/workspace') }
      if (mod && e.key === '5') { e.preventDefault(); setActiveView('evolution'); router.push('/evolution') }
      if (mod && e.key === '?') { e.preventDefault(); setShortcutsOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sidebarCollapsed, rightPanelOpen, setCommandPaletteOpen, setSidebarCollapsed,
      setRightPanelOpen, getOrCreateSession, setActiveView, router])

  return (
    <TooltipProvider delayDuration={400}>
      <div className="relative flex h-dvh overflow-hidden bg-[#020617] text-zinc-100">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_88%_8%,rgba(251,191,36,0.14),transparent_28%),linear-gradient(135deg,#020617_0%,#050816_44%,#09090B_100%)]" />
        <div className="hermes-grid pointer-events-none absolute inset-0 opacity-35" />
        <div className="hermes-scanlines pointer-events-none absolute inset-0 opacity-[0.08]" />

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
            {children}
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
