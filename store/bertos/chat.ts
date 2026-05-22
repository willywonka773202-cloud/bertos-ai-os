import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Message, ChatSession, AIModel } from '@/lib/bertos/types'

interface ChatStore {
  sessions: ChatSession[]
  activeSessionId: string | null
  streamingMessageId: string | null
  isStreaming: boolean

  createSession: (model?: AIModel, projectId?: string) => ChatSession
  getOrCreateSession: (model?: AIModel, projectId?: string) => ChatSession
  deleteEmptySessions: () => void
  setActiveSession: (id: string) => void
  deleteSession: (id: string) => void
  updateSessionTitle: (id: string, title: string) => void

  addMessage: (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => Message
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Message>) => void
  appendToMessage: (sessionId: string, messageId: string, chunk: string) => void
  deleteMessage: (sessionId: string, messageId: string) => void

  setStreaming: (streaming: boolean, messageId?: string) => void
  getActiveSession: () => ChatSession | null
  getActiveMessages: () => Message[]
  clearSession: (sessionId: string) => void
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      streamingMessageId: null,
      isStreaming: false,

      createSession: (model = 'auto', projectId) => {
        const session: ChatSession = {
          id: uuidv4(),
          title: 'New Chat',
          messages: [],
          model,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          projectId,
          pinned: false,
        }
        set(state => ({
          sessions: [session, ...state.sessions],
          activeSessionId: session.id,
        }))
        return session
      },

      getOrCreateSession: (model = 'auto', projectId) => {
        const { sessions, activeSessionId } = get()
        const active = sessions.find(s => s.id === activeSessionId)
        if (active && active.messages.length === 0) {
          set(state => ({
            sessions: state.sessions.map(s =>
              s.id === active.id
                ? { ...s, model, projectId: projectId ?? s.projectId, updatedAt: Date.now() }
                : s
            ),
            activeSessionId: active.id,
          }))
          return { ...active, model, projectId: projectId ?? active.projectId, updatedAt: Date.now() }
        }
        const reusableDraft = sessions.find(s => s.messages.length === 0 && (!projectId || s.projectId === projectId))
        if (reusableDraft) {
          set(state => ({
            sessions: state.sessions.map(s =>
              s.id === reusableDraft.id
                ? { ...s, model, projectId: projectId ?? s.projectId, updatedAt: Date.now() }
                : s
            ),
            activeSessionId: reusableDraft.id,
          }))
          return { ...reusableDraft, model, projectId: projectId ?? reusableDraft.projectId, updatedAt: Date.now() }
        }
        return get().createSession(model, projectId)
      },

      deleteEmptySessions: () =>
        set(state => {
          const sessions = state.sessions.filter(s => s.messages.length > 0 || s.id === state.activeSessionId)
          if (sessions.length === state.sessions.length) return state
          return {
            sessions,
            activeSessionId: state.activeSessionId && sessions.some(s => s.id === state.activeSessionId)
              ? state.activeSessionId
              : sessions[0]?.id ?? null,
          }
        }),

      setActiveSession: (id) => set({ activeSessionId: id }),

      deleteSession: (id) =>
        set(state => {
          const sessions = state.sessions.filter(s => s.id !== id)
          return {
            sessions,
            activeSessionId:
              state.activeSessionId === id
                ? sessions[0]?.id ?? null
                : state.activeSessionId,
          }
        }),

      updateSessionTitle: (id, title) =>
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === id ? { ...s, title, updatedAt: Date.now() } : s
          ),
        })),

      addMessage: (sessionId, messageData) => {
        const message: Message = {
          ...messageData,
          id: uuidv4(),
          timestamp: Date.now(),
        }
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, message], updatedAt: Date.now() }
              : s
          ),
        }))
        return message
      },

      updateMessage: (sessionId, messageId, updates) =>
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map(m =>
                    m.id === messageId ? { ...m, ...updates } : m
                  ),
                }
              : s
          ),
        })),

      appendToMessage: (sessionId, messageId, chunk) =>
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map(m =>
                    m.id === messageId
                      ? { ...m, content: m.content + chunk }
                      : m
                  ),
                }
              : s
          ),
        })),

      deleteMessage: (sessionId, messageId) =>
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? { ...s, messages: s.messages.filter(m => m.id !== messageId) }
              : s
          ),
        })),

      setStreaming: (streaming, messageId) =>
        set({ isStreaming: streaming, streamingMessageId: messageId ?? null }),

      getActiveSession: () => {
        const { sessions, activeSessionId } = get()
        return sessions.find(s => s.id === activeSessionId) ?? null
      },

      getActiveMessages: () => {
        const session = get().getActiveSession()
        return session?.messages ?? []
      },

      clearSession: (sessionId) =>
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId ? { ...s, messages: [], updatedAt: Date.now() } : s
          ),
        })),
    }),
    {
      name: 'bertos-chat',
      partialize: (state) => ({
        sessions: state.sessions.map(s => ({
          ...s,
          messages: s.messages.slice(-100),
        })),
        activeSessionId: state.activeSessionId,
      }),
    }
  )
)
