import { defineStore } from 'pinia'
import type { Socket } from 'socket.io-client'
import { getSocket, onSocketRecreated } from '../services/socket'

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

// Código do moderador guardado apenas após login válido. Não reativa a
// sessão automaticamente ao entrar no painel, porque isso faz saltar
// imediatamente um moderador gravado em localStorage sem pedir o login.
const STORAGE_KEY = 'petrochamp:moderatorCode'

export const useModeratorStore = defineStore('moderatorSession', {
  state: () => ({
    session: null as ModeratorSession | null,
    // Guarda o código introduzido para poder reenviar
    // 'moderator:register' automaticamente sempre que o socket
    // reconectar ou for substituído por um novo (rede instável, app em
    // background, mudança de IP/túnel via configSync, navegação que
    // force um novo connectSocket(), etc.).
    lastCode: null as string | null,
    // Referência do socket ao qual o listener 'connect' já foi
    // anexado. attachReconnectListener() compara isto com o socket
    // atual e só sai cedo se for exatamente o mesmo objeto.
    registeredSocket: null as Socket | null,
    // Subscrevemos 'onSocketRecreated()' UMA ÚNICA VEZ por sessão do
    // store (guardado por este boolean, que é seguro porque não
    // depende de qual socket existe - é "já subscrevi ao evento
    // global de recriação", não "já anexei o listener a este socket").
    // Sempre que um socket novo nascer em QUALQUER parte da app,
    // somos avisados e reanexamos o listener + tentamos o re-registo.
    subscribedToSocketChanges: false,
    // Mantém o estado inicial do store sem reativar uma sessão em arranque.
    initializedFromStorage: false
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
      // Guarda apenas após login válido. Evita que a app volte a abrir
      // directamente com um moderador salvo em localStorage sem pedir
      // autenticação ao utilizador.
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, code)
      }
      this.attachReconnectListener()
      this.subscribeToSocketChanges()
      return new Promise((resolve) => {
        let settled = false
        const finish = (res: RegisterResult) => {
          if (settled) return
          settled = true
          if (res.success && res.moderatorId && res.role && res.name) {
            this.session = {
              id: res.moderatorId,
              role: res.role,
              name: res.name,
              areas: res.areas || []
            }
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, code)
            }
          } else if (!res.success) {
            this.logout()
          }
          resolve(res)
        }
        const timeout = setTimeout(
          () => finish({ success: false, error: 'Não foi possível ligar ao servidor. Confirma o endereço e se o backend está em execução.' }),
          8000
        )
        getSocket().emit('moderator:register', { code }, (res: RegisterResult) => {
          clearTimeout(timeout)
          finish(res)
        })
      })
    },

    // Assim que o socket ATUAL (re)conecta, reenvia o registo com o
    // último código usado, para o servidor voltar a reconhecer este
    // socket com o role correto. Idempotente: registar o mesmo
    // moderador outra vez não causa problema no backend.
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

    // Subscreve ao evento global "um socket novo nasceu", disparado
    // por 'services/socket.ts' sempre que 'connectSocket()' cria uma
    // instância de raiz (não uma reconexão automática do mesmo objeto,
    // que o socket.io-client já trata sozinho). Isto cobre o caso em
    // que o socket muda por causas fora do controlo desta store (troca
    // de túnel/IP, navegação entre painéis, etc.) sem que 'register()'
    // tenha sido chamado de novo manualmente.
    subscribeToSocketChanges() {
      if (this.subscribedToSocketChanges) return
      this.subscribedToSocketChanges = true
      onSocketRecreated(() => {
        // Reanexa o listener 'connect' ao socket novo e, já agora,
        // tenta logo o re-registo - o novo socket já pode estar
        // ligado no momento em que este callback corre.
        this.attachReconnectListener()
        if (this.lastCode) {
          this.register(this.lastCode)
        }
      })
    },

    // Mantém a lógica de socket vivo, mas não reativa uma sessão em arranque.
    // O login continua a ser explícito para evitar que o moderador principal
    // entre automaticamente sem autenticação.
    initFromStorage() {
      if (this.initializedFromStorage) return
      this.initializedFromStorage = true
      this.subscribeToSocketChanges()
      try {
        this.attachReconnectListener()
      } catch (err) {
        console.warn('[moderatorStore] Socket ainda não disponível ao inicializar:', err)
      }
    },

    logout() {
      this.session = null
      this.lastCode = null
      this.registeredSocket = null
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }
})
