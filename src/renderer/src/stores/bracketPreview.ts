import { defineStore } from 'pinia'
import { getBackendUrl } from '../services/backendConfig'

interface BracketPreviewMatch {
  id: string
  groupName: string
  teamA: { id: string; name: string; logoUrl: string | null }
  teamB: { id: string; name: string; logoUrl: string | null } | null
}

interface BracketPreview {
  championship: string
  teamCount: number
  round1Matches: BracketPreviewMatch[]
  totalRounds: number
}

export const useBracketPreviewStore = defineStore('bracketPreview', {
  state: () => ({
    preview: null as BracketPreview | null,
    loading: false
  }),
  actions: {
    async fetchPreview(championship: string) {
      this.loading = true
      try {
        const res = await fetch(`${getBackendUrl()}/api/bracket/${championship}`)
        this.preview = await res.json()
      } finally {
        this.loading = false
      }
    }
  }
})
