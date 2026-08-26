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
  return teamsStore.teamById(slot.id)?.logoUrl
}

function rowClass(team?: Slot): string {
  if (!team) return 'text-gray-300 bg-gray-50 italic'
  if (!props.winnerId) return 'text-gray-700'
  if (team.id === props.winnerId) return 'bg-petro-primary text-white font-semibold winner-pulse'
  return 'text-gray-300 line-through opacity-60'
}
</script>

<template>
  <!-- ATUALIZADO — w-52, p-3 e text-sm fixos trocados por clamp() em vw,
       para o cartão de cada confronto escalar com o ecrã. Aumentei
       também o TeamAvatar de 'sm' para 'md' — com o cartão maior, um
       avatar 'sm' ficava desproporcionalmente pequeno lá dentro. -->
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
.winner-pulse {
  animation: winnerPulse 1s ease;
}
@keyframes winnerPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(122, 26, 46, 0.5);
  }
  100% {
    box-shadow: 0 0 0 10px rgba(122, 26, 46, 0);
  }
}
</style>
