<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCampeonatoStore } from '../stores/campeonato'
import { useRepescagemStore } from '../stores/repescagem'

const router = useRouter()
const store = useCampeonatoStore()
const repescagemStore = useRepescagemStore()

let tallyPollHandle: ReturnType<typeof setInterval> | null = null

function stopPolling(): void {
  if (tallyPollHandle) {
    clearInterval(tallyPollHandle)
    tallyPollHandle = null
  }
}

async function loadConfig(): Promise<void> {
  if (!store.championship) return
  await repescagemStore.fetchForPhase(store.championship, store.phase)
}

onMounted(loadConfig)
onUnmounted(stopPolling)

watch(
  () => store.repescagemReveal.stage,
  (stage) => {
    stopPolling()
    if (stage === 'voting') {
      repescagemStore.fetchTally()
      tallyPollHandle = setInterval(() => repescagemStore.fetchTally(), 2000)
    }
  }
)

const maxVotes = computed(() => Math.max(1, ...repescagemStore.tally.map((t) => t.votes)))

function startVoting(): void {
  if (!repescagemStore.config) return
  store.openRepescagemVoting(repescagemStore.config.id)
}

function closeVoting(): void {
  if (!repescagemStore.config) return
  store.closeRepescagemVoting(repescagemStore.config.id)
}

function continueFlow(): void {
  store.continueAfterRepescagem()
  router.push('/moderador/equipas')
}
</script>

<template>
  <div class="flex-1 px-10 py-8">
    <div class="max-w-2xl mx-auto flex flex-col gap-6">
      <div class="flex items-center gap-2">
        <span class="text-2xl">🎯</span>
        <h1 class="text-2xl font-bold text-petro-primary">Repescagem - Fase {{ store.phase }}</h1>
      </div>

      <div v-if="!repescagemStore.config" class="bg-white rounded-2xl shadow p-6 text-center">
        <p class="text-sm text-gray-400">A carregar configuração de repescagem...</p>
      </div>

      <template v-else>
        <!-- 1. Por iniciar -->
        <div v-if="store.repescagemReveal.stage === 'idle'" class="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-4 text-center">
          <p class="text-sm text-gray-500 max-w-sm">
            Repescar {{ repescagemStore.config.maxRepescados }} equipa(s) - votação com
            {{ repescagemStore.config.votingDurationSeconds }}s de duração. Quando clicares em Iniciar, o público vota
            no telemóvel através do portal remoto.
          </p>
          <button class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold shadow" @click="startVoting">
            🗳️ Iniciar Votação
          </button>
        </div>

        <!-- 2. Suspense / Contagem antes da votação -->
        <div
          v-else-if="store.repescagemReveal.stage === 'suspense' || store.repescagemReveal.stage === 'countdown'"
          class="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-3 text-center"
        >
          <div v-if="store.repescagemReveal.stage === 'countdown'" class="text-6xl font-black text-amber-500">
            {{ store.repescagemReveal.countdownValue }}
          </div>
          <p class="text-sm text-amber-600 font-semibold">A votação vai abrir - o público já pode preparar-se...</p>
        </div>

        <!-- 3. Votação aberta - acompanhamento em tempo real -->
        <div v-else-if="store.repescagemReveal.stage === 'voting'" class="bg-white rounded-2xl shadow p-6 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full uppercase tracking-wide">
              🔴 Votação Aberta
            </span>
            <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold" @click="closeVoting">
              Encerrar Votação
            </button>
          </div>

          <div class="flex flex-col gap-3">
            <div v-for="t in repescagemStore.tally" :key="t.teamId" class="flex flex-col gap-1">
              <div class="flex items-center justify-between text-sm">
                <span class="font-semibold">{{ t.name }}</span>
                <span class="font-bold text-petro-primary">{{ t.votes }} votos</span>
              </div>
              <div class="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-petro-primary to-amber-500 rounded-full transition-all duration-500"
                  :style="{ width: `${(t.votes / maxVotes) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Resultados -->
        <div v-else-if="store.repescagemReveal.stage === 'results'" class="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-4 text-center">
          <h2 class="text-lg font-bold text-petro-primary">Equipas Repescadas</h2>
          <div class="flex flex-col gap-2 w-full max-w-sm">
            <div
              v-for="name in store.repescagemReveal.repescadaNames"
              :key="name"
              class="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2 font-semibold"
            >
              {{ name }}
            </div>
          </div>
          <button class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold shadow" @click="continueFlow">
            Continuar →
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
