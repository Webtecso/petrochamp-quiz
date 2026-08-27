import { defineStore } from 'pinia'
import type { Socket } from 'socket.io-client'
import { getSocket } from '../services/socket'

export interface ModeratorSession {
  id: string
  name: string
  role: 'principal' | 'secundario'
  areas: string[]
}

interface RegisterResult {
  success: boolean
  moderatorId?: string
  role?: 'principal' | 'secundario'
  name?: string
  areas?: string[]
  error?: string
}

export const useModeratorStore = defineStore('moderatorSession', {
  state: () => ({
    session: null as ModeratorSession | null,
    // Guarda o código introduzido para poder reenviar
    // 'moderator:register' automaticamente sempre que o socket
    // reconectar (rede instável, app em background, mudança de IP/túnel
    // via configSync, etc.). Sem isto, o servidor perdia a noção de que
    // este socket era o moderador principal/secundário depois de
    // qualquer reconexão — o Pinia 'session' continuava com o role
    // antigo no ecrã, mas o servidor já não reconhecia esse socket como
    // tal, e todas as ações restritas por área (ex: Iniciar Tempo,
    // Avançar Apresentação) ficavam silenciosamente bloqueadas sem
    // nenhum aviso.
    lastCode: null as string | null,
    // CORRIGIDO — antes isto era um boolean simples
    // ('reconnectListenerAttached'), que ficava 'true' para sempre
    // depois do primeiro attachReconnectListener(). Isso funcionava
    // para reconexões automáticas do MESMO socket (o socket.io-client
    // reconecta sozinho e reemite 'connect' no mesmo objeto), mas
    // 'services/socket.ts' por vezes cria um socket COMPLETAMENTE NOVO
    // via 'io(...)' — nomeadamente quando o endereço do backend muda
    // (troca de túnel/IP detetada pelo configSync). Um socket novo não
    // tem o listener 'connect' anexado, e como o boolean já estava
    // 'true', o listener nunca era reanexado a esse novo socket — o
    // moderador ficava então "anónimo" para o backend até fazer login
    // manual outra vez, apesar de a sessão continuar visível no ecrã.
    //
    // Agora guardamos a REFERÊNCIA do socket ao qual o listener já foi
    // anexado. attachReconnectListener() compara essa referência com o
    // socket atual (getSocket()) e só sai cedo se for exatamente o
    // mesmo objeto — se for um socket novo, reanexa o listener a ele.
    registeredSocket: null as Socket | null
  }),

  getters: {
    isPrincipal: (state) => state.session?.role === 'principal',
    isLoggedIn: (state) => !!state.session,
    hasArea: (state) => (area: string) =>
      state.session?.role === 'principal' || !!state.session?.areas.includes(area)
  },

  actions: {
    register(code: string): Promise<RegisterResult> {
      this.lastCode = code
      this.attachReconnectListener()
      return new Promise((resolve) => {
        getSocket().emit('moderator:register', { code }, (res: RegisterResult) => {
          if (res.success && res.moderatorId && res.role && res.name) {
            this.session = {
              id: res.moderatorId,
              role: res.role,
              name: res.name,
              areas: res.areas || []
            }
          }
          resolve(res)
        })
      })
    },

    // Assim que o socket (re)conecta — seja por reconexão automática do
    // MESMO objeto, seja porque 'connectSocket()' criou um objeto NOVO
    // (ex: mudança de IP/túnel) — reenvia o registo com o último código
    // usado, para o servidor voltar a reconhecer este socket com o role
    // correto. Idempotente: registar o mesmo moderador outra vez não
    // causa problema no backend.
    //
    // Chamado sempre a partir de register(), por isso qualquer troca de
    // socket é detetada e corrigida logo no próximo login manual — mas
    // também é seguro chamar isto isoladamente (ex: a partir de um
    // watcher que reaja a mudanças de socket) porque a comparação é
    // feita por referência do objeto socket atual, não por um boolean
    // "já corri uma vez".
    attachReconnectListener() {
      const socket = getSocket()
      if (this.registeredSocket === socket) return
      this.registeredSocket = socket
      socket.on('connect', () => {
        if (this.lastCode) {
          this.register(this.lastCode)
        }
      })
    },

    logout() {
      this.session = null
      this.lastCode = null
      this.registeredSocket = null
    }
  }
})
