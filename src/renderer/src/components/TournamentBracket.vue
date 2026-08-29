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
      <!-- AUMENTADO - limites do clamp() alargados para o título do
           chaveamento crescer mais em ecrãs grandes. -->
      <h1 class="text-[clamp(1.3rem,2.4vw,3rem)] font-semibold text-gray-700 mt-1">{{ title }}</h1>
    </div>

    <!-- AUMENTADO - altura do chaveamento aumentada (mínimo e máximo),
         para ocupar mais espaço vertical disponível em vez de ficar
         encolhido no centro do ecrã. -->
    <div class="flex items-center justify-center gap-0 w-full overflow-x-auto px-4 h-[clamp(400px,60vh,860px)]">
      <template v-for="(round, i) in rounds" :key="'l-' + i">
        <BracketRoundColumn :matches="round.leftMatches" :align="round.leftMatches.length > 1 ? 'space-between' : 'center'" />
        <BracketConnector />
      </template>

      <div class="flex flex-col items-center gap-[clamp(0.75rem,1.5vh,1.5rem)] px-4 shrink-0">
        <!-- AUMENTADO - troféu e rótulo "FINAL" maiores. -->
        <div class="trophy-glow text-[clamp(3rem,6vw,7.5rem)]">🏆</div>
        <div class="text-[clamp(0.95rem,1.5vw,1.6rem)] font-semibold text-petro-primary tracking-widest">FINAL</div>
        <div class="flex flex-col gap-[clamp(0.5rem,1vh,1rem)]">
          <!-- AUMENTADO - cartões dos finalistas maiores (padding, texto
               e largura). -->
          <div class="bg-white rounded-lg shadow px-[clamp(1.2rem,2vw,2.2rem)] py-[clamp(0.7rem,1.3vh,1.4rem)] text-[clamp(1.2rem,1.9vw,2.4rem)] font-semibold text-center w-[clamp(11rem,19vw,22rem)]">
            {{ finalMatch?.teamA?.name ?? '?' }}
          </div>
          <div class="bg-white rounded-lg shadow px-[clamp(1.2rem,2vw,2.2rem)] py-[clamp(0.7rem,1.3vh,1.4rem)] text-[clamp(1.2rem,1.9vw,2.4rem)] font-semibold text-center w-[clamp(11rem,19vw,22rem)]">
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
