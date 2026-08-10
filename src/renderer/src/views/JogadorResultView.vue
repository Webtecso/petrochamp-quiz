<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LogoMark from '../components/LogoMark.vue'
import ConfettiBurst from '../components/ConfettiBurst.vue'

const route = useRoute()
const router = useRouter()

const teamName = computed(() => (route.query.team as string) || 'A tua equipa')
const opponentName = computed(() => (route.query.opponent as string) || 'Equipa Adversária')
const teamScore = computed(() => Number(route.query.teamScore ?? 0))
const opponentScore = computed(() => Number(route.query.opponentScore ?? 0))

const outcome = computed<'venceu' | 'perdeu' | 'empate'>(() => {
  if (teamScore.value > opponentScore.value) return 'venceu'
  if (teamScore.value < opponentScore.value) return 'perdeu'
  return 'empate'
})

const heading = computed(() => {
  if (outcome.value === 'venceu') return 'Parabéns, vencestes! 🏆'
  if (outcome.value === 'empate') return 'Empate emocionante!'
  return 'Não foi desta vez'
})

const subtext = computed(() => {
  if (outcome.value === 'venceu') return 'A vossa equipa avança para a próxima fase.'
  if (outcome.value === 'empate') return 'Aguarda instruções do moderador para o desempate.'
  return 'Obrigado por participarem com garra. Continuem a estudar!'
})

function backToStart(): void {
  router.push('/jogador')
}
</script>

<template>
  <div class="min-h-screen bg-petro-dark relative overflow-hidden flex flex-col items-center justify-center px-6 gap-6 text-white">
    <ConfettiBurst v-if="outcome === 'venceu'" />

    <LogoMark theme="dark" size="md" class="relative z-10" />

    <div class="text-5xl relative z-10">
      <span v-if="outcome === 'venceu'">🏆</span>
      <span v-else-if="outcome === 'empate'">🤝</span>
      <span v-else>💪</span>
    </div>

    <div class="text-center relative z-10">
      <h1 class="text-2xl font-bold">{{ heading }}</h1>
      <p class="text-sm text-white/70 mt-2 max-w-xs mx-auto">{{ subtext }}</p>
    </div>

    <div class="bg-white rounded-2xl shadow p-5 w-full max-w-sm flex items-center justify-between relative z-10">
      <div class="text-center flex-1">
        <div class="font-semibold text-petro-primary text-sm">{{ teamName }}</div>
        <div class="text-3xl font-extrabold text-petro-primary">{{ teamScore }}</div>
      </div>
      <div class="text-gray-300 font-bold px-2">VS</div>
      <div class="text-center flex-1">
        <div class="font-semibold text-gray-500 text-sm">{{ opponentName }}</div>
        <div class="text-3xl font-extrabold text-gray-500">{{ opponentScore }}</div>
      </div>
    </div>

    <button class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold relative z-10 hover:opacity-90 transition" @click="backToStart">
      Voltar ao Início
    </button>
  </div>
</template>
