<script setup lang="ts">
import { useTeamsStore } from '../stores/teams'
import TeamAvatar from './TeamAvatar.vue'

interface Slot {
  id: string
  name: string
}

const props = defineProps<{
  teamA?: Slot
  teamB?: Slot
  winnerId?: string
}>()

const teamsStore = useTeamsStore()

function logoFor(slot?: Slot): string | undefined {
  if (!slot) return undefined
  return teamsStore.teamById(slot.id)?.logoUrl ?? undefined
}

function rowClass(team?: Slot): string {
  if (!team) return 'text-gray-300 bg-gray-50 italic'
  if (!props.winnerId) return 'text-gray-700'
  if (team.id === props.winnerId) return 'bg-petro-primary text-white font-semibold winner-glow'
  return 'text-gray-500 opacity-70'
}
</script>

<template>
  <div class="bg-white rounded-xl shadow p-[clamp(0.6rem,1vw,1.1rem)] w-[clamp(11rem,17vw,19rem)] flex flex-col gap-1">
    <div
      class="flex items-center gap-[clamp(0.4rem,0.7vw,0.75rem)] px-[clamp(0.6rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)] rounded-lg text-[clamp(0.9rem,1.2vw,1.5rem)] transition-all duration-500"
      :class="rowClass(teamA)"
    >
      <TeamAvatar v-if="teamA" :name="teamA.name" :logo-url="logoFor(teamA)" size="md" />
      <span class="flex-1 truncate">{{ teamA?.name ?? '?' }}</span>
      <span v-if="winnerId && teamA?.id === winnerId">✓</span>
    </div>
    <div
      class="flex items-center gap-[clamp(0.4rem,0.7vw,0.75rem)] px-[clamp(0.6rem,1vw,1rem)] py-[clamp(0.4rem,0.8vh,0.75rem)] rounded-lg text-[clamp(0.9rem,1.2vw,1.5rem)] transition-all duration-500"
      :class="rowClass(teamB)"
    >
      <TeamAvatar v-if="teamB" :name="teamB.name" :logo-url="logoFor(teamB)" size="md" />
      <span class="flex-1 truncate">{{ teamB?.name ?? '?' }}</span>
      <span v-if="winnerId && teamB?.id === winnerId">✓</span>
    </div>
  </div>
</template>

<style scoped>
.winner-glow {
  animation: winnerGlow 1.8s ease-in-out infinite;
}
@keyframes winnerGlow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(122, 26, 46, 0.55), 0 0 12px 2px rgba(122, 26, 46, 0.35);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(122, 26, 46, 0), 0 0 22px 6px rgba(122, 26, 46, 0.6);
  }
}
</style>
