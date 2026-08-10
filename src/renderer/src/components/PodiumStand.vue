<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { PodiumEntry } from '../data/podiumResults'
import { useTeamsStore } from '../stores/teams'
import TeamAvatar from './TeamAvatar.vue'

const props = defineProps<{
  rank: 1 | 2 | 3
  entry: PodiumEntry
}>()

const teamsStore = useTeamsStore()
const logoUrl = computed(() => teamsStore.teamById(props.entry.id)?.logoUrl)

const rankStyles: Record<number, { stand: string; height: string; order: string; delay: string; startDelay: number }> = {
  1: { stand: 'bg-gradient-to-b from-yellow-300 via-yellow-400 to-yellow-600', height: 'h-44', order: 'order-2', delay: '1.1s', startDelay: 1500 },
  2: { stand: 'bg-gradient-to-b from-gray-200 via-gray-300 to-gray-500', height: 'h-28', order: 'order-1', delay: '0.1s', startDelay: 450 },
  3: { stand: 'bg-gradient-to-b from-amber-500 via-amber-600 to-amber-800', height: 'h-20', order: 'order-3', delay: '0.55s', startDelay: 900 }
}

const displayedScore = ref(0)
onMounted(() => {
  const target = props.entry.score
  const steps = 30
  const increment = target / steps
  let current = 0
  setTimeout(() => {
    const handle = setInterval(() => {
      current += increment
      if (current >= target) {
        displayedScore.value = target
        clearInterval(handle)
      } else {
        displayedScore.value = Math.round(current)
      }
    }, 900 / steps)
  }, rankStyles[props.rank].startDelay)
})
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 podium-stand-enter"
    :class="rankStyles[rank].order"
    :style="{ animationDelay: rankStyles[rank].delay }"
  >
    <div
      class="bg-white/95 rounded-2xl shadow-lg px-4 py-3 flex flex-col items-center gap-1 w-40 relative"
      :class="rank === 1 ? 'winner-glow' : ''"
    >
      <span v-if="rank === 1" class="absolute -top-4 text-3xl crown-bounce">👑</span>
      <TeamAvatar :name="entry.name" :logo-url="logoUrl" size="lg" :ring="rank === 1" />
      <div class="font-semibold text-sm text-center mt-1">{{ entry.name }}</div>
      <div class="text-[11px] text-gray-400 text-center leading-tight">{{ entry.institution }}</div>
      <div class="flex items-center gap-1 text-petro-primary font-bold text-sm mt-1">★ {{ displayedScore }} PTS</div>
    </div>

    <div
      class="w-28 rounded-t-lg flex items-center justify-center text-white font-bold text-2xl shadow-inner relative overflow-hidden"
      :class="[rankStyles[rank].stand, rankStyles[rank].height]"
    >
      <div class="stand-sheen"></div>
      <span class="relative z-10">{{ rank }}º</span>
    </div>
  </div>
</template>

<style scoped>
.podium-stand-enter {
  animation: standRise 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes standRise {
  from { opacity: 0; transform: translateY(60px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.winner-glow {
  box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.6), 0 8px 30px rgba(0, 0, 0, 0.2);
  animation: winnerBreathe 2.4s ease-in-out infinite 2s;
}
@keyframes winnerBreathe {
  0%, 100% { box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.6), 0 8px 30px rgba(0, 0, 0, 0.2); }
  50% { box-shadow: 0 0 0 6px rgba(250, 204, 21, 0.35), 0 8px 30px rgba(0, 0, 0, 0.2); }
}
.crown-bounce {
  animation: crownBounce 1.8s ease-in-out infinite 2s;
}
@keyframes crownBounce {
  0%, 100% { transform: translateY(0) rotate(-4deg); }
  50% { transform: translateY(-6px) rotate(4deg); }
}
.stand-sheen {
  position: absolute;
  top: 0;
  left: -60%;
  width: 40%;
  height: 100%;
  background: linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.5), transparent);
  animation: sheenSweep 3.5s ease-in-out infinite;
}
@keyframes sheenSweep {
  0% { left: -60%; }
  50% { left: 120%; }
  100% { left: 120%; }
}
</style>
