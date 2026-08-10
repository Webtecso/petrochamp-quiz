<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCampeonatoStore } from '../stores/campeonato'
import { useQuizContentStore } from '../stores/quizContent'
import { useTiebreakQuestionsStore } from '../stores/tiebreakQuestions'
import { useModeStore } from '../stores/mode'
import { usePhasesStore } from '../stores/phases'
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
      router.replace('/moderador/equipas')
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
      await tiebreakQuestions.fetchQuestions(store.championship ?? undefined)
      router.replace('/moderador/equipas')
    }
  }
)

onMounted(async () => {
  await phasesStore.fetchPhases(store.championship ?? undefined)
  await quizContent.fetchQuestions(store.championship ?? undefined)
  await tiebreakQuestions.fetchQuestions(store.championship ?? undefined)

  const questionsForCurrentPhase = quizContent.questionsForPhase(store.phase)
  if (!store.currentQuestionId && questionsForCurrentPhase.length > 0) {
    store.forceQuestion(questionsForCurrentPhase[0].id)
  }
  if (!store.activeTeam) {
    store.activeTeam = 'A'
  }
})

const phaseQuestions = computed(() => quizContent.questionsForPhase(store.phase))

const currentQuestion = computed(() => {
  if (!phaseQuestions.value.length) return null
  if (store.currentQuestionId) {
    const found = phaseQuestions.value.find((q) => String(q.id) === String(store.currentQuestionId))
    if (found) return found
  }
  return phaseQuestions.value[0]
})

const usesDevices = computed(() => modeStore.deviceMode === 'com-dispositivos')
const phaseLabel = computed(() => phasesStore.labelFor(store.phase))
const phaseConfig = computed(() => phasesStore.configFor(store.phase))
const currentPhaseFull = computed(() => phasesStore.phases.find((p) => Number(p.order) === Number(store.phase)))

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

const tiebreakPhaseQuestions = computed(() => tiebreakQuestions.questionsForPhase(store.phase))
const currentTiebreakQuestion = computed(() =>
  tiebreakPhaseQuestions.value.find((q) => q.id === store.tiebreak?.currentQuestionId)
)

const canNext = computed(() => {
  if (!store.currentQuestionId) return false
  const perTeam = currentPhaseFull.value?.questionsPerTeam
  if (perTeam) {
    if (store.teamAAnsweredCount >= perTeam && store.teamBAnsweredCount >= perTeam) {
      return false
    }
  }
  return true
})

// CORRIGIDO: só pode finalizar a rodada quando o limite de perguntas por
// equipa desta fase tiver sido mesmo atingido (e, se houver empate, só
// depois do desempate ser resolvido — isTied usa roundIsComplete também).
const canFinish = computed(() => roundIsComplete.value && !isTied.value)
const dashboardDisabled = computed(() => store.isRunning)

function selectQuestion(questionId: number): void {
  store.forceQuestion(questionId)
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

function nextQuestion(): void {
  const perTeam = currentPhaseFull.value?.questionsPerTeam
  if (perTeam) {
    if (store.teamAAnsweredCount >= perTeam && store.teamBAnsweredCount >= perTeam) {
      return
    }
  }
  store.nextQuestion()
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
  <div v-if="store.teamA && store.teamB" class="flex-1 flex flex-col bg-petro-bg">
    <header class="flex items-center justify-between px-8 py-4 bg-white shadow-sm">
      <div class="flex items-center gap-2 bg-petro-primary/10 text-petro-primary px-3 py-1.5 rounded-lg font-semibold text-sm">
        FASE {{ store.phase }} <span class="font-normal">{{ phaseLabel.toUpperCase() }}</span>
      </div>
      <LogoMark />
      <div class="flex items-center gap-4 text-sm text-gray-500">
        <span class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-green-500"></span> ONLINE
        </span>
      </div>
    </header>

    <main v-if="!phaseConfig.useQuestions" class="flex-1 flex flex-col items-center justify-center px-8 py-6 text-center gap-4">
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

    <template v-else-if="store.tiebreak?.active">
      <div class="flex items-center justify-center py-3 px-8">
        <span class="bg-amber-100 text-amber-700 text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide">
          ⚔️ Desempate
        </span>
      </div>
      <main v-if="currentTiebreakQuestion" class="flex-1 flex items-center justify-center gap-6 px-8 py-6">
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

    <template v-else-if="currentQuestion">
      <div class="flex items-center justify-center gap-2 flex-wrap py-3 px-8 bg-gray-50/50 border-b border-gray-100">
        <span class="text-xs text-gray-400 mr-2 font-medium">Selecionar Pergunta:</span>
        <button
          v-for="(q, index) in phaseQuestions"
          :key="q.id"
          class="w-8 h-8 rounded-lg text-xs font-bold border transition shadow-sm"
          :class="q.id === store.currentQuestionId ? 'bg-petro-primary text-white border-petro-primary' : 'bg-white border-gray-200 text-gray-600 hover:border-petro-primary'"
          @click="selectQuestion(q.id)"
        >
          {{ index + 1 }}
        </button>
      </div>
      <main class="flex-1 flex items-center justify-center gap-6 px-8 py-6">
        <TeamScoreCard
          :name="store.teamA?.name ?? ''"
          :score="store.teamAScore"
          :logo-url="store.teamA?.logoUrl ?? undefined"
          :institution="store.teamA?.institution ?? ''"
          :active="store.activeTeam === 'A' && !store.teamAAnswer"
        />
        <QuestionPanel
          :question-text="currentQuestion.text"
          :options="currentQuestion.options"
          :question-number="store.currentQuestionIndex"
          :total-questions="totalQuestionsForCounter"
          :time-left="store.timeLeft"
          :correct-index="currentQuestion.correctIndex"
          :image-url="currentQuestion.imageUrl"
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
      <ModeratorAnswerPicker
        v-if="!usesDevices"
        :team-a-name="store.teamA?.name ?? ''"
        :team-b-name="store.teamB?.name ?? ''"
        :team-a-options="store.activeTeam === 'A' ? currentQuestion.options : []"
        :team-b-options="store.activeTeam === 'B' ? currentQuestion.options : []"
        :team-a-answer="store.teamAAnswer"
        :team-b-answer="store.teamBAnswer"
        @pick="pickAnswer"
      />
    </template>

    <main v-else class="flex-1 flex flex-col items-center justify-center px-8 py-6 text-center gap-4">
      <template v-if="roundIsComplete">
        <p v-if="isTied" class="text-amber-700 text-sm font-semibold max-w-sm">
          Empate! ({{ store.teamAScore }} - {{ store.teamBScore }}) — dispara o desempate antes de finalizar.
        </p>
        <button v-if="isTied" class="bg-amber-500 text-white rounded-lg px-6 py-3 font-semibold shadow" @click="startTiebreak">
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
      :can-next="canNext"
      @start="store.startTimer"
      @pause="store.pauseTimer"
      @next="nextQuestion"
      @finish="finishMatch"
      @dashboard="goToDashboard"
    />
  </div>
</template>
