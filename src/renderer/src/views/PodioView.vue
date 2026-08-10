<script setup lang="ts">
import { computed } from 'vue'
import { useCampeonatoStore } from '../stores/campeonato'
import { getBracketFor } from '../data/bracket'
import { getPhaseLabel } from '../data/phases'
import { questions } from '../data/questions'
import PhaseBadge from '../components/PhaseBadge.vue'
import TimerRing from '../components/TimerRing.vue'
import ScoreBanner from '../components/ScoreBanner.vue'
import AnswerOptions from '../components/AnswerOptions.vue'
import SuspenseScreen from '../components/SuspenseScreen.vue'
import TournamentBracket from '../components/TournamentBracket.vue'
import PodiumScreen from '../components/PodiumScreen.vue'

const store = useCampeonatoStore()
const matchStarted = computed(() => !!store.teamA && !!store.teamB)
const bracket = computed(() => (store.championship ? getBracketFor(store.championship) : undefined))
const currentQuestion = computed(() => questions[store.currentQuestionIndex])

const championshipLabels: Record<string, string> = {
  universitario: 'Campeonato Universitário',
  ensino_medio: 'Campeonato Ensino Médio',
  exibicao: 'Batalha de Exibição'
}
</script>

<template>
  <PodiumScreen
    v-if="store.podium.active"
    :phase-number="store.podium.phaseNumber"
    :phase-label="store.podium.phaseLabel"
    :entries="store.podium.entries"
    :is-grand-final="store.podium.isGrandFinal"
  />

  <SuspenseScreen v-else-if="!store.championship" />

  <div
    v-else-if="bracket && !matchStarted"
    class="min-h-screen bg-petro-bg flex flex-col items-center justify-center gap-8 px-10 py-10"
  >
    <TournamentBracket :rounds="bracket.rounds" :final-match="bracket.finalMatch" :title="bracket.title" />
  </div>

  <SuspenseScreen
    v-else-if="!matchStarted"
    :message="`A ${championshipLabels[store.championship!]} vai começar dentro de momentos...`"
  />

  <div v-else class="min-h-screen bg-petro-bg flex flex-col justify-between">
    <header class="flex items-center justify-between px-10 py-6">
      <PhaseBadge :phase="store.phase" :label="getPhaseLabel(store.phase).toUpperCase()" />
      <div class="flex flex-col items-center">
        <div class="text-petro-primary font-bold text-3xl">PETROCHAMP</div>
        <span class="text-xs text-gray-400 tracking-wide">O QUIZ COMPETITIVO DO MUNDO DO PETRÓLEO</span>
      </div>
      <div class="w-32"></div>
    </header>

    <main class="flex-1 flex flex-col items-center justify-center gap-6 px-10">
      <TimerRing :seconds="store.timeLeft" />
      <span class="text-xs text-gray-400 tracking-wide">
        PERGUNTA {{ store.currentQuestionIndex + 1 }} DE {{ questions.length }}
      </span>

      <img
        v-if="currentQuestion.imageUrl"
        :src="currentQuestion.imageUrl"
        alt="Imagem da pergunta"
        class="max-w-xl w-full max-h-64 object-cover rounded-xl"
      />

      <h1 class="text-2xl font-semibold text-center max-w-2xl">
        {{ currentQuestion.text }}
      </h1>

      <div class="w-full max-w-2xl">
        <AnswerOptions :options="currentQuestion.options" />
      </div>
    </main>

    <ScoreBanner
      :team-a-name="store.teamA!.name"
      :team-a-score="store.teamAScore"
      :team-b-name="store.teamB!.name"
      :team-b-score="store.teamBScore"
    />
  </div>
</template>
