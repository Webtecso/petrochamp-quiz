<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCampeonatoStore } from '../stores/campeonato'
import { useQuizContentStore } from '../stores/quizContent'
import { useTiebreakQuestionsStore } from '../stores/tiebreakQuestions'
import { useModeStore } from '../stores/mode'
import { usePhasesStore } from '../stores/phases'
import { startConfigSync } from '../services/configSync'
import { buildEvaluationItemOptions } from '../data/evaluationItems'
import LogoMark from '../components/LogoMark.vue'
import TeamScoreCard from '../components/TeamScoreCard.vue'
import QuestionPanel from '../components/QuestionPanel.vue'
import ModeratorControls from '../components/ModeratorControls.vue'
import ModeratorAnswerPicker from '../components/ModeratorAnswerPicker.vue'

const router = useRouter()
const store = useCampeonatoStore()
const quizContent = useQuizContentStore()
const tiebreakQuestions = useTiebreakQuestionsStore()
const modeStore = useModeStore()
const phasesStore = usePhasesStore()

watch(
  () => [store.teamA, store.teamB],
  ([newA, newB]) => {
    if (!newA || !newB) {
      if (store.phaseFlow.stage === 'repescagem') {
        router.replace('/moderador/repescagem')
      } else {
        router.replace('/moderador/equipas')
      }
    }
  },
  { immediate: true }
)

watch(
  () => store.phase,
  async (newPhase, oldPhase) => {
    if (newPhase !== oldPhase) {
      await phasesStore.fetchPhases(store.championship ?? undefined)
      await quizContent.fetchQuestions(store.championship ?? undefined)
      await quizContent.fetchEvaluationItems(store.championship ?? undefined)
      await tiebreakQuestions.fetchQuestions(store.championship ?? undefined)
      if (redirectIfPresentationPhase()) return
      router.replace('/moderador/equipas')
    }
  }
)

onMounted(async () => {
  store.listenToServer()
  startConfigSync()

  await phasesStore.fetchPhases(store.championship ?? undefined)
  await quizContent.fetchQuestions(store.championship ?? undefined)
  await quizContent.fetchEvaluationItems(store.championship ?? undefined)
  await tiebreakQuestions.fetchQuestions(store.championship ?? undefined)

  if (redirectIfPresentationPhase()) return

  if (!store.activeTeam) {
    store.activeTeam = 'A'
  }
})

const phaseQuestions = computed(() => quizContent.questionsForPhase(store.phase))

const currentQuestion = computed(() => {
  if (store.currentItemSource === 'analytic') return null
  if (!store.currentQuestionId) return null
  return phaseQuestions.value.find((q) => String(q.id) === String(store.currentQuestionId)) ?? null
})

const currentAnalyticItem = computed(() => {
  if (store.currentItemSource !== 'analytic' || !store.currentAnalyticItemId) return null
  return quizContent.evaluationItems.find((i) => i.id === store.currentAnalyticItemId) ?? null
})

const activeDisplay = computed(() => {
  if (currentQuestion.value) {
    return {
      text: currentQuestion.value.text,
      options: currentQuestion.value.options,
      correctIndex: currentQuestion.value.correctIndex,
      imageUrl: currentQuestion.value.imageUrl
    }
  }
  if (currentAnalyticItem.value) {
    const it = currentAnalyticItem.value
    return {
      text: it.text,
      options: buildEvaluationItemOptions(it),
      correctIndex: Array.isArray(it.correctIndexes) ? it.correctIndexes[0] : undefined,
      imageUrl: it.imageUrl ?? null
    }
  }
  return null
})

const isAnalyticActive = computed(() => store.currentItemSource === 'analytic')
const isAnalyticScopeAll = computed(() => currentAnalyticItem.value?.scope === 'all')

const usesDevices = computed(() => modeStore.deviceMode === 'com-dispositivos')
const phaseLabel = computed(() => phasesStore.labelFor(store.phase))
const phaseConfig = computed(() => phasesStore.configFor(store.phase))
const currentPhaseFull = computed(() => phasesStore.phases.find((p) => Number(p.order) === Number(store.phase)))

function redirectIfPresentationPhase(): boolean {
  if (store.teamA && store.teamB) return false
  const type = currentPhaseFull.value?.type
  if (type === 'apresentacao' || type === 'apresentacao_quiz') {
    router.replace('/moderador/apresentacao')
    return true
  }
  return false
}

const totalQuestionsForCounter = computed(() => {
  const perTeam = currentPhaseFull.value?.questionsPerTeam
  return perTeam ? perTeam * 2 : phaseQuestions.value.length
})

const roundIsComplete = computed(() => {
  const perTeam = currentPhaseFull.value?.questionsPerTeam
  if (!perTeam) return false
  return store.teamAAnsweredCount >= perTeam && store.teamBAnsweredCount >= perTeam
})

