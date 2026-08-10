import { defineStore } from 'pinia'
import { getSocket } from '../services/socket'

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
    initialScoresConfirmed: false
  }),
  actions: {
    listenToServer() {
      getSocket().on('state:sync', (incoming: JurorSyncPayload) => {
        if (incoming.jurors) this.jurors = incoming.jurors
        if (incoming.jurorEntries) this.entries = incoming.jurorEntries
        if (incoming.jurorSubmittedItemIds) this.submittedItemIds = incoming.jurorSubmittedItemIds
        if (incoming.initialScoreEntries) this.initialEntries = incoming.initialScoreEntries
        if (incoming.initialScoresConfirmed !== undefined) this.initialScoresConfirmed = incoming.initialScoresConfirmed
      })
    },
    registerJuror(code: string): Promise<{ success: boolean; jurorId?: string; error?: string }> {
      return new Promise((resolve) => {
        getSocket().emit('juror:register', { code }, (res: { success: boolean; jurorId?: string; error?: string }) =>
          resolve(res)
        )
      })
    },
    removeJuror(id: string) {
      getSocket().emit('moderator:removeJuror', { jurorId: id })
    },
    setEntry(jurorId: string, itemId: string, scoreA: number, scoreB: number) {
      getSocket().emit('juror:setScore', { jurorId, itemId, scoreA, scoreB })
    },
    entryFor(jurorId: string, itemId: string): ScoreEntry | undefined {
      return this.entries.find((e) => e.jurorId === jurorId && e.itemId === itemId)
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
    setInitialScore(jurorId: string, scoreA: number, scoreB: number) {
      getSocket().emit('juror:setInitialScore', { jurorId, scoreA, scoreB })
    },
    initialEntryFor(jurorId: string): InitialScoreEntry | undefined {
      return this.initialEntries.find((e) => e.jurorId === jurorId)
    },
    confirmInitialScores() {
      getSocket().emit('moderator:confirmInitialScores')
    }
  }
})
