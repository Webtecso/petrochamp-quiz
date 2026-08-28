import { io, type Socket } from 'socket.io-client'
import { getBackendUrl } from './backendConfig'

let socketInstance: Socket | null = null
let currentTargetUrl: string | null = null

// CORRIGIDO — antes, nada avisava quem quer que fosse quando
// 'connectSocket()' decidia criar um socket COMPLETAMENTE NOVO (troca de
// URL do backend/túnel detetada, ou 'forceReconnect'). Isso deixava a
// store do moderador (stores/moderator.ts) cega: o listener 'connect'
// que ela tinha anexado ficava preso ao socket ANTIGO já descartado, e
// como o re-registo do moderador só era despoletado a partir de
// 'register()' (chamado apenas no login manual), o socket novo nunca
// reenviava 'moderator:register' — o painel continuava a MOSTRAR a
// sessão como "Principal", mas o backend já não reconhecia esse socket
// como tal, bloqueando silenciosamente qualquer ação restrita por área.
//
// Agora, sempre que um socket novo é criado, avisamos todos os
// subscritores registados via 'onSocketRecreated', passando-lhes o
// socket novo. A store do moderador subscreve isto uma única vez (não
// ligado ao objeto socket, mas à store em si) e reage recriando o seu
// próprio registo de listener + reenviando 'moderator:register' se
// necessário.
type SocketChangeListener = (socket: Socket) => void
const socketChangeListeners = new Set<SocketChangeListener>()

export function onSocketRecreated(listener: SocketChangeListener): void {
  socketChangeListeners.add(listener)
}

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

  // Se já existe um socket ativo (ligado OU em processo de conexão) e o URL de destino
  // é rigorosamente o mesmo, reaproveita-se a instância. Isso impede que chamadas
  // simultâneas no arranque destruam e recriem o socket enquanto o handshake decorre.
  const isConnectingOrConnected = socketInstance && !socketInstance.disconnected
  const isSameUrl = currentTargetUrl === targetUrl

  if (isConnectingOrConnected && isSameUrl && !forceReconnect) {
    return socketInstance
  }

  // Se o endereço mudou ou se foi forçada a reconexão, limpa a instância antiga
  if (socketInstance) {
    socketInstance.removeAllListeners()
    socketInstance.disconnect()
  }

  currentTargetUrl = targetUrl

  socketInstance = io(targetUrl, {
    autoConnect: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
  })

  // Avisa quem estiver à escuta de que um socket NOVO acabou de nascer
  socketChangeListeners.forEach((listener) => listener(socketInstance!))

  return socketInstance
}

export function getSocket(): Socket {
  if (!socketInstance) {
    const socket = connectSocket()
    if (!socket) {
      throw new Error('Socket não pôde ser inicializado (Modo Cloud ou falha de configuração).')
    }
    return socket
  }
  return socketInstance
}

// Suporte para Hot Module Replacement (HMR) do Vite durante o desenvolvimento.
// Desconecta o socket de forma limpa quando este ficheiro é guardado/recarregado,
// evitando conexões fantasma e reconexões em loop no Electron.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (socketInstance) {
      socketInstance.removeAllListeners()
      socketInstance.disconnect()
      socketInstance = null
      currentTargetUrl = null
    }
  })
}
