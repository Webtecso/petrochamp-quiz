<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCampeonatoStore } from '../stores/campeonato'
import { useTeamsStore } from '../stores/teams'
import { useModeStore } from '../stores/mode'
import { useLiveBracketStore } from '../stores/liveBracket'
import { usePhasesStore } from '../stores/phases'
import { useRepescagemStore } from '../stores/repescagem'

const router = useRouter()
const store = useCampeonatoStore()
const teamsStore = useTeamsStore()
const modeStore = useModeStore()
const liveBracketStore = useLiveBracketStore()
const phasesStore = usePhasesStore()
const repescagemStore = useRepescagemStore()

if (!store.championship) {
  router.replace('/moderador/campeonato')
}

const starting = ref(false)
const openingVote = ref(false)
const repescagemError = ref('')

onMounted(async () => {
  await teamsStore.fetchTeams()
  await phasesStore.fetchPhases(store.championship ?? undefined)

  if (store.phaseFlow.stage === 'repescagem' && store.championship) {
    await repescagemStore.fetchForPhase(store.championship, store.phase)
    if (repescagemStore.config?.started) {
      await repescagemStore.fetchTally()
      await repescagemStore.fetchBracket()
    }
  }

  if (store.championship) {
    await liveBracketStore.fetchBracket(store.championship)
    await repescagemStore.fetchActive()
    if (repescagemStore.config?.championship === store.championship && !repescagemStore.config?.votingOpen) {
      await repescagemStore.fetchBracket()
    }
  }
})

const hasBracket = computed(() => liveBracketStore.matches.length > 0)
const isLastPhaseFlow = computed(() => store.phase >= phasesStore.totalPhases)

function onShowPartners(): void {
  store.showPartners()
}
function onStartNextPhase(): void {
  store.startNextPhase()
}

async function openRepescagemVoting(): Promise<void> {
  if (!repescagemStore.config) return
  openingVote.value = true
  repescagemError.value = ''
  store.openRepescagemVoting(repescagemStore.config.id)
  openingVote.value = false
}

async function closeRepescagemVoting(): Promise<void> {
  if (!repescagemStore.config) return
  store.closeRepescagemVoting(repescagemStore.config.id)
}

async function generateRepescagemBracket(): Promise<void> {
  await repescagemStore.generateBracket()
}

async function insertRepescagemChampion(): Promise<void> {
  repescagemError.value = ''
  const result = await repescagemStore.insertChampion()
  if (!result.success) repescagemError.value = result.error ?? 'Falha ao inserir a campeã.'
}

function continueAfterRepescagem(): void {
  store.continueAfterRepescagem()
}

async function startBracketMatch(teamAId: string, teamBId: string): Promise<void> {
  const teamA = teamsStore.teamById(teamAId)
  const teamB = teamsStore.teamById(teamBId)
  if (!teamA || !teamB) return
  starting.value = true
  const ok = await store.selectTeams(teamA, teamB)
  starting.value = false
  if (!ok) return
  if (modeStore.deviceMode === 'com-dispositivos') {
    router.push('/moderador/sala-espera')
  } else {
    router.push('/moderador/jogo')
  }
}
</script>