const isTied = computed(() => roundIsComplete.value && store.teamAScore === store.teamBScore)
const tiebreakResolved = computed(
  () => !!store.tiebreak?.matchId && !store.tiebreak.active && !store.tiebreak.pending
)
const isTiedUnresolved = computed(() => isTied.value && !tiebreakResolved.value)

const tiebreakPhaseQuestions = computed(() => tiebreakQuestions.questionsForPhase(store.phase))
const currentTiebreakQuestion = computed(() =>
  tiebreakPhaseQuestions.value.find((q) => String(q.id) === String(store.tiebreak?.currentQuestionId))
)

const canFinish = computed(() => roundIsComplete.value && !isTiedUnresolved.value && !store.awaitingJuryEvaluation)
const dashboardDisabled = computed(() => store.isRunning)
const isOpenQuestionActive = computed(() => store.currentItemMode === 'aberta')

function endOpenQuestion(): void {
  if (!isOpenQuestionActive.value || !store.isRunning) return
  store.endOpenQuestion()
}

function pickAnswer(team: 'A' | 'B', label: string): void {
  store.submitPlayerAnswer(team, label)
}

function pickTiebreakAnswer(team: 'A' | 'B', label: string): void {
  store.submitTiebreakAnswer(team, label)
}

function startTiebreak(): void {
  store.startTiebreak()
}

function goToDashboard(): void {
  router.push('/moderador/ranking')
}

function finishMatch(): void {
  if (!canFinish.value) return
  store.finishMatch()
  router.push('/moderador/equipas')
}
</script>

