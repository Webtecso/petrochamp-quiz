<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
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

const currentPhaseRecord = computed(() => phasesStore.phases.find((p) => p.order === store.phase))
const isPurePresentationPhase = computed(() => currentPhaseRecord.value?.type === 'apresentacao')

// onMounted

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

const hasBracket = computed(() => liveBracketStore.matches.length > 0 && !isPurePresentationPhase.value)

const currentBracketRound = computed(() => phasesStore.phaseOrderToBracketRound(store.phase))
// CORRIGIDO — numa fase apresentacao pura, os confrontos do chaveamento
// dessa ronda existem na base de dados (gerados automaticamente por
// /generate), mas não devem aparecer aqui como jogáveis — essa fase não
// tem Quiz. Ver o comentário grande acima de isPurePresentationPhase.
const pendingMatchesThisRound = computed(() =>
  isPurePresentationPhase.value ? [] : liveBracketStore.pendingMatchesForRound(currentBracketRound.value)
)

function goToEquipas(): void {
  if (store.phaseFlow.stage === 'quizIntro') {
    store.confirmQuizIntro()
  }
  router.push('/moderador/equipas')
}

function onShowPartners(): void {
  store.showPartners()
}

// CORRIGIDO — a navegação para '/moderador/apresentacao' foi retirada
// daqui (ver nota no watch(() => store.phase, ...) abaixo). Antes,
// calculava nextPhaseOrder = store.phase + 1 e navegava logo a seguir a
// chamar store.startNextPhase() — mas essa chamada é assíncrona (só
// emite o evento ao servidor); store.phase ainda não tinha sido
// atualizado pelo state:sync real quando a navegação já acontecia. O
// ModeradorApresentacaoView.vue então montava a mostrar a fase de
// Apresentação ANTERIOR (já toda apresentada, com
// presentationRoundReady já consumido a false) em vez da nova fase,
// dando a impressão de "repetir a apresentação" e bloqueando o avanço,
// porque o botão "Ir para o Ranking" ali não fazia nada.
function onStartNextPhase(): void {
  // store.startNextPhase()
  store.startQuizPhase()
}

// NOVO — só decide para onde navegar DEPOIS do valor de store.phase
// realmente mudar (chegou o state:sync do backend), nunca antes. Isto
// elimina a condição de corrida descrita acima: quando a nova fase é de
// Apresentação (pura ou + Quiz), navega para lá; se for Quiz, fica em
// '/moderador/equipas' — o próprio ecrã (mais abaixo) já mostra o
// chaveamento/confrontos assim que phaseFlow.stage voltar a 'idle'
// (usando isPurePresentationPhase/currentBracketRound, que também
// dependem de store.phase e já reagem sozinhos a essa mudança).
watch(
  () => store.phase,
  (newPhase, oldPhase) => {
    if (newPhase === oldPhase) return
    const nextPhase = phasesStore.phases.find((p) => p.order === newPhase)
    if (nextPhase?.type === 'apresentacao' || nextPhase?.type === 'apresentacao_quiz') {
      router.push('/moderador/apresentacao')
    }
  }
)

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

// debug
watch(
  [currentBracketRound, () => liveBracketStore.matches],
  () => {
    console.log('[equipas]', {
      phase: store.phase,
      round: currentBracketRound.value,
      totalMatches: liveBracketStore.matches.length,
      pending: liveBracketStore.pendingMatchesForRound(currentBracketRound.value).length,
      byRound: liveBracketStore.matches.reduce((acc: Record<number, number>, m: any) => {
        const r = m.round
        acc[r] = (acc[r] ?? 0) + 1
        return acc
      }, {})
    })
  },
  { immediate: true }
)
</script>

