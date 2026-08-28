<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useTeamsStore } from '../stores/teams'
import TeamAvatar from './TeamAvatar.vue'

const props = defineProps<{
  rankings: { teamId: string; name: string; institution: string; score: number }[]
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
</script>

<template>
  <div v-if="!ranked.length" class="text-center text-[clamp(0.9rem,1.2vw,1.3rem)] text-gray-400 max-w-md mx-auto">
    Ainda não há notas de apresentação registadas nesta fase.
  </div>

  <div v-else class="max-w-[clamp(32rem,55vw,60rem)] mx-auto flex flex-col gap-[clamp(0.6rem,1vh,1rem)] w-full">
    <div
      v-for="(team, i) in ranked"
      :key="team.teamId"
      class="bg-white rounded-xl shadow p-[clamp(0.75rem,1.4vw,1.5rem)] flex items-center gap-[clamp(0.75rem,1.4vw,1.5rem)] ranking-row"
      :class="i === 0 ? 'ring-2 ring-yellow-300 leader-glow' : ''"
      :style="{ animationDelay: i * 0.12 + 's' }"
    >
      <div
        class="w-[clamp(2.5rem,3.5vw,4.2rem)] h-[clamp(2.5rem,3.5vw,4.2rem)] rounded-full flex items-center justify-center font-bold text-[clamp(0.9rem,1.2vw,1.5rem)] shrink-0"
        :class="i < 3 ? medalStyles[i] : 'bg-gray-100 text-gray-500'"
      >
        {{ i + 1 }}º
      </div>

      <TeamAvatar :name="team.name" :logo-url="logoFor(team.teamId)" size="lg" />

      <div class="flex-1">
        <div class="flex items-center justify-between mb-1">
          <span class="font-semibold text-[clamp(1rem,1.5vw,1.8rem)]">{{ team.name }}</span>
          <span class="text-petro-primary font-bold text-[clamp(1rem,1.4vw,1.7rem)]">{{ team.score.toFixed(1) }} pts</span>
        </div>
        <div class="text-[clamp(0.75rem,1vw,1.1rem)] text-gray-400 mb-1">{{ team.institution }}</div>
        <div class="w-full h-[clamp(0.5rem,0.8vh,1rem)] bg-gray-100 rounded-full overflow-hidden">
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
  0%, 100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(250, 204, 21, 0); }
}
</style>
