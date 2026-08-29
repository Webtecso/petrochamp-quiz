<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCampeonatoStore } from '../stores/campeonato'
import { getBracketFor } from '../data/bracket'
import TournamentBracket from '../components/TournamentBracket.vue'

const router = useRouter()
const store = useCampeonatoStore()

if (!store.championship) {
  router.replace('/moderador/campeonato')
}

const bracket = computed(() => (store.championship ? getBracketFor(store.championship) : undefined))

function proceed(): void {
  router.push('/moderador/equipas')
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center gap-8 px-10 py-10">
    <TournamentBracket v-if="bracket" :rounds="bracket.rounds" :final-match="bracket.finalMatch" :title="bracket.title" />
    <p v-else class="text-sm text-gray-400">Esta categoria não tem chaveamento - segue direto para a escolha de equipas.</p>
    <button class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold" @click="proceed">
      Continuar para Escolha de Equipas →
    </button>
  </div>
</template>
