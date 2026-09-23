<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'vue-router'
import { useCampeonatoStore } from '../stores/campeonato'
import { usePhasesStore } from '../stores/phases'
import { useLiveBracketStore } from '../stores/liveBracket'
import PodiumScreen from '../components/PodiumScreen.vue'

const router = useRouter()
const store = useCampeonatoStore()
const phasesStore = usePhasesStore()
const liveBracketStore = useLiveBracketStore()
const isTabletOrPhone = Capacitor.isNativePlatform()

// NOVO - desempate 3o/4o lugar: perguntas nao filtram por fase (o
// campeonato ja terminou), mesmo padrao usado na ProjecaoView.vue.
onMounted(async () => {
  await phasesStore.fetchPhases(store.championship ?? undefined)
  if (store.championship) {
    await liveBracketStore.fetchBracket(store.championship)
  }
})

watch(
  () => store.phaseFlow.stage,
  async (stage) => {
    if (stage === 'organizer' && store.championship) {
      await liveBracketStore.fetchBracket(store.championship)
    }
  }
)

const currentBracketRound = computed(() => phasesStore.phaseOrderToBracketRound(store.phase))
const isLastPhase = computed(() => currentBracketRound.value === liveBracketStore.totalRounds)

const championId = computed(() => {
  if (!liveBracketStore.matches.length) return null
  const maxRound = Math.max(...liveBracketStore.matches.map((m) => m.round))
  const finalMatch = liveBracketStore.matches.find((m) => m.round === maxRound)
  return finalMatch?.winnerId ?? null
})

const canShowChampions = computed(
  () => isLastPhase.value && !!championId.value
)

const podiumSequenceAlreadyTriggered = computed(
  () => store.podiumReveal.stage !== 'idle'
)

const canFinalizeChampionship = computed(() => {
  if (!store.podiumReveal.finalRankingVisible || store.championReveal.active) return false
  if (store.championship === 'ensino_medio') return true
  return canShowChampions.value
})

const canAdvanceToNextPhase = computed(
  () => !!store.championship && store.phase < phasesStore.totalPhases && !store.championReveal.active
)

async function confirmReset(): Promise<void> {
  const message = 'Tem certeza que deseja finalizar o campeonato?'
  const ok = confirm(message)
  if (!ok) return

  const res: any = await store.finalizeChampionship()
  if (res && res.success === false) {
    window.alert(res.error || 'Não foi possível finalizar o campeonato.')
    return
  }
  router.push('/moderador/modo')
}

const waitingForInstitutional = computed(
  () => isLastPhase.value && !!championId.value && store.phaseFlow.stage !== 'organizer'
)

function startFinalSequence(): void {
  store.startFinalPodiumSequence()
}

// NOVO - desempate automatico do 3o/4o lugar
function startThirdPlaceTiebreak(): void {
  store.startThirdPlaceTiebreak()
  router.push('/moderador/jogo')
}

function toggleFinalRanking(): void {
  if (store.podiumReveal.finalRankingVisible) {
    store.hideFinalRanking()
  } else {
    store.showFinalRanking()
  }
}

function showTransition(): void {
  store.showPhaseTransition()
}

async function advance(): Promise<void> {
  store.hidePodium()
  const res: any = await store.advancePhase(true)
  if (res && res.success === false) {
    window.alert(res.error || 'Não foi possível avançar de fase forçadamente.')
    return
  }
  router.push('/moderador/equipas')
}

// async function forceFinalizeChampionship(): Promise<void> {
//   const res: any = await store.finalizeChampionship(true)
//   if (res && res.success === false) {
//     window.alert(res.error || 'Não foi possível finalizar o campeonato forçadamente.')
//     return
//   }
// }
</script>