<template>
  <div v-if="store.teamA && store.teamB" class="flex-1 flex flex-col bg-petro-bg min-h-screen">
    <header class="flex items-center justify-between px-4 sm:px-8 py-4 bg-white shadow-sm">
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 bg-petro-primary/10 text-petro-primary px-3 py-1.5 rounded-lg font-semibold text-xs sm:text-sm">
          FASE {{ store.phase }} <span class="font-normal">{{ phaseLabel.toUpperCase() }}</span>
        </div>
        <span v-if="isAnalyticActive" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase ml-2">
          Analítica</span>
      </div>
      <LogoMark />
      <div class="flex items-center gap-4 text-xs sm:text-sm text-gray-500">
        <span class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-green-500"></span> ONLINE
        </span>
      </div>
    </header>

    <main v-if="!phaseConfig.useQuestions" class="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-6 text-center gap-4">
      <p class="text-gray-500 text-sm max-w-sm">
        Esta fase não usa perguntas automáticas.
        <span v-if="phaseConfig.useJudges">A pontuação é atribuída pelos Jurados.</span>
      </p>
      <RouterLink
        v-if="phaseConfig.useJudges"
        to="/moderador/jurados"
        class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold"
      >
        Ir para o Painel dos Jurados
      </RouterLink>
    </main>

    <template v-else-if="store.tiebreak?.active || store.tiebreak?.pending">
      <div class="flex items-center justify-center py-3 px-4 sm:px-8">
        <span class="bg-amber-100 text-amber-700 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide">
          ⚔️ Desempate
        </span>
      </div>
      <main v-if="store.tiebreak.pending" class="flex-1 flex flex-col items-center justify-center gap-3 px-4 sm:px-8 py-6">
        <div class="text-6xl font-black text-amber-500">{{ store.countdown.value }}</div>
        <p class="text-sm text-amber-600 font-semibold">O desempate vai começar...</p>
      </main>
      <main v-else-if="currentTiebreakQuestion" class="flex-1 flex flex-col lg:flex-row items-center justify-center gap-4 sm:gap-6 px-4 sm:px-8 py-6 overflow-y-auto">
        <TeamScoreCard
          :name="store.teamA?.name ?? ''"
          :score="store.teamAScore"
          :logo-url="store.teamA?.logoUrl ?? undefined"
          :institution="store.teamA?.institution ?? ''"
          :active="!store.teamAAnswer"
        />
        <QuestionPanel
          :question-text="currentTiebreakQuestion.text"
          :options="currentTiebreakQuestion.options"
          :question-number="1"
          :total-questions="1"
          :time-left="store.timeLeft"
          :correct-index="currentTiebreakQuestion.correctIndex"
          :image-url="currentTiebreakQuestion.imageUrl"
          :team-a-answer="store.teamAAnswer"
          :team-b-answer="store.teamBAnswer"
          :team-a-correct="store.teamACorrect"
          :team-b-correct="store.teamBCorrect"
        />
        <TeamScoreCard
          :name="store.teamB?.name ?? ''"
          :score="store.teamBScore"
          :logo-url="store.teamB?.logoUrl ?? undefined"
          :institution="store.teamB?.institution ?? ''"
          :active="!store.teamBAnswer"
        />
      </main>
      <ModeratorAnswerPicker
        v-if="!usesDevices && currentTiebreakQuestion"
        :team-a-name="store.teamA?.name ?? ''"
        :team-b-name="store.teamB?.name ?? ''"
        :team-a-options="currentTiebreakQuestion.options"
        :team-b-options="currentTiebreakQuestion.options"
        :team-a-answer="store.teamAAnswer"
        :team-b-answer="store.teamBAnswer"
        @pick="pickTiebreakAnswer"
      />
    </template>

    <template v-else-if="store.countdown.active">
      <main class="flex-1 flex flex-col items-center justify-center gap-3 px-4 sm:px-8 py-6">
        <div class="text-6xl font-black text-petro-primary">{{ store.countdown.value }}</div>
        <p class="text-sm text-gray-500 font-semibold">A preparar a primeira pergunta...</p>
      </main>
    </template>

    <template v-else-if="activeDisplay">
      <main class="flex-1 flex flex-col lg:flex-row items-center justify-center gap-4 sm:gap-6 px-4 sm:px-8 py-6 overflow-y-auto">
        <TeamScoreCard
          :name="store.teamA?.name ?? ''"
          :score="store.teamAScore"
          :logo-url="store.teamA?.logoUrl ?? undefined"
          :institution="store.teamA?.institution ?? ''"
          :active="store.activeTeam === 'A' && !store.teamAAnswer"
        />
        <QuestionPanel
          :question-text="activeDisplay.text"
          :options="activeDisplay.options"
          :question-number="store.currentQuestionIndex"
          :total-questions="totalQuestionsForCounter"
          :time-left="store.timeLeft"
          :correct-index="activeDisplay.correctIndex"
          :image-url="activeDisplay.imageUrl ?? undefined"
          :team-a-answer="store.teamAAnswer"
          :team-b-answer="store.teamBAnswer"
          :team-a-correct="store.teamACorrect"
          :team-b-correct="store.teamBCorrect"
        />
        <TeamScoreCard
          :name="store.teamB?.name ?? ''"
          :score="store.teamBScore"
          :logo-url="store.teamB?.logoUrl ?? undefined"
          :institution="store.teamB?.institution ?? ''"
          :active="store.activeTeam === 'B' && !store.teamBAnswer"
        />
      </main>
      <div v-if="isOpenQuestionActive" class="flex items-center justify-center gap-4 py-3 px-4 sm:px-8 border-t border-gray-100">
        <button
          v-if="store.isRunning"
          class="bg-amber-500 text-white rounded-lg px-5 py-2.5 text-sm font-semibold shadow"
          @click="endOpenQuestion"
        >
          ⏹️ Terminar Resposta
        </button>
        <span v-else-if="store.awaitingJuryEvaluation" class="bg-amber-100 text-amber-700 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide">
          ⏳ A aguardar avaliação dos jurados
        </span>
      </div>
      <ModeratorAnswerPicker
        v-if="!usesDevices && !isOpenQuestionActive"
        :team-a-name="store.teamA?.name ?? ''"
        :team-b-name="store.teamB?.name ?? ''"
        :team-a-options="isAnalyticScopeAll || store.activeTeam === 'A' ? activeDisplay.options : []"
        :team-b-options="isAnalyticScopeAll || store.activeTeam === 'B' ? activeDisplay.options : []"
        :team-a-answer="store.teamAAnswer"
        :team-b-answer="store.teamBAnswer"
        @pick="pickAnswer"
      />
    </template>

    <main v-else class="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-6 text-center gap-4">
      <template v-if="roundIsComplete">
        <p v-if="isTiedUnresolved" class="text-amber-700 text-sm font-semibold max-w-sm">
          Empate! ({{ store.teamAScore }} - {{ store.teamBScore }}) - dispara o desempate antes de finalizar.
        </p>
        <button v-if="isTiedUnresolved" class="bg-amber-500 text-white rounded-lg px-6 py-3 font-semibold shadow" @click="startTiebreak">
          ⚔️ Iniciar Desempate
        </button>
        <p v-else class="text-gray-500 text-sm max-w-sm">
          As duas equipas completaram o número de perguntas desta ronda. Já podes finalizar a rodada.
        </p>
      </template>
      <div v-else class="flex flex-col items-center gap-3">
        <p class="text-gray-400 text-sm max-w-sm">
          Ainda não há perguntas cadastradas para a Fase {{ store.phase }}. Vai ao Painel do Administrador para adicionar perguntas.
        </p>
      </div>
    </main>

    <ModeratorControls
      :is-running="store.isRunning"
      :dashboard-disabled="dashboardDisabled"
      :can-finish="canFinish"
      @start="store.startTimer"
      @pause="store.pauseTimer"
      @finish="finishMatch"
      @dashboard="goToDashboard"
    />
  </div>
</template>