<template>
  <div
    v-if="store.phaseFlow.stage !== 'idle'"
    class="flex-1 flex flex-col items-center justify-center px-10 py-12 gap-6 text-center max-w-md mx-auto"
  >
    <template v-if="store.phaseFlow.stage === 'battleEnded'">
      <h1 class="text-2xl font-bold text-petro-primary">A batalha terminou!</h1>
      <p class="text-sm text-gray-500">O ecrã "A batalha terminou" está a ser mostrado na Projeção.</p>
      <button
        class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold"
        @click="store.continueAfterBattleEnded()"
      >
        Ir para o Ranking
      </button>
    </template>

    <!-- Repescagem Template -->
    <template v-else-if="store.phaseFlow.stage === 'repescagem'">
      <h1 class="text-2xl font-bold text-amber-700">Repescagem - Fase {{ store.phase }}</h1>
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
        <p class="text-sm text-gray-500 max-w-sm">Votação aberta - o público já pode votar no portal.</p>
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

    <!-- Intro do Quiz -->
    <template v-else-if="store.phaseFlow.stage === 'quizIntro'">
      <h1 class="text-2xl font-bold text-petro-primary">Introdução do Quiz em curso</h1>
      <p class="text-sm text-gray-500">A apresentação inicial do quiz está a ser exibida na Projeção.</p>
      <button class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold" @click="goToEquipas">
        Ir para Escolha de Equipas
      </button>
    </template>

    <!-- Rankings e Institucional -->
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
    <template v-else-if="store.phaseFlow.stage === 'partners'">
      <h1 class="text-2xl font-bold text-petro-primary">
        Apresentação dos Parceiros
      </h1>

      <p class="text-sm text-gray-500">
        Os parceiros estão a ser apresentados na Projeção.
        Aguarda o início da introdução do Quiz.
      </p>
    </template>

    <template v-else-if="store.phaseFlow.stage === 'webtec' || store.phaseFlow.stage === 'organizer'">
      <h1 class="text-2xl font-bold text-petro-primary">
        Sequência institucional em curso
      </h1>

      <p class="text-sm text-gray-500">
        Aguarda o término da apresentação institucional.
      </p>
    </template>

    <!-- Suspense/Próxima Fase -->
    <template v-else-if="store.phaseFlow.stage === 'suspense'">
      <h1 class="text-2xl font-bold text-petro-primary">A entrar na fase seguinte</h1>
      <p class="text-sm text-gray-500 italic max-w-xs">"{{ store.phaseFlow.suspensePhrase }}"</p>
      <button class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold" @click="onStartNextPhase">
        Iniciar Fase {{ store.phase + 1 }}
      </button>
    </template>
  </div>

  <!-- Ecrã de Escolha de Confronto (quando stage === 'idle') -->
  <div v-else class="flex-1 flex flex-col items-center justify-center px-10 py-12 gap-8">
    <!-- NOVO — fase apresentacao pura: não há confrontos de Quiz aqui,
         só um aviso a apontar para o ecrã certo. -->
    <template v-if="isPurePresentationPhase">
      <h1 class="text-2xl font-bold text-petro-primary">Fase {{ store.phase }} é de Apresentação</h1>
      <p class="text-sm text-gray-500 text-center max-w-md">
        Esta fase não tem Quiz. Continua a gestão das apresentações no ecrã de Apresentação.
      </p>
      <RouterLink
        to="/moderador/apresentacao"
        class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold inline-block"
      >
        Ir para Apresentação
      </RouterLink>
    </template>
    <h1 v-else class="text-2xl font-bold text-petro-primary">Escolha o Próximo Confronto</h1>
    <template v-if="!isPurePresentationPhase && hasBracket">
      <p v-if="pendingMatchesThisRound.length" class="text-sm text-gray-400 text-center max-w-md">
        Escolhe um dos confrontos pendentes - as equipas já usadas nesta fase não voltam a aparecer aqui.
      </p>
      <div v-if="pendingMatchesThisRound.length" class="grid grid-cols-1 gap-3 w-full max-w-md">
        <button
          v-for="m in pendingMatchesThisRound"
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
    <div v-else-if="!isPurePresentationPhase" class="text-center max-w-md">
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
          Equipas que voltaram por votação pública - jogam normalmente, como qualquer outra batalha.
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