<template>
  <div
    v-if="store.phaseFlow.stage !== 'idle'"
    class="flex-1 flex flex-col items-center justify-center px-10 py-12 gap-6 text-center max-w-md mx-auto"
  >
    <template v-if="store.phaseFlow.stage === 'repescagem'">
      <h1 class="text-2xl font-bold text-amber-700">Repescagem — Fase {{ store.phase }}</h1>
      <p v-if="repescagemError" class="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-sm">
        {{ repescagemError }}
      </p>

      <template v-if="!repescagemStore.config?.started">
        <p class="text-sm text-gray-500 max-w-sm">
          Há uma repescagem configurada para repescar {{ repescagemStore.config?.maxRepescados }} equipa(s), com
          {{ repescagemStore.config?.votingDurationSeconds }}s de votação. Abre a votação quando estiveres pronto.
        </p>
        <button
          class="bg-amber-500 text-white rounded-lg px-6 py-3 font-semibold disabled:opacity-50"
          :disabled="openingVote"
          @click="openRepescagemVoting"
        >
          {{ openingVote ? 'A abrir...' : 'Abrir Votação de Repescagem' }}
        </button>
      </template>

      <template v-else-if="repescagemStore.config?.votingOpen">
        <p class="text-sm text-gray-500 max-w-sm">Votação aberta — o público já pode votar no portal.</p>
        <div class="flex flex-col gap-2 w-full max-w-sm">
          <div
            v-for="t in repescagemStore.tally"
            :key="t.teamId"
            class="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-2 bg-white"
          >
            <span class="text-sm">{{ t.name }}</span>
            <span class="font-bold text-amber-600">{{ t.votes }} votos</span>
          </div>
        </div>
        <button class="bg-red-500 text-white rounded-lg px-6 py-3 font-semibold" @click="closeRepescagemVoting">
          Fechar Votação
        </button>
      </template>

      <template v-else>
        <button
          v-if="!repescagemStore.bracketMatches.length"
          class="bg-petro-dark text-white rounded-lg px-6 py-3 font-semibold"
          @click="generateRepescagemBracket"
        >
          Gerar Chaveamento de Repescagem
        </button>
        <template v-else>
          <p class="text-sm text-gray-500">Joga os confrontos da repescagem na secção abaixo, no ecrã normal.</p>
          <button
            v-if="repescagemStore.pendingMatches.length === 0"
            class="bg-amber-500 text-white rounded-lg px-6 py-3 font-semibold"
            @click="insertRepescagemChampion"
          >
            Inserir Campeã no Chaveamento Principal
          </button>
        </template>
        <button class="text-sm text-petro-primary underline" @click="continueAfterRepescagem">
          Continuar sem/depois da repescagem →
        </button>
      </template>
    </template>
    <template v-else-if="store.phaseFlow.stage === 'ranking'">
      <h1 class="text-2xl font-bold text-petro-primary">Ranking da Fase {{ store.phase }}</h1>
      <p class="text-sm text-gray-500">O ranking está a ser mostrado na Projeção.</p>
      <button class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold" @click="onShowPartners">
        Mostrar Parceiros
      </button>
    </template>
    <template v-else-if="store.phaseFlow.stage === 'partnersPending'">
      <h1 class="text-2xl font-bold text-petro-primary">Última fase concluída</h1>
      <p class="text-sm text-gray-500">Podes mostrar os parceiros na Projeção.</p>
      <button class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold" @click="onShowPartners">
        Mostrar Parceiros
      </button>
    </template>
    <template v-else-if="store.phaseFlow.stage === 'partners' || store.phaseFlow.stage === 'webtec' || store.phaseFlow.stage === 'organizer'">
      <h1 class="text-2xl font-bold text-petro-primary">Sequência institucional em curso</h1>
      <p v-if="isLastPhaseFlow" class="text-sm text-gray-500">
        Quando terminar, segue para o Pódio.
      </p>
      <p v-else class="text-sm text-gray-500">
        A avançar automaticamente para a tela de suspense da próxima fase...
      </p>
      <RouterLink
        v-if="isLastPhaseFlow"
        to="/moderador/podio"
        class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold"
      >
        Ir para o Pódio
      </RouterLink>
    </template>
    <template v-else-if="store.phaseFlow.stage === 'suspense'">
      <h1 class="text-2xl font-bold text-petro-primary">A entrar na fase seguinte</h1>
      <p class="text-sm text-gray-500 italic max-w-xs">"{{ store.phaseFlow.suspensePhrase }}"</p>
      <button class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold" @click="onStartNextPhase">
        Iniciar Fase {{ store.phase + 1 }}
      </button>
    </template>
  </div>

  <div v-else class="flex-1 flex flex-col items-center justify-center px-10 py-12 gap-8">
    <h1 class="text-2xl font-bold text-petro-primary">Escolha o Próximo Confronto</h1>
    <template v-if="hasBracket">
      <p v-if="liveBracketStore.pendingMatches.length" class="text-sm text-gray-400 text-center max-w-md">
        Escolhe um dos confrontos pendentes — as equipas já usadas nesta fase não voltam a aparecer aqui.
      </p>
      <div v-if="liveBracketStore.pendingMatches.length" class="grid grid-cols-1 gap-3 w-full max-w-md">
        <button
          v-for="m in liveBracketStore.pendingMatches"
          :key="m.id"
          class="bg-white rounded-xl shadow p-4 flex items-center justify-between gap-3 border-2 border-transparent hover:border-petro-primary transition"
          :disabled="starting"
          @click="startBracketMatch(m.teamA!.id, m.teamB!.id)"
        >
          <span class="font-semibold text-sm">{{ m.teamA?.name }}</span>
          <span class="text-gray-300 text-xs">vs</span>
          <span class="font-semibold text-sm">{{ m.teamB?.name }}</span>
        </button>
      </div>
      <div v-else class="bg-green-50 border border-green-200 rounded-xl px-6 py-4 text-center text-sm text-green-700 max-w-md">
        Todos os confrontos desta fase já foram jogados. Vai a Ranking ou Pódio para continuar.
      </div>
    </template>
    <div v-else class="text-center max-w-md">
      <div class="text-4xl mb-4">🏆</div>
      <p class="text-sm text-gray-500 mb-6">
        Ainda não existe um chaveamento gerado para este campeonato. Vai ao Painel do Administrador → Chaveamento
        para o gerar a partir das equipas cadastradas.
      </p>
      <RouterLink to="/admin/chaveamento" class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold inline-block">
        Ir para Admin → Chaveamento
      </RouterLink>
    </div>

    <!-- Confrontos da Repescagem -->
    <template v-if="repescagemStore.config?.championship === store.championship && repescagemStore.pendingMatches.length">
      <div class="w-full max-w-md border-t border-gray-200 pt-6 flex flex-col items-center gap-3">
        <h2 class="text-sm font-bold text-amber-700 uppercase tracking-wide">🔁 Confrontos da Repescagem</h2>
        <p class="text-xs text-gray-400 text-center">
          Equipas que voltaram por votação pública — jogam normalmente, como qualquer outra batalha.
        </p>
        <div class="grid grid-cols-1 gap-3 w-full">
          <button
            v-for="m in repescagemStore.pendingMatches"
            :key="'rep-' + m.id"
            class="bg-amber-50 rounded-xl p-4 flex items-center justify-between gap-3 border-2 border-amber-200 hover:border-amber-400 transition"
            :disabled="starting"
            @click="startBracketMatch(m.teamA!.id, m.teamB!.id)"
          >
            <span class="font-semibold text-sm">{{ m.teamA?.name }}</span>
            <span class="text-amber-400 text-xs">vs</span>
            <span class="font-semibold text-sm">{{ m.teamB?.name }}</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
