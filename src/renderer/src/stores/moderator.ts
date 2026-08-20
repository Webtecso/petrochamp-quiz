import { defineStore } from 'pinia'
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
    session: null as ModeratorSession | null
  }),

  getters: {
    isPrincipal: (state) => state.session?.role === 'principal',
    isLoggedIn: (state) => !!state.session,
    hasArea: (state) => (area: string) =>
      state.session?.role === 'principal' || !!state.session?.areas.includes(area)
  },

  actions: {
    register(code: string): Promise<RegisterResult> {
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

    logout() {
      this.session = null
    }
  }
})
