import { io, type Socket } from 'socket.io-client'
import { getBackendUrl } from './backendConfig'

let socketInstance: Socket | null = null

// O backend Cloud (Render) não tem Socket.io por design — só o backend
// local, na LAN do evento, trata do tempo real. No build Admin Cloud,
// VITE_CLOUD_API_URL está sempre definida, por isso serve de sinal seguro
// para saltar a ligação e evitar tentativas de handshake que dão 404.
const isAdminCloudBuild = Boolean(import.meta.env.VITE_CLOUD_API_URL)

export function connectSocket(forceReconnect = false): Socket | null {
  if (isAdminCloudBuild) {
    return null
  }

  const targetUrl = getBackendUrl()

  // Se já há uma ligação ativa e é para o MESMO endereço, reaproveita-a.
  // Se o endereço mudou (ex: jogador ligou-se a uma sala, saiu, e entrou
  // noutra com um IP diferente) força reconexão mesmo sem forceReconnect,
  // senão ficaria preso a ligar sempre ao primeiro endereço usado.
  if (socketInstance && socketInstance.connected && !forceReconnect && socketInstance.io.uri === targetUrl) {
    return socketInstance
  }
  if (socketInstance) {
    socketInstance.disconnect()
  }

  socketInstance = io(targetUrl, {
    autoConnect: true,
    transports: ['websocket', 'polling']
  })

  return socketInstance
}

export function getSocket(): Socket {
  if (!socketInstance) {
    throw new Error('Socket ainda não foi ligado.')
  }
  return socketInstance
}
