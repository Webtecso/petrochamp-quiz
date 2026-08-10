<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useTeamsStore } from '../stores/teams'
import TeamAvatar from './TeamAvatar.vue'

const props = defineProps<{
  rankings: { teamId: string; name: string; institution: string; score: number }[]
  eliminatedTeamIds: string[]
}>()

const teamsStore = useTeamsStore()

function logoFor(teamId: string): string | undefined {
  return teamsStore.teamById(teamId)?.logoUrl ?? undefined
}

const ranked = computed(() => [...props.rankings].sort((a, b) => b.score - a.score))
const maxScore = computed(() => Math.max(...props.rankings.map((t) => t.score), 1))

const medalStyles = [
  'bg-gradient-to-br from-yellow-300 to-yellow-500 text-white',
  'bg-gradient-to-br from-gray-200 to-gray-400 text-white',
  'bg-gradient-to-br from-amber-500 to-amber-700 text-white'
]

const barsReady = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    setTimeout(() => {
      barsReady.value = true
    }, 100)
  })
})

function isEliminated(teamId: string): boolean {
  return props.eliminatedTeamIds.includes(teamId)
}
</script>

<template>
  <div v-if="!ranked.length" class="text-center text-sm text-gray-400 max-w-md mx-auto">
    Ainda não há partidas concluídas nesta fase. O ranking aparece aqui assim que a primeira partida terminar.
  </div>

  <div v-else class="max-w-2xl mx-auto flex flex-col gap-3 w-full">
    <div
      v-for="(team, i) in ranked"
      :key="team.teamId"
      class="bg-white rounded-xl shadow p-4 flex items-center gap-4 ranking-row transition-opacity"
      :class="[i === 0 ? 'ring-2 ring-yellow-300 leader-glow' : '', isEliminated(team.teamId) ? 'opacity-50' : '']"
      :style="{ animationDelay: i * 0.12 + 's' }"
    >
      <div
        class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
        :class="i < 3 ? medalStyles[i] : 'bg-gray-100 text-gray-500'"
      >
        {{ i + 1 }}º
      </div>

      <TeamAvatar :name="team.name" :logo-url="logoFor(team.teamId)" size="md" />

      <div class="flex-1">
        <div class="flex items-center justify-between mb-1">
          <span class="font-semibold">{{ team.name }}</span>
          <div class="flex items-center gap-2">
            <span
              v-if="!isEliminated(team.teamId)"
              class="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
            >
              AVANÇA
            </span>
            <span v-else class="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              ELIMINADA
            </span>
            <span class="text-petro-primary font-bold">{{ team.score }} pts</span>
          </div>
        </div>
        <div class="text-xs text-gray-400 mb-1">{{ team.institution }}</div>
        <div class="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-petro-primary to-red-400 rounded-full transition-all duration-1000 ease-out"
            :style="{ width: (barsReady ? (team.score / maxScore) * 100 : 0) + '%' }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ranking-row {
  animation: rowSlideIn 0.5s ease both;
}
@keyframes rowSlideIn {
  from { opacity: 0; transform: translateX(-16px); }
  to { opacity: 1; transform: translateX(0); }
}
.leader-glow {
  animation: rowSlideIn 0.5s ease both, leaderPulse 2.4s ease-in-out infinite 0.6s;
}
@keyframes leaderPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.3); }
  50% { box-shadow: 0 0 0 8px rgba(250, 204, 21, 0); }
}
</style>
