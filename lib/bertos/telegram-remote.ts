export type TelegramRemoteEventType = 'incoming' | 'reply' | 'running' | 'completed' | 'failed' | 'ignored'

export interface TelegramRemoteEvent {
  id: string
  type: TelegramRemoteEventType
  timestamp: number
  chatId?: string
  command?: string
  text?: string
  detail?: string
}

interface TelegramRemoteState {
  events: TelegramRemoteEvent[]
  lastCommand?: string
  lastSeenAt?: number
}

const MAX_EVENTS = 80
const stateKey = '__bertosTelegramRemoteState'

function getState(): TelegramRemoteState {
  const globalState = globalThis as typeof globalThis & { [stateKey]?: TelegramRemoteState }
  if (!globalState[stateKey]) {
    globalState[stateKey] = { events: [] }
  }
  return globalState[stateKey]
}

function redactChatId(chatId?: string | number) {
  if (chatId === undefined || chatId === null) return undefined
  const value = String(chatId)
  if (value.length <= 4) return '***'
  return `${value.slice(0, 4)}***`
}

export function recordTelegramRemoteEvent(event: Omit<TelegramRemoteEvent, 'id' | 'timestamp' | 'chatId'> & { chatId?: string | number }) {
  const state = getState()
  const timestamp = Date.now()
  const record: TelegramRemoteEvent = {
    ...event,
    id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    chatId: redactChatId(event.chatId),
    text: event.text?.slice(0, 240),
    detail: event.detail?.slice(0, 500),
  }
  state.events = [record, ...state.events].slice(0, MAX_EVENTS)
  state.lastSeenAt = timestamp
  if (event.command) state.lastCommand = event.command
  return record
}

export function getTelegramRemoteState() {
  const state = getState()
  return {
    ...state,
    events: state.events,
  }
}
