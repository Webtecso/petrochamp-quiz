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
  <div class="flex flex-col items-center gap-[clamp(1rem,2vh,2.5rem)] w-full">
    <div class="text-center flex flex-col items-center gap-1">
      <LogoMark theme="light" size="md" />
      <!-- ATUALIZADO — text-lg fixo trocado por clamp() baseado em vw, para
           o título escalar com o ecrã em vez de ficar sempre do mesmo
           tamanho físico numa TV grande. -->
      <h1 class="text-[clamp(1.1rem,1.8vw,2.2rem)] font-semibold text-gray-700 mt-1">{{ title }}</h1>
    </div>

    <!-- ATUALIZADO — h-[340px] fixo trocado por clamp() em vh, cresce em
         ecrãs altos e evita esmagar tudo em ecrãs pequenos. -->
    <div class="flex items-center justify-center gap-0 w-full overflow-x-auto px-4 h-[clamp(320px,46vh,680px)]">
      <template v-for="(round, i) in rounds" :key="'l-' + i">
        <BracketRoundColumn :matches="round.leftMatches" :align="round.leftMatches.length > 1 ? 'space-between' : 'center'" />
        <BracketConnector />
      </template>

      <div class="flex flex-col items-center gap-[clamp(0.5rem,1vh,1rem)] px-4 shrink-0">
        <div class="trophy-glow text-[clamp(2.5rem,4.5vw,5.5rem)]">🏆</div>
        <div class="text-[clamp(0.75rem,1.1vw,1.2rem)] font-semibold text-petro-primary tracking-widest">FINAL</div>
        <div class="flex flex-col gap-[clamp(0.4rem,0.8vh,0.75rem)]">
          <div class="bg-white rounded-lg shadow px-[clamp(0.9rem,1.4vw,1.5rem)] py-[clamp(0.5rem,0.9vh,1rem)] text-[clamp(0.95rem,1.3vw,1.7rem)] font-semibold text-center w-[clamp(9rem,15vw,17rem)]">
            {{ finalMatch?.teamA?.name ?? '?' }}
          </div>
          <div class="bg-white rounded-lg shadow px-[clamp(0.9rem,1.4vw,1.5rem)] py-[clamp(0.5rem,0.9vh,1rem)] text-[clamp(0.95rem,1.3vw,1.7rem)] font-semibold text-center w-[clamp(9rem,15vw,17rem)]">
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