<template>
  <div class="relative flex-1 flex flex-col">
    <PodiumScreen
      v-if="isTabletOrPhone && store.podium.active"
      :phase-number="store.podium.phaseNumber"
      :phase-label="store.podium.phaseLabel"
      :entries="store.podium.entries"
      :is-grand-final="store.podium.isGrandFinal"
    />

    <div v-if="isTabletOrPhone && store.podium.active" class="absolute bottom-4 inset-x-0 flex items-center justify-center gap-4 z-40">
      <button class="bg-white/90 text-petro-primary rounded-lg px-4 py-2 text-sm font-semibold shadow" @click="store.hidePodium()">
        Ocultar Pódio
      </button>
    </div>

    <div v-else class="flex-1 flex flex-col items-center justify-center gap-6 px-10 py-12">
      <h1 class="text-2xl font-bold text-petro-primary">Controlo do Pódio</h1>

      <div
        class="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-4 max-w-md text-center border-2"
        :class="canShowChampions ? 'border-amber-300' : 'border-gray-100'"
      >
        <div class="text-3xl">🏆</div>
        <p v-if="canShowChampions" class="text-sm text-gray-600">
          Todas as fases terminaram, a sequência institucional chegou ao fim e já existe uma equipa campeã. Podes disparar
          a sequência completa de revelação (suspense → contagem regressiva → pódio) na tela de Projeção.
        </p>
        <p v-else-if="waitingForInstitutional" class="text-sm text-amber-600">
          Falta terminar a sequência de parceiros/apresentações institucionais antes de continuares para aqui.
        </p>
        <p v-else class="text-sm text-gray-400">
          O Pódio só fica disponível depois de todas as fases terminarem e existir uma equipa campeã no
          chaveamento final.
        </p>

        <button
          class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="!canShowChampions || podiumSequenceAlreadyTriggered"
          @click="startFinalSequence"
        >
          {{ podiumSequenceAlreadyTriggered ? 'Sequência em curso...' : 'A aguardar sequência automática...' }}
        </button>

        <div v-if="store.podiumReveal.stage === 'awaitingTiebreak'" class="flex flex-col items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl p-4 w-full">
          <p class="text-sm text-amber-700 font-semibold">
            Empate detetado no 3º/4º lugar! É preciso desempate antes de revelar o pódio.
          </p>
          <button
            class="bg-amber-500 text-white rounded-lg px-6 py-3 font-semibold disabled:opacity-60"
            :disabled="store.thirdPlaceTiebreak.active"
            @click="startThirdPlaceTiebreak"
          >
            {{ store.thirdPlaceTiebreak.active ? 'Desempate em curso...' : '⚔️ Iniciar Desempate 3º/4º lugar' }}
          </button>
        </div>


        <button
          v-if="store.podiumReveal.stage === 'revealed'"
          class="text-sm text-petro-primary underline"
          @click="toggleFinalRanking"
        >
          {{ store.podiumReveal.finalRankingVisible ? 'Ocultar Ranking Final e Mostrar Podio' : 'Mostrar Ranking Final na Projecao' }}
        </button>

        <!-- @click="forceFinalizeChampionship" -->
        <button
          v-if="store.podiumReveal.finalRankingVisible"
          class="bg-amber-500 text-white rounded-lg px-6 py-3 font-semibold disabled:opacity-60"
          :disabled="!canFinalizeChampionship"
          @click="confirmReset"
        >
          {{ store.championReveal.active ? 'Campeonato finalizado ✓' : '🏁 Finalizar Campeonato' }}
        </button>
      </div>

      <div class="bg-white rounded-2xl shadow p-5 flex flex-col items-center gap-3 max-w-md text-center">
        <p class="text-xs text-gray-500">
          A transição institucional (parceiros + Webtec Solution) já acontece automaticamente no fim de cada
          fase - este botão só serve para a repetires manualmente, se precisares.
        </p>
        <button
          class="bg-petro-dark text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="store.phaseTransition.stage !== 'idle' || !store.podiumReveal.finalRankingVisible"
          @click="showTransition"
        >
          {{ store.phaseTransition.stage === 'idle' ? 'Repetir Transição Institucional' : 'Transição em curso...' }}
        </button>
        <p v-if="!store.podiumReveal.finalRankingVisible" class="text-xs text-amber-600 font-medium">
          Disponível depois de mostrares o Ranking Final
        </p>
      </div>

      <button
        v-if="canAdvanceToNextPhase"
        class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold"
        @click="advance"
      >
        Avançar para Fase {{ store.phase + 1 }} →
      </button>
    </div>
  </div>
</template>
