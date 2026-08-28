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

// Chave usada para persistir o código do moderador em localStorage, para
// sobreviver a um restart completo da app (Electron reiniciado, F5,
// etc.), não só a reconexões de socket dentro da mesma sessão do processo.
const STORAGE_KEY = 'petrochamp:moderatorCode'

export const useModeratorStore = defineStore('moderatorSession', {
  state: () => ({
    session: null as ModeratorSession | null,
    // Guarda o código introduzido para poder reenviar
    // 'moderator:register' automaticamente sempre que o socket
    // reconectar ou for substituído por um novo (rede instável, app em
    // background, mudança de IP/túnel via configSync, navegação que
    // force um novo connectSocket(), etc.). Sem isto, o servidor
    // perdia a noção de que este socket era o moderador
    // principal/secundário — o Pinia 'session' continuava com o role
    // antigo no ecrã, mas o backend já não reconhecia esse socket como
    // tal, e todas as ações restritas por área (ex: Iniciar Tempo,
    // Avançar Apresentação) ficavam silenciosamente bloqueadas sem
    // nenhum aviso.
    //
    // CORRIGIDO — antes 'lastCode' só existia em memória (estado
    // Pinia), por isso um restart COMPLETO da app (não uma simples
    // reconexão de socket) perdia-o por completo: a store nascia do
    // zero com lastCode null, e como attachReconnectListener()/
    // subscribeToSocketChanges() só eram chamados a partir de
    // register() — que só corre no login manual — NADA reenviava o
    // registo depois de um restart. O moderador ficava bloqueado em
    // todas as ações restritas por área até alguém voltar a fazer
    // login manualmente no ecrã do moderador. Agora lastCode é
    // inicializado a partir do localStorage (persiste entre restarts)
    // e initFromStorage() dispara o re-registo automaticamente assim
    // que a store nasce, sem depender de nenhuma ação do utilizador.
    lastCode: (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as
      | string
      | null,
    // Referência do socket ao qual o listener 'connect' já foi
    // anexado. attachReconnectListener() compara isto com o socket
    // atual e só sai cedo se for exatamente o mesmo objeto.
    registeredSocket: null as Socket | null,
    // Subscrevemos 'onSocketRecreated()' UMA ÚNICA VEZ por sessão do
    // store (guardado por este boolean, que é seguro porque não
    // depende de qual socket existe — é "já subscrevi ao evento
    // global de recriação", não "já anexei o listener a este socket").
    // Sempre que um socket novo nascer em QUALQUER parte da app,
    // somos avisados e reanexamos o listener + tentamos o re-registo.
    subscribedToSocketChanges: false,
    // NOVO — evita chamar initFromStorage() mais que uma vez por
    // sessão do store (idempotência, tal como subscribedToSocketChanges).
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
      // NOVO — persiste o código assim que um login (manual ou
      // automático) é tentado, para sobreviver a um restart completo.
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, code)
      }
      this.attachReconnectListener()
      this.subscribeToSocketChanges()
      return new Promise((resolve) => {
        getSocket().emit('moderator:register', { code }, (res: RegisterResult) => {
          if (res.success && res.moderatorId && res.role && res.name) {
            this.session = {
              id: res.moderatorId,
              role: res.role,
              name: res.name,
              areas: res.areas || []
            }
          } else if (!res.success) {
            // NOVO — código guardado já não é válido (ex: moderador
            // removido/recriado no Admin) — limpa para não ficar em
            // loop de tentativas silenciosas com um código morto.
            this.logout()
          }
          resolve(res)
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
        // tenta logo o re-registo — o novo socket já pode estar
        // ligado no momento em que este callback corre.
        this.attachReconnectListener()
        if (this.lastCode) {
          this.register(this.lastCode)
        }
      })
    },

    // NOVO — chamado UMA VEZ, o mais cedo possível no arranque da área
    // do moderador (ver ModeradorLayout.vue). Se houver um código
    // guardado de uma sessão anterior (restart completo da app, reload
    // da página, etc.), tenta o re-registo imediatamente, sem depender
    // de o utilizador voltar a passar pelo ecrã de login. Também
    // garante que os listeners de reconexão ficam montados desde o
    // início, não só depois do primeiro login manual.
    //
    // subscribeToSocketChanges() é chamado ANTES do try/catch de
    // propósito: não depende de getSocket() já existir, por isso nunca
    // falha aqui — mesmo que o socket inicial ainda não tenha sido
    // criado neste momento (ex: ModeradorLayout montou antes do
    // connectSocket() inicial correr), a subscrição fica pronta e o
    // re-registo automático dispara assim que o primeiro socket nascer.
    initFromStorage() {
      if (this.initializedFromStorage) return
      this.initializedFromStorage = true
      this.subscribeToSocketChanges()
      try {
        this.attachReconnectListener()
        if (this.lastCode) {
          this.register(this.lastCode)
        }
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
