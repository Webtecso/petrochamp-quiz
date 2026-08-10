import { io, type Socket } from 'socket.io-client'
import { getBackendUrl } from './backendConfig'

let socketInstance: Socket | null = null

export function connectSocket(forceReconnect = false): Socket {
  if (socketInstance && socketInstance.connected && !forceReconnect) {
    return socketInstance
  }
  if (socketInstance) {
    socketInstance.disconnect()
  }
  socketInstance = io(getBackendUrl(), { autoConnect: true })
  return socketInstance
}

export function getSocket(): Socket {
  if (!socketInstance) {
    throw new Error('Socket ainda não foi ligado.')
  }
  return socketInstance
}
