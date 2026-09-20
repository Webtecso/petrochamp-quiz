import { defineStore } from 'pinia'
import { getSocket } from '../services/socket'

const JUROR_SESSION_STORAGE_KEY = 'petrochamp:jurorSession'

interface StoredJurorSession {
  code: string
  jurorId: string
}

function loadStoredJurorSession(): StoredJurorSession | null {
  try {
    const raw = localStorage.getItem(JUROR_SESSION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredJurorSession
  } catch {
    return null
  }
}

function saveStoredJurorSession(session: StoredJurorSession): void {
  try {
    localStorage.setItem(JUROR_SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
  }
}

export interface Juror {
  id: string
  name: string
}

interface ScoreEntry {
  jurorId: string
  itemId: string
  scoreA: number
  scoreB: number
}

interface InitialScoreEntry {
  jurorId: string
  scoreA: number
  scoreB: number
}

interface JurorSyncPayload {
  jurors?: Juror[]
  jurorEntries?: ScoreEntry[]
  jurorSubmittedItemIds?: string[]
  initialScoreEntries?: InitialScoreEntry[]
  initialScoresConfirmed?: boolean
}

export const useJuradosStore = defineStore('jurados', {
  state: () => ({
    jurors: [] as Juror[],
    entries: [] as ScoreEntry[],
    submittedItemIds: [] as string[],
    initialEntries: [] as InitialScoreEntry[],
    initialScoresConfirmed: false,
    // NOVO - id do jurado registado NESTE dispositivo. Antes não existia
    // nenhum estado local para isto, e a JuradosView.vue já referenciava
    // `jurados.myJurorId` (para decidir se mostra o formulário de
    // registo) sem o store alguma vez o definir - ficava sempre
    // undefined, e o formulário de registo dependia só de
    // `jurors.length`.
    myJurorId: null as string | null,
    // NOVO - pendingScores guarda o que o jurado está a escrever
    // AGORA MESMO neste dispositivo, antes de ser confirmado ao
    // servidor. Isto é o que resolve a lentidão: o valor mostrado no
    // input vem daqui primeiro (instantâneo), e só depois de um pequeno
    // intervalo sem novas teclas é que emitimos ao socket - em vez de
    // emitir (e provocar um broadcast do liveState inteiro) a cada
    // caractere digitado.
    pendingScores: {} as Record<string, { scoreA?: number; scoreB?: number }>,
    pendingInitialScores: {} as Record<string, { scoreA?: number; scoreB?: number }>
  }),
  actions: {
    async restoreSession(): Promise<void> {
      const stored = loadStoredJurorSession()
      if (!stored) return
      const result = await this.registerJuror(stored.code)
      if (!result.success) {
        try {
          localStorage.removeItem(JUROR_SESSION_STORAGE_KEY)
        } catch {
        }
      }
    },
    listenForReconnect() {
      getSocket().on('connect', () => {
        if (this.myJurorId) {
          const stored = loadStoredJurorSession()
          if (stored && stored.jurorId === this.myJurorId) {
            this.registerJuror(stored.code)
          }
        }
      })
    },
    listenToServer() {
      getSocket().on('state:sync', (incoming: JurorSyncPayload) => {
        if (incoming.jurors) this.jurors = incoming.jurors
        if (incoming.jurorEntries) {
          this.entries = incoming.jurorEntries
          // Assim que o servidor confirma um valor, limpamos o pendente
          // correspondente - evita que um valor "pendente" antigo fique
          // para sempre a sobrepor-se ao valor real do servidor.
          for (const key of Object.keys(this.pendingScores)) {
            const [jurorId, itemId] = key.split('::')
            const confirmed = incoming.jurorEntries.find((e) => e.jurorId === jurorId && e.itemId === itemId)
            if (confirmed) delete this.pendingScores[key]
          }
        }
        if (incoming.jurorSubmittedItemIds) this.submittedItemIds = incoming.jurorSubmittedItemIds
        if (incoming.initialScoreEntries) {
          this.initialEntries = incoming.initialScoreEntries
          for (const jurorId of Object.keys(this.pendingInitialScores)) {
            const confirmed = incoming.initialScoreEntries.find((e) => e.jurorId === jurorId)
            if (confirmed) delete this.pendingInitialScores[jurorId]
          }
        }
        if (incoming.initialScoresConfirmed !== undefined) this.initialScoresConfirmed = incoming.initialScoresConfirmed
      })
    },
    async registerJuror(code: string): Promise<{ success: boolean; jurorId?: string; error?: string }> {
      return new Promise((resolve) => {
        getSocket().emit('juror:register', { code }, (res: { success: boolean; jurorId?: string; error?: string }) => {
          if (res.success && res.jurorId) {
            this.myJurorId = res.jurorId
            saveStoredJurorSession({ code, jurorId: res.jurorId })
          }
          resolve(res)
        })
      })
    },
    async registerJurorLocally(jurorId: string): Promise<{ success: boolean; error?: string }> {
      return new Promise((resolve) => {
        getSocket().emit(
          'moderator:registerJurorLocally',
          { jurorId },
          (res: { success: boolean; error?: string }) => resolve(res)
        )
      })
    },
    removeJuror(id: string) {
      getSocket().emit('moderator:removeJuror', { jurorId: id })
    },
    // CORRIGIDO - antes emitia diretamente ao socket a cada chamada
    // (ou seja, a cada tecla digitada no input, já que a UI chama isto
    // em @input). Agora atualiza primeiro o valor pendente local
    // (refletido de imediato no ecrã do jurado) e só emite ao servidor
    // depois de 400ms sem nova alteração - reduz drasticamente o
    // volume de broadcasts de liveState e elimina a sensação de
    // lentidão/"não grava".
    setEntry(jurorId: string, itemId: string, scoreA: number, scoreB: number) {
      const key = `${jurorId}::${itemId}`
      this.pendingScores[key] = { scoreA, scoreB }
      this.debouncedEmitScore(key, jurorId, itemId, scoreA, scoreB)
    },
    _scoreDebounceHandles: {} as Record<string, ReturnType<typeof setTimeout>>,
    debouncedEmitScore(key: string, jurorId: string, itemId: string, scoreA: number, scoreB: number) {
      const handles = (this as any)._scoreDebounceHandles as Record<string, ReturnType<typeof setTimeout>>
      if (handles[key]) clearTimeout(handles[key])
      handles[key] = setTimeout(() => {
        getSocket().emit('juror:setScore', { jurorId, itemId, scoreA, scoreB })
        delete handles[key]
      }, 400)
    },
    entryFor(jurorId: string, itemId: string): ScoreEntry | undefined {
      const key = `${jurorId}::${itemId}`
      const pending = this.pendingScores[key]
      const confirmed = this.entries.find((e) => e.jurorId === jurorId && e.itemId === itemId)
      if (!pending) return confirmed
      // Mistura o pendente local com o confirmado, para não perder o
      // lado (A ou B) que ainda não foi tocado neste input.
      return {
        jurorId,
        itemId,
        scoreA: pending.scoreA ?? confirmed?.scoreA ?? 0,
        scoreB: pending.scoreB ?? confirmed?.scoreB ?? 0
      }
    },
    totalsForItem(itemId: string): { totalA: number; totalB: number } {
      const relevant = this.entries.filter((e) => e.itemId === itemId)
      return {
        totalA: relevant.reduce((sum, e) => sum + e.scoreA, 0),
        totalB: relevant.reduce((sum, e) => sum + e.scoreB, 0)
      }
    },
    confirmItem(itemId: string) {
      getSocket().emit('moderator:confirmEvaluation', { itemId })
    },
    isSubmitted(itemId: string): boolean {
      return this.submittedItemIds.includes(itemId)
    },
    // CORRIGIDO - mesmo tratamento de debounce local para as Notas
    // Iniciais.
    setInitialScore(jurorId: string, scoreA: number, scoreB: number) {
      this.pendingInitialScores[jurorId] = { scoreA, scoreB }
      this.debouncedEmitInitialScore(jurorId, scoreA, scoreB)
    },
    _initialScoreDebounceHandles: {} as Record<string, ReturnType<typeof setTimeout>>,
    debouncedEmitInitialScore(jurorId: string, scoreA: number, scoreB: number) {
      const handles = (this as any)._initialScoreDebounceHandles as Record<string, ReturnType<typeof setTimeout>>
      if (handles[jurorId]) clearTimeout(handles[jurorId])
      handles[jurorId] = setTimeout(() => {
        getSocket().emit('juror:setInitialScore', { jurorId, scoreA, scoreB })
        delete handles[jurorId]
      }, 400)
    },
    initialEntryFor(jurorId: string): InitialScoreEntry | undefined {
      const pending = this.pendingInitialScores[jurorId]
      const confirmed = this.initialEntries.find((e) => e.jurorId === jurorId)
      if (!pending) return confirmed
      return {
        jurorId,
        scoreA: pending.scoreA ?? confirmed?.scoreA ?? 0,
        scoreB: pending.scoreB ?? confirmed?.scoreB ?? 0
      }
    },
    confirmInitialScores() {
      getSocket().emit('moderator:confirmInitialScores')
    }
  }
})
