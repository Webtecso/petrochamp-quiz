<script setup lang="ts">
import { onMounted } from 'vue'
import { useCampeonatoStore } from '../stores/campeonato'
import { useTeamsStore } from '../stores/teams'
import PhaseRankingBoard from '../components/PhaseRankingBoard.vue'

const store = useCampeonatoStore()
const teamsStore = useTeamsStore()

onMounted(() => {
  teamsStore.fetchTeams()
})

function toggleShowOnScreen(): void {
  if (store.phaseRankingReveal?.visible) {
    store.hidePhaseRanking?.()
  } else {
    store.showPhaseRanking?.()
  }
}
</script>

<template>
  <div class="flex-1 px-10 py-8">
    <div class="flex items-center justify-between max-w-2xl mx-auto mb-6">
      <h1 class="text-2xl font-bold text-petro-primary">Ranking da Fase {{ store.phase }}</h1>
      <button
        class="text-xs font-semibold px-4 py-2 rounded-lg transition"
        :class="store.phaseRankingReveal?.visible ? 'bg-petro-primary text-white' : 'bg-petro-primary/10 text-petro-primary'"
        @click="toggleShowOnScreen"
      >
        {{ store.phaseRankingReveal?.visible ? 'A mostrar no Telão ✓' : 'Mostrar no Telão' }}
      </button>
    </div>

    <PhaseRankingBoard :rankings="store.phaseRankings ?? []" :eliminated-team-ids="store.eliminatedTeamIds ?? []" />
  </div>
</template>
