import { defineStore } from 'pinia'
import { api } from '../services/api'
import type { Team, ChampionshipType } from './campeonato'

export const useTeamsStore = defineStore('teamsRoster', {
  state: () => ({
    teams: [] as Team[]
  }),
  getters: {
    teamsForCategory: (state) => {
      return (category: ChampionshipType): Team[] => state.teams.filter((t) => t.category === category)
    },
    teamById: (state) => {
      return (id: string): Team | undefined => state.teams.find((t) => t.id === id)
    }
  },
  actions: {
    async fetchTeams() {
      this.teams = await api.get<Team[]>('/teams')
    },
    async addTeam(team: Omit<Team, 'id'>) {
      await api.post('/teams', team)
      await this.fetchTeams()
    },
    async updateTeam(id: string, patch: Partial<Team>) {
      const current = this.teamById(id)
      if (!current) return
      await api.put(`/teams/${id}`, { ...current, ...patch })
      await this.fetchTeams()
    },
    async deleteTeam(id: string) {
      await api.delete(`/teams/${id}`)
      await this.fetchTeams()
    }
  }
})
