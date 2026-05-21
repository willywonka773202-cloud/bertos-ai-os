import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AIModel, BertOSSettings } from '@/lib/bertos/types'

interface UIStore {
  commandPaletteOpen: boolean
  rightPanelOpen: boolean
  rightPanelTab: 'logs' | 'memory' | 'tasks' | 'files' | 'terminal'
  sidebarCollapsed: boolean
  activeView: 'dashboard' | 'chat' | 'prompts' | 'compare' | 'coding' | 'workspace' | 'evolution' | 'agents' | 'memory' | 'settings'
  selectedModel: AIModel
  settings: BertOSSettings
  pendingWorkspaceTask: string | null
  pendingAgentTask: { title: string; description: string } | null

  setCommandPaletteOpen: (open: boolean) => void
  setRightPanelOpen: (open: boolean) => void
  setRightPanelTab: (tab: UIStore['rightPanelTab']) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setActiveView: (view: UIStore['activeView']) => void
  setSelectedModel: (model: AIModel) => void
  updateSettings: (settings: Partial<BertOSSettings>) => void
  setPendingWorkspaceTask: (task: string | null) => void
  setPendingAgentTask: (task: { title: string; description: string } | null) => void
}

const DEFAULT_SETTINGS: BertOSSettings = {
  theme: 'dark',
  primaryModel: 'ollama-pro',
  routingEnabled: true,
  streamingEnabled: true,
  memoryEnabled: true,
  enableApiProviders: false,
  cliPaths: {},
  apiKeys: {},
  ollamaCloudModel: 'gpt-oss:120b-cloud',
  ollamaLocalFallback: 'qwen2.5-coder:latest',
  modelPriority: ['ollama-pro', 'claude-code', 'gemini-cli', 'codex-cli', 'qwen2.5-coder'],
  tokenBudget: 100000,
  animationsEnabled: true,
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      commandPaletteOpen: false,
      rightPanelOpen: true,
      rightPanelTab: 'memory',
      sidebarCollapsed: false,
      activeView: 'chat',
      selectedModel: 'ollama-pro',
      settings: DEFAULT_SETTINGS,
      pendingWorkspaceTask: null,
      pendingAgentTask: null,

      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
      setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setActiveView: (view) => set({ activeView: view }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      updateSettings: (settings) =>
        set(state => ({ settings: { ...state.settings, ...settings } })),
      setPendingWorkspaceTask: (task) => set({ pendingWorkspaceTask: task }),
      setPendingAgentTask: (task) => set({ pendingAgentTask: task }),
    }),
    {
      name: 'bertos-ui',
      partialize: (state) => ({
        rightPanelOpen: state.rightPanelOpen,
        sidebarCollapsed: state.sidebarCollapsed,
        selectedModel: state.selectedModel,
        settings: state.settings,
      }),
      // Deep-merge settings so new default fields aren't wiped by old localStorage entries
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UIStore>
        return {
          ...current,
          ...p,
          settings: {
            ...DEFAULT_SETTINGS,
            ...(p.settings ?? {}),
            // Always deep-merge nested objects so new keys get defaults
            apiKeys:  { ...DEFAULT_SETTINGS.apiKeys,  ...(p.settings?.apiKeys  ?? {}) },
            cliPaths: { ...DEFAULT_SETTINGS.cliPaths, ...(p.settings?.cliPaths ?? {}) },
            modelPriority: p.settings?.modelPriority ?? DEFAULT_SETTINGS.modelPriority,
          },
        }
      },
    }
  )
)
