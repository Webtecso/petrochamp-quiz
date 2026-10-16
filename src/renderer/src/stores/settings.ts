import { defineStore } from 'pinia'
import { api } from '../services/api'

interface SettingsPayload {
  questionTimeSeconds: number
  maxJurors: number
  showScoreOnProjection: boolean
  partnersDurationSeconds: number
  tiebreakAutoEnabled: boolean
  tiebreakMethod: string
  questionTextJustify?: boolean
  questionFontScale?: number
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    questionTimeSeconds: 30,
    maxJurors: 5,
    showScoreOnProjection: true,
    partnersDurationSeconds: 20,
    tiebreakAutoEnabled: false,
    tiebreakMethod: 'quiz',
    questionTextJustify: false,
    questionFontScale: 1
  }),
  actions: {
    async fetchSettings() {
      const data = await api.get<SettingsPayload>('/settings')
      this.questionTimeSeconds = data.questionTimeSeconds
      this.maxJurors = data.maxJurors
      this.showScoreOnProjection = data.showScoreOnProjection
      this.partnersDurationSeconds = data.partnersDurationSeconds
      this.tiebreakAutoEnabled = data.tiebreakAutoEnabled
      this.tiebreakMethod = data.tiebreakMethod
      this.questionTextJustify = Boolean(data.questionTextJustify)
      this.questionFontScale = Number(data.questionFontScale ?? 1)
    },
    async setQuestionTime(seconds: number) {
      const clamped = Math.max(5, Math.min(120, seconds))
      await api.put('/settings', {
        questionTimeSeconds: clamped,
        maxJurors: this.maxJurors,
        showScoreOnProjection: this.showScoreOnProjection,
        partnersDurationSeconds: this.partnersDurationSeconds
      })
      this.questionTimeSeconds = clamped
    },
    async setMaxJurors(count: number) {
      const clamped = Math.max(1, Math.min(10, count))
      await api.put('/settings', {
        questionTimeSeconds: this.questionTimeSeconds,
        maxJurors: clamped,
        showScoreOnProjection: this.showScoreOnProjection,
        partnersDurationSeconds: this.partnersDurationSeconds
      })
      this.maxJurors = clamped
    },
    async setShowScoreOnProjection(value: boolean) {
      await api.put('/settings', {
        questionTimeSeconds: this.questionTimeSeconds,
        maxJurors: this.maxJurors,
        showScoreOnProjection: value,
        partnersDurationSeconds: this.partnersDurationSeconds
      })
      this.showScoreOnProjection = value
    },
    // NOVO
    async setPartnersDuration(seconds: number) {
      const clamped = Math.max(5, Math.min(600, seconds))
      await api.put('/settings', {
        questionTimeSeconds: this.questionTimeSeconds,
        maxJurors: this.maxJurors,
        showScoreOnProjection: this.showScoreOnProjection,
        partnersDurationSeconds: clamped
      })
      this.partnersDurationSeconds = clamped
    },
    async setQuestionTextJustify(value: boolean) {
      await api.put('/settings', {
        questionTimeSeconds: this.questionTimeSeconds,
        maxJurors: this.maxJurors,
        showScoreOnProjection: this.showScoreOnProjection,
        partnersDurationSeconds: this.partnersDurationSeconds,
        questionTextJustify: value
      })
      this.questionTextJustify = value
    },
    // NOVO - multiplicador aplicado por cima do tamanho calculado pelo
    // auto-fit da Projecao, para o moderador poder pedir letra maior ou
    // menor sem mexer no algoritmo de ajuste automatico.
    async setQuestionFontScale(value: number) {
      const clamped = Math.max(0.7, Math.min(1.6, value))
      await api.put('/settings', {
        questionTimeSeconds: this.questionTimeSeconds,
        maxJurors: this.maxJurors,
        showScoreOnProjection: this.showScoreOnProjection,
        partnersDurationSeconds: this.partnersDurationSeconds,
        questionFontScale: clamped
      })
      this.questionFontScale = clamped
    },
    // NOVO - desempate automatico do 3o/4o lugar no podio final
    async setTiebreakConfig(autoEnabled: boolean, method: string) {
      await api.put('/settings', {
        questionTimeSeconds: this.questionTimeSeconds,
        maxJurors: this.maxJurors,
        showScoreOnProjection: this.showScoreOnProjection,
        partnersDurationSeconds: this.partnersDurationSeconds,
        tiebreakAutoEnabled: autoEnabled,
        tiebreakMethod: method
      })
      this.tiebreakAutoEnabled = autoEnabled
      this.tiebreakMethod = method
    }
  }
})
