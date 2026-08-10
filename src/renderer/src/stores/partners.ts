import { defineStore } from 'pinia'
import { api } from '../services/api'

export interface Partner {
  id: number
  name: string
  logoUrl: string
  order: number
}

export const usePartnersStore = defineStore('partners', {
  state: () => ({
    partners: [] as Partner[]
  }),
  actions: {
    async fetchPartners() {
      this.partners = await api.get<Partner[]>('/partners')
    },
    async addPartner(data: { name: string; logoUrl: string; order?: number }) {
      await api.post('/partners', data)
      await this.fetchPartners()
    },
    async updatePartner(id: number, patch: Partial<Partner>) {
      await api.put(`/partners/${id}`, patch)
      await this.fetchPartners()
    },
    async deletePartner(id: number) {
      await api.delete(`/partners/${id}`)
      await this.fetchPartners()
    }
  }
})
