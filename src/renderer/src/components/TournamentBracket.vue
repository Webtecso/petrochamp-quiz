<script setup lang="ts">
import LogoMark from './LogoMark.vue'
import BracketRoundColumn from './BracketRoundColumn.vue'
import BracketConnector from './BracketConnector.vue'
import type { BracketRound, BracketMatch } from '../data/bracket'

withDefaults(
  defineProps<{
    rounds?: BracketRound[]
    finalMatch?: BracketMatch
    title: string
  }>(),
  {
    rounds: () => []
  }
)
</script>

<template>
  <div class="flex flex-col items-center gap-8 w-full">
    <div class="text-center flex flex-col items-center gap-1">
      <LogoMark theme="light" size="md" />
      <h1 class="text-lg font-semibold text-gray-700 mt-1">{{ title }}</h1>
    </div>

    <div class="flex items-center justify-center gap-0 w-full overflow-x-auto px-4 h-[340px]">
      <template v-for="(round, i) in rounds" :key="'l-' + i">
        <BracketRoundColumn :matches="round.leftMatches" :align="round.leftMatches.length > 1 ? 'space-between' : 'center'" />
        <BracketConnector />
      </template>

      <div class="flex flex-col items-center gap-3 px-4 shrink-0">
        <div class="trophy-glow text-4xl">🏆</div>
        <div class="text-xs font-semibold text-petro-primary tracking-widest">FINAL</div>
        <div class="flex flex-col gap-2">
          <div class="bg-white rounded-lg shadow px-4 py-2 text-sm font-semibold text-center w-40">
            {{ finalMatch?.teamA?.name ?? '?' }}
          </div>
          <div class="bg-white rounded-lg shadow px-4 py-2 text-sm font-semibold text-center w-40">
            {{ finalMatch?.teamB?.name ?? '?' }}
          </div>
        </div>
      </div>

      <template v-for="(round, i) in [...rounds].reverse()" :key="'r-' + i">
        <BracketConnector />
        <BracketRoundColumn :matches="round.rightMatches" :align="round.rightMatches.length > 1 ? 'space-between' : 'center'" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.trophy-glow {
  animation: trophyPulse 2.4s ease-in-out infinite;
}
@keyframes trophyPulse {
  0%, 100% { filter: drop-shadow(0 0 4px rgba(122, 26, 46, 0.3)); transform: scale(1); }
  50% { filter: drop-shadow(0 0 12px rgba(122, 26, 46, 0.5)); transform: scale(1.08); }
}
</style>
