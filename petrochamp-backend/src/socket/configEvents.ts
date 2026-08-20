import type { Server } from 'socket.io'
import { liveState } from './liveState'

let ioInstance: Server | null = null

export function initConfigEvents(io: Server): void {
  ioInstance = io
}

export type ConfigType =
  | 'teams'
  | 'questions'
  | 'evaluationItems'
  | 'tiebreakQuestions'
  | 'phases'
  | 'jurors'
  | 'partners'
  | 'suspensePhrases'
  | 'presentation'

export function emitConfigUpdated(type: ConfigType, championship?: string | null): void {
  if (!ioInstance) return
  ioInstance.emit('config:updated', { type, championship: championship ?? null })
}

// Usado por sítios fora do socket/index.ts (ex: rotas HTTP como adminAuth)
// que precisam de notificar os clientes de uma mudança no liveState.
export function broadcastLiveState(): void {
  if (!ioInstance) return
  ioInstance.emit('state:sync', liveState)
}
