<script setup lang="ts">
import BracketMatchCard from './BracketMatchCard.vue'
import type { BracketMatch } from '../data/bracket'

defineProps<{
  matches: BracketMatch[]
  align: 'space-between' | 'center'
}>()
</script>

<template>
  <div class="flex flex-col h-full" :class="align === 'center' ? 'justify-center' : 'justify-between'">
    <div
      v-for="(match, i) in matches"
      :key="match.id"
      class="bracket-card-enter"
      :style="{ animationDelay: i * 0.15 + 's' }"
    >
      <BracketMatchCard :team-a="match.teamA" :team-b="match.teamB" :winner-id="match.winnerId" />
    </div>
  </div>
</template>

<style scoped>
.bracket-card-enter {
  animation: cardFadeIn 0.5s ease both;
}
@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>
