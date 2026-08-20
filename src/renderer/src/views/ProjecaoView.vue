<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useCampeonatoStore } from '../stores/campeonato'
import { useQuizContentStore } from '../stores/quizContent'
import { useSettingsStore } from '../stores/settings'
import { usePhasesStore } from '../stores/phases'
import { useLiveBracketStore } from '../stores/liveBracket'
import { useSuspensePhrasesStore } from '../stores/suspensePhrases'
import { useRepescagemStore } from '../stores/repescagem'
import { getBracketFor } from '../data/bracket'
import { getBackendUrl } from '../services/backendConfig'
import { startConfigSync } from '../services/configSync'
import LogoMark from '../components/LogoMark.vue'
import PhaseBadge from '../components/PhaseBadge.vue'
import TimerRing from '../components/TimerRing.vue'
import AnswerOptions from '../components/AnswerOptions.vue'
import SuspenseScreen from '../components/SuspenseScreen.vue'
import TournamentBracket from '../components/TournamentBracket.vue'
import PodiumScreen from '../components/PodiumScreen.vue'
import CountdownScreen from '../components/CountdownScreen.vue'
import PartnerCarousel from '../components/PartnerCarousel.vue'
import WebtecPresentation from '../components/WebtecPresentation.vue'
import EventOrganizerPresentation from '../components/EventOrganizerPresentation.vue'
import PhaseRankingBoard from '../components/PhaseRankingBoard.vue'
import projectionBg from '../assets/projecao-bg.jpg'

const store = useCampeonatoStore()
const quizContent = useQuizContentStore()
const settings = useSettingsStore()
const phasesStore = usePhasesStore()
const liveBracketStore = useLiveBracketStore()
const suspensePhrases = useSuspensePhrasesStore()
const repescagemStore = useRepescagemStore()

const championshipLabels: Record<string, string> = {
  universitario: 'Campeonato Universitário',
  ensino_medio: 'Campeonato Ensino Médio',
  exibicao: 'Batalha de Exibição'
}

onMounted(async () => {
  try {
    store.listenToServer()
    startConfigSync()
    await quizContent.fetchQuestions(store.championship ?? undefined)
    await quizContent.fetchEvaluationItems(store.championship ?? undefined)
    await quizContent.fetchTiebreakQuestions(store.championship ?? undefined) // NOVO
    await settings.fetchSettings()
    await phasesStore.fetchPhases(store.championship ?? undefined)
    await suspensePhrases.fetchPhrases()
    if (store.championship) await liveBracketStore.fetchBracket(store.championship)
  } catch (err) {
    console.error('Erro ao carregar dados na Projeção:', err)
  }
})

watch(
  () => store.bracketVisible,
  async (visible) => {
    if (visible && store.championship) {
      await liveBracketStore.fetchBracket(store.championship)
    }
  }
)

watch(
  () => store.championship,
  async (newVal) => {
    if (!newVal) return
    await quizContent.fetchQuestions(newVal)
    await quizContent.fetchTiebreakQuestions(newVal) // NOVO
    await phasesStore.fetchPhases(newVal)
  }
)

let repescagemPollHandle: ReturnType<typeof setInterval> | null = null
watch(
  () => store.repescagemReveal.stage,
  (stage) => {
    if (repescagemPollHandle) {
      clearInterval(repescagemPollHandle)
      repescagemPollHandle = null
    }
    if (stage === 'voting') {
      repescagemStore.fetchTally()
      repescagemPollHandle = setInterval(() => repescagemStore.fetchTally(), 2000)
    }
  }
)

const maxVotes = computed(() => Math.max(1, ...repescagemStore.tally.map((t) => t.votes)))
const matchStarted = computed(() => !!store.teamA && !!store.teamB)

const bracket = computed(() => {
  if (store.championship && liveBracketStore.matches?.length) {
    const live = liveBracketStore.forTournamentBracket
    if (live && live.rounds && live.rounds.length > 0) {
      const label = championshipLabels[store.championship] || 'Campeonato'
      return { title: `${label} · Chaveamento`, ...live }
    }
  }
  if (store.championship) {
    const staticBracket = getBracketFor(store.championship)
    if (staticBracket) {
      const label = championshipLabels[store.championship] || 'Campeonato'
      return { title: `${label} · Chaveamento`, ...staticBracket }
    }
  }
  return {
    title: 'Chaveamento do Campeonato',
    rounds: [],
    finalMatch: null
  }
})

const phaseQuestions = computed(() => quizContent.questionsForPhase(store.phase))
const currentQuestion = computed(() => phaseQuestions.value.find((q) => q.id === store.currentQuestionId))
const currentPhaseFull = computed(() => phasesStore.phases.find((p) => p.order === store.phase))

const isPresentationPhaseNow = computed(
  () => currentPhaseFull.value?.type === 'apresentacao' || currentPhaseFull.value?.type === 'apresentacao_quiz'
)

const totalQuestionsForCounter = computed(() => {
  const perTeam = currentPhaseFull.value?.questionsPerTeam
  return perTeam ? perTeam * 2 : phaseQuestions.value.length
})

const teamAName = computed(() => store.teamA?.name ?? 'EQUIPA A')
const teamALogo = computed(() => store.teamA?.logoUrl ?? null)
const teamBName = computed(() => store.teamB?.name ?? 'EQUIPA B')
const teamBLogo = computed(() => store.teamB?.logoUrl ?? null)
const questionImage = computed(() => currentQuestion.value?.imageUrl ?? null)

// NOVO — pergunta de desempate ativa, espelha currentQuestion mas usa
// store.tiebreak.currentQuestionId e a lista carregada de TiebreakQuestion.
const currentTiebreakQuestion = computed(() =>
  quizContent.tiebreakQuestionsForPhase(store.phase).find((q) => q.id === store.tiebreak.currentQuestionId)
)
const tiebreakQuestionImage = computed(() => currentTiebreakQuestion.value?.imageUrl ?? null)

function formatImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('file://')) {
    return url
  }
  if (/^[a-zA-Z]:[\\/]/.test(url)) {
    return `file:///${url.replace(/\\/g, '/')}`
  }
  return url.startsWith('/') ? url : `/${url}`
}

const slideCount = computed(() => Math.max(1, store.presentationFlow.slides?.length ?? 0))
const startMessage = computed(() => {
  if (!store.championship) return 'A aguardar o início do evento...'
  const base = `A ${championshipLabels[store.championship]} vai começar dentro de momentos...`
  return suspensePhrases.randomPhrase ? `${base} ${suspensePhrases.randomPhrase}` : base
})

const sortedPhaseRanking = computed(() => [...store.phaseRankings].sort((a, b) => b.score - a.score))
const sortedChampionshipRanking = computed(() => [...store.championshipRankings].sort((a, b) => b.score - a.score))
const highlightQualified = computed(() => store.eliminatedTeamIds.length > 0)

const isPhaseBracketVisible = computed(() => {
  const notInSpecialScreen =
    !store.podium.active &&
    store.podiumReveal.stage === 'idle' &&
    !store.phaseRankingReveal.visible &&
    store.phaseFlow.stage === 'idle' &&
    store.repescagemReveal.stage === 'idle' &&
    store.presentationFlow.stage === 'idle' &&
    !store.championReveal.active &&
    !matchStarted.value
  return notInSpecialScreen && store.bracketVisible
})

const isBattleActiveState = computed(() => {
  return matchStarted.value && !!currentQuestion.value
})
</script>

<template>
  <div class="relative min-h-screen">
    <!-- Fundo nítido (sem camada por cima) -->
    <div
      class="fixed inset-0 -z-10 bg-cover bg-center"
      :style="{ backgroundImage: `url(${projectionBg})` }"
    ></div>

    <div v-if="store.editionName" class="fixed top-6 right-6 z-40 edition-badge">
      <div class="bg-petro-primary/90 text-white px-5 py-2 rounded-full shadow-lg backdrop-blur-sm">
        <span class="text-xs font-bold tracking-widest uppercase">{{ store.editionName }}</span>
      </div>
    </div>

    <!-- 1. TELA DE ESPERA INICIAL -->
    <div v-if="!store.championship" class="min-h-screen flex flex-col items-center justify-center gap-6 p-10 text-white">
      <div class="text-center flex flex-col items-center">
        <LogoMark class="mb-6 scale-125" />
        <h1 class="text-4xl font-extrabold mb-3 text-amber-400">Aguardando Seleção do Campeonato</h1>
        <p class="text-slate-200 text-lg">O moderador irá iniciar a sessão a partir da consola de controlo.</p>
      </div>
    </div>

    <!-- 2. Tela de Vencedor -->
    <div
      v-else-if="store.championReveal.active"
      class="min-h-screen relative overflow-hidden flex flex-col items-center justify-center gap-8 p-10 text-white champion-reveal"
    >
      <div
        v-for="n in 8"
        :key="n"
        class="firework"
        :style="{ left: `${(n * 12) % 100}%`, animationDelay: `${n * 0.35}s` }"
      ></div>
      <img
        v-if="store.championReveal.logoUrl"
        :src="formatImageUrl(store.championReveal.logoUrl)"
        alt="Campeã"
        class="w-56 h-56 object-contain champion-logo z-10"
      />
      <h1 class="text-5xl font-black text-amber-400 z-10 champion-name text-center">
        {{ store.championReveal.teamName ?? 'Campeã' }}
      </h1>
      <p class="text-lg text-white/90 z-10 tracking-widest uppercase">
        Grande Campeã{{ store.editionName ? ' — ' + store.editionName : '' }}
      </p>
    </div>

    <!-- 3. Pódio Ativo -->
    <PodiumScreen
      v-else-if="store.podium.active"
      :phase-number="store.podium.phaseNumber"
      :phase-label="store.podium.phaseLabel"
      :entries="store.podium.entries"
      :is-grand-final="store.podium.isGrandFinal"
      transparent
    />

    <!-- 4. Revelação do Pódio -->
    <SuspenseScreen
      v-else-if="store.podiumReveal.stage === 'suspense'"
      :message="store.podiumReveal.suspensePhrase ?? 'O momento da verdade chegou...'"
      transparent
    />
    <CountdownScreen
      v-else-if="store.podiumReveal.stage === 'countdown'"
      :seconds="store.podiumReveal.countdownValue"
      message="Vamos revelar os campeões..."
      transparent
    />

    <!-- 5. Sequência de Fim de Fase -->
    <div
      v-else-if="store.phaseFlow.stage === 'ranking'"
      class="min-h-screen flex flex-col items-center justify-center gap-6 p-10"
    >
      <h2 class="text-2xl font-bold text-petro-primary">Ranking da Fase {{ store.phase }}</h2>
      <PhaseRankingBoard :rankings="store.phaseRankings" :eliminated-team-ids="store.eliminatedTeamIds" />
    </div>
    <SuspenseScreen
      v-else-if="store.phaseFlow.stage === 'partnersPending'"
      message="A preparar os parceiros..."
      transparent
    />
    <PartnerCarousel v-else-if="store.phaseFlow.stage === 'partners'" transparent />
    <WebtecPresentation v-else-if="store.phaseFlow.stage === 'webtec'" transparent />
    <EventOrganizerPresentation v-else-if="store.phaseFlow.stage === 'organizer'" transparent />
    <SuspenseScreen
      v-else-if="store.phaseFlow.stage === 'suspense'"
      :message="store.phaseFlow.suspensePhrase ?? 'Preparem-se — a próxima fase está prestes a começar...'"
      transparent
    />

    <!-- 5.5 Votação de Repescagem -->
    <SuspenseScreen
      v-else-if="store.repescagemReveal.stage === 'suspense'"
      message="A VOTAÇÃO VAI COMEÇAR — Prepare-se!"
      transparent
    />
    <CountdownScreen
      v-else-if="store.repescagemReveal.stage === 'countdown'"
      :seconds="store.repescagemReveal.countdownValue"
      message="A votação começa em instantes..."
      transparent
    />
    <div
      v-else-if="store.repescagemReveal.stage === 'voting'"
      class="min-h-screen flex flex-col items-center justify-center gap-6 p-10 text-white"
    >
      <h2 class="text-3xl font-bold text-amber-400">Vote na sua equipa favorita!</h2>
      <div class="flex flex-col gap-4 w-full max-w-2xl">
        <div v-for="t in repescagemStore.tally" :key="t.teamId" class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-sm">
            <span class="font-semibold">{{ t.name }}</span>
            <span class="font-bold text-amber-400">{{ t.votes }} votos</span>
          </div>
          <div class="w-full h-4 bg-white/20 rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
              :style="{ width: `${(t.votes / maxVotes) * 100}%` }"
            ></div>
          </div>
        </div>
      </div>
    </div>
    <div
      v-else-if="store.repescagemReveal.stage === 'results'"
      class="min-h-screen flex flex-col items-center justify-center gap-6 p-10 text-white text-center repescagem-results"
    >
      <h2 class="text-4xl font-black text-amber-400">ESTAS EQUIPAS ESTÃO DE VOLTA À COMPETIÇÃO!</h2>
      <p class="text-sm text-white/80 uppercase tracking-widest">Escolhidas pelo público</p>
      <div class="flex flex-col gap-3 w-full max-w-md">
        <div
          v-for="name in store.repescagemReveal.repescadaNames"
          :key="name"
          class="bg-amber-500/20 border-2 border-amber-400 rounded-xl px-6 py-3 font-bold text-lg repescada-glow"
        >
          {{ name }}
        </div>
      </div>
    </div>

    <!-- 6. Transições de Fase manuais -->
    <PartnerCarousel v-else-if="store.phaseTransition.stage === 'carousel'" transparent />
    <WebtecPresentation v-else-if="store.phaseTransition.stage === 'webtec'" transparent />

    <!-- 6.5 APRESENTAÇÃO DE PROJETOS -->
    <CountdownScreen
      v-else-if="store.presentationFlow.stage === 'countdown'"
      :seconds="store.countdown.value"
      :message="`A apresentação de ${store.presentationFlow.teamName} vai começar...`"
      transparent
    />

    <!-- 6.6 Em apresentação — modo documento -->
    <div
      v-else-if="store.presentationFlow.stage === 'presenting' && store.presentationFlow.presentationMode === 'document'"
      class="min-h-screen bg-black relative overflow-hidden"
    >
      <div class="absolute top-0 inset-x-0 flex items-center justify-between px-6 py-3 bg-black/70 z-20 text-white">
        <span class="text-sm font-bold text-amber-400 uppercase tracking-wide">
          {{ store.presentationFlow.teamName }} · {{ store.presentationFlow.theme }}
        </span>
        <div class="flex items-center gap-4 text-xs text-white/70">
          <span>Slide {{ store.presentationFlow.currentPage }} / {{ store.presentationFlow.slides?.length ?? 0 }}</span>
          <span>
            {{ String(Math.floor(store.presentationFlow.timeLeft / 60)).padStart(2, '0') }}:{{ String(store.presentationFlow.timeLeft % 60).padStart(2, '0') }}
          </span>
        </div>
      </div>
      <div
        class="absolute inset-0 flex transition-transform duration-500 ease-in-out"
        :style="{
          transform: `translateX(-${(store.presentationFlow.currentPage - 1) * (100 / slideCount)}%)`,
          width: `${slideCount * 100}%`
        }"
      >
        <div
          v-for="s in store.presentationFlow.slides ?? []"
          :key="s.order"
          class="h-full flex items-center justify-center shrink-0"
          :style="{ width: `${100 / slideCount}%` }"
        >
          <img :src="`${getBackendUrl()}${s.imageUrl}`" class="max-w-full max-h-full object-contain" />
        </div>
      </div>
    </div>

    <div
      v-else-if="store.presentationFlow.stage === 'presenting'"
      class="min-h-screen flex flex-col items-center justify-center gap-6 p-10 text-white text-center"
    >
      <h2 class="text-sm uppercase tracking-widest text-amber-400 font-bold">Apresentação de Projetos</h2>
      <p class="text-4xl font-black">{{ store.presentationFlow.teamName }}</p>
      <p class="text-lg text-white/80">Tema: {{ store.presentationFlow.theme }}</p>
      <div class="text-7xl font-black text-amber-400 mt-4">
        {{ String(Math.floor(store.presentationFlow.timeLeft / 60)).padStart(2, '0') }}:{{ String(store.presentationFlow.timeLeft % 60).padStart(2, '0') }}
      </div>
    </div>

    <!-- 6.7 Apresentação Concluída -->
    <div
      v-else-if="store.presentationFlow.stage === 'concluded'"
      class="min-h-screen flex flex-col items-center justify-center gap-4 p-10 text-white text-center"
    >
      <h2 class="text-3xl font-black text-amber-400">Apresentação Concluída</h2>
      <p class="text-xl">Muito obrigado, {{ store.presentationFlow.teamName }}!</p>
    </div>

    <!-- 6.8 Introdução ao Quiz -->
    <SuspenseScreen
      v-else-if="store.phaseFlow.stage === 'quizIntro'"
      message="Vamos entrar agora para a Batalha de Quiz — as equipas vão disputar para a eliminação!"
      transparent
    />

    <!-- 7. CHAVEAMENTO -->
    <div
      v-else-if="isPhaseBracketVisible"
      class="min-h-screen flex flex-col items-center justify-center gap-8 px-10 py-10 bracket-container"
    >
      <TournamentBracket
        :rounds="bracket.rounds"
        :final-match="bracket.finalMatch"
        :title="bracket.title"
        :eliminated-team-ids="store.eliminatedTeamIds"
        :highlight-qualified="highlightQualified"
      />
    </div>

    <!--
      8.4 Desempate — pendente (5s de contagem antes de sortear a 1ª pergunta).
      IMPORTANTE: fica ANTES do bloco 8 (countdown genérico) porque
      startCountdown() no backend usa o MESMO liveState.countdown para este
      contador de 5s do desempate e também para o de 10s ao escolher equipas —
      sem esta verificação aqui, o countdown do desempate caía no bloco 8
      genérico, sem mensagem de contexto nenhuma.
    -->
    <CountdownScreen
      v-else-if="store.tiebreak.pending"
      :seconds="store.countdown.value"
      message="Empate! Vamos ao desempate..."
      transparent
    />

    <!-- 8.5 Desempate — ativo, com pergunta e respostas em tempo real -->
    <div
      v-else-if="store.tiebreak.active"
      class="h-screen w-screen flex flex-col justify-between p-6 select-none overflow-hidden battle-container tiebreak-container"
    >
      <header class="flex flex-col items-center justify-center gap-2 px-4 py-3 w-full max-w-7xl mx-auto shrink-0">
        <div class="bg-red-600 text-white text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg animate-pulse">
          Desempate
        </div>
        <TimerRing :seconds="store.timeLeft" />
      </header>

      <main class="flex-1 flex flex-col items-center justify-center my-4 px-4 w-full max-w-6xl mx-auto min-h-0">
        <div v-if="currentTiebreakQuestion" class="w-full h-full bg-white rounded-3xl p-8 md:p-10 shadow-2xl border-2 border-red-400/70 relative overflow-hidden flex flex-col justify-center">
          <div class="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-600"></div>
          <div
            class="flex w-full h-full gap-8 md:gap-12 transition-all duration-500"
            :class="tiebreakQuestionImage ? 'flex-col lg:flex-row lg:items-stretch' : 'flex-col items-center justify-center py-8'"
          >
            <div
              class="flex flex-col gap-6 justify-center transition-all duration-500"
              :class="tiebreakQuestionImage ? 'flex-1 min-w-[40%]' : 'w-full max-w-4xl items-center text-center'"
            >
              <div
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide bg-red-50 text-red-700 border border-red-200/60"
                :class="tiebreakQuestionImage ? 'self-start' : 'self-center'"
              >
                <span>⚔️</span> PERGUNTA DE DESEMPATE
              </div>
              <h1
                class="font-extrabold text-slate-800 leading-tight md:leading-snug transition-all duration-300"
                :class="[
                  currentTiebreakQuestion.text && currentTiebreakQuestion.text.length > 120 ? 'text-2xl md:text-3xl' : 'text-3xl md:text-5xl',
                  tiebreakQuestionImage ? 'text-left' : 'text-center'
                ]"
              >
                {{ currentTiebreakQuestion.text }}
              </h1>
              <div class="w-full mt-2 text-left">
                <AnswerOptions
                  :options="currentTiebreakQuestion.options"
                  :correct-index="currentTiebreakQuestion.correctIndex"
                  :team-a-answer="store.teamAAnswer"
                  :team-b-answer="store.teamBAnswer"
                  :team-a-correct="store.teamACorrect"
                  :team-b-correct="store.teamBCorrect"
                />
              </div>
            </div>
            <div
              v-if="tiebreakQuestionImage"
              class="flex-[1.5] flex justify-center items-center bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-red-200 group relative min-h-[300px]"
            >
              <img
                :src="formatImageUrl(tiebreakQuestionImage)"
                alt="Imagem Ilustrativa"
                class="absolute inset-0 w-full h-full object-contain p-2"
              />
            </div>
          </div>
        </div>
        <!-- Fallback: sem pool de perguntas de desempate cadastradas para esta fase -->
        <div v-else class="text-white text-center text-lg">
          A aguardar pergunta de desempate do moderador...
        </div>
      </main>

      <footer class="w-full max-w-7xl mx-auto px-4 mt-2 shrink-0">
        <div class="relative w-full h-20 rounded-2xl bg-[#0a0f1d] border border-red-500/40 shadow-2xl overflow-hidden flex items-stretch">
          <div class="relative flex-1 bg-gradient-to-r from-[#800010] via-[#60000c] to-[#3a0007] flex items-center justify-start pl-6 pr-12 text-white [clip-path:polygon(0_0,100%_0,85%_100%,0_100%)] z-10">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-full bg-white flex items-center justify-center p-1 shadow-md border-2 border-red-400/60 shrink-0">
                <img v-if="teamALogo" :src="formatImageUrl(teamALogo)" :alt="teamAName" class="w-full h-full object-contain rounded-full" />
                <span v-else class="text-gray-900 font-black text-lg">{{ teamAName.slice(0, 3).toUpperCase() }}</span>
              </div>
              <span class="text-xl md:text-2xl font-black tracking-wider uppercase text-white drop-shadow">{{ teamAName }}</span>
            </div>
          </div>
          <div class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div class="bg-[#0a0f1d] px-8 py-2 border-x-2 border-red-400 shadow-2xl transform -skew-x-12 flex items-center justify-center">
              <span class="transform skew-x-12 text-2xl md:text-3xl font-black text-white tracking-widest">VS</span>
            </div>
          </div>
          <div class="relative flex-1 bg-gradient-to-l from-[#002b66] via-[#001d47] to-[#000d24] flex items-center justify-end pr-6 pl-12 text-white [clip-path:polygon(15%_0,100%_0,100%_100%,0_100%)] z-10 ml-auto">
            <div class="flex items-center gap-4 flex-row-reverse">
              <div class="w-14 h-14 rounded-full bg-white flex items-center justify-center p-1 shadow-md border-2 border-red-400/60 shrink-0">
                <img v-if="teamBLogo" :src="formatImageUrl(teamBLogo)" :alt="teamBName" class="w-full h-full object-contain rounded-full" />
                <span v-else class="text-gray-900 font-black text-lg">{{ teamBName.slice(0, 3).toUpperCase() }}</span>
              </div>
              <span class="text-xl md:text-2xl font-black tracking-wider uppercase text-white drop-shadow">{{ teamBName }}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>

    <!-- 8. Contagem Regressiva Geral -->
    <CountdownScreen
      v-else-if="store.countdown.active"
      :seconds="store.countdown.value"
      transparent
    />

    <SuspenseScreen
      v-else-if="isPresentationPhaseNow && store.presentationRoundReady"
      message="Todas as apresentações desta fase foram avaliadas — o Moderador vai revelar o ranking."
      transparent
    />

    <!-- 9a. Entre apresentações (fase de Apresentação, ninguém a apresentar agora) -->
    <SuspenseScreen
      v-else-if="isPresentationPhaseNow && store.presentationFlow.stage === 'idle' && store.phaseFlow.stage === 'idle' && !matchStarted"
      message="A próxima apresentação vai começar dentro de instantes. Aguardem."
      transparent
    />

    <!-- 9. Aguardar Início da Batalha -->
    <SuspenseScreen
      v-else-if="!matchStarted"
      :message="startMessage"
      transparent
    />

    <!-- 10. BATALHA ATIVA -->
    <div
      v-else-if="isBattleActiveState"
      class="h-screen w-screen flex flex-col justify-between p-6 select-none overflow-hidden battle-container"
    >
      <header class="grid grid-cols-3 items-center px-4 py-2 w-full max-w-7xl mx-auto shrink-0">
        <div class="flex items-center justify-start">
          <div class="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-gray-200/80 shadow-sm">
            <PhaseBadge :phase="store.phase" :label="phasesStore.labelFor(store.phase).toUpperCase()" />
            <div class="h-6 w-px bg-gray-200"></div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-gray-400 font-bold uppercase tracking-wider">PERGUNTA</span>
              <span class="text-base font-black text-gray-800">
                {{ store.currentQuestionIndex || 1 }} / {{ totalQuestionsForCounter }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex flex-col items-center justify-center text-center">
          <LogoMark />
          <span class="text-[10px] font-bold text-gray-600 tracking-widest uppercase mt-1 whitespace-nowrap">
            O QUIZ COMPETITIVO DO MUNDO DO PETRÓLEO
          </span>
        </div>
        <div class="flex items-center justify-end">
          <TimerRing :seconds="store.timeLeft" />
        </div>
      </header>

      <main class="flex-1 flex flex-col items-center justify-center my-4 px-4 w-full max-w-6xl mx-auto min-h-0">
        <div class="w-full h-full bg-white rounded-3xl p-8 md:p-10 shadow-2xl border border-gray-100/90 relative overflow-hidden flex flex-col justify-center">
          <div class="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-red-600 to-blue-600"></div>
          <div
            class="flex w-full h-full gap-8 md:gap-12 transition-all duration-500"
            :class="questionImage ? 'flex-col lg:flex-row lg:items-stretch' : 'flex-col items-center justify-center py-8'"
          >
            <div
              class="flex flex-col gap-6 justify-center transition-all duration-500"
              :class="questionImage ? 'flex-1 min-w-[40%]' : 'w-full max-w-4xl items-center text-center'"
            >
              <div
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all"
                :class="questionImage ? 'bg-amber-50 text-amber-700 border border-amber-200/60 self-start' : 'bg-slate-100 text-slate-600 self-center'"
              >
                <span>❓</span> {{ questionImage ? 'ENUNCIADO' : 'QUESTÃO POR RESPONDER' }}
              </div>
              <h1
                class="font-extrabold text-slate-800 leading-tight md:leading-snug transition-all duration-300"
                :class="[
                  currentQuestion?.text && currentQuestion.text.length > 120 ? 'text-2xl md:text-3xl' : 'text-3xl md:text-5xl',
                  questionImage ? 'text-left' : 'text-center'
                ]"
              >
                {{ currentQuestion?.text }}
              </h1>
              <div class="w-full mt-2 text-left">
                <AnswerOptions
                  v-if="currentQuestion"
                  :options="currentQuestion.options"
                  :correct-index="currentQuestion.correctIndex"
                  :team-a-answer="store.teamAAnswer"
                  :team-b-answer="store.teamBAnswer"
                  :team-a-correct="store.teamACorrect"
                  :team-b-correct="store.teamBCorrect"
                />
              </div>
            </div>
            <div
              v-if="questionImage"
              class="flex-[1.5] flex justify-center items-center bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-gray-200 group relative min-h-[300px]"
            >
              <img
                :src="formatImageUrl(questionImage)"
                alt="Imagem Ilustrativa"
                class="absolute inset-0 w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>
        </div>
      </main>

      <footer class="w-full max-w-7xl mx-auto px-4 mt-2 shrink-0">
        <div class="relative w-full h-20 rounded-2xl bg-[#0a0f1d] border border-amber-500/30 shadow-2xl overflow-hidden flex items-stretch">
          <div
            class="relative flex-1 bg-gradient-to-r from-[#800010] via-[#60000c] to-[#3a0007] flex items-center justify-start pl-6 pr-12 text-white [clip-path:polygon(0_0,100%_0,85%_100%,0_100%)] z-10 transition-all duration-300"
            :class="store.activeTeam === 'A' ? 'team-turn-glow' : ''"
          >
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-full bg-white flex items-center justify-center p-1 shadow-md border-2 border-amber-400/50 shrink-0">
                <img
                  v-if="teamALogo"
                  :src="formatImageUrl(teamALogo)"
                  :alt="teamAName"
                  class="w-full h-full object-contain rounded-full"
                />
                <span v-else class="text-gray-900 font-black text-lg">
                  {{ teamAName.slice(0, 3).toUpperCase() }}
                </span>
              </div>
              <div class="flex flex-col">
                <span class="text-xl md:text-2xl font-black tracking-wider uppercase text-white drop-shadow">
                  {{ teamAName }}
                </span>
                <span class="text-xs text-amber-300 font-bold tracking-widest">
                  PONTOS: {{ store.teamAScore }}
                </span>
              </div>
            </div>
          </div>
          <div class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div class="bg-[#0a0f1d] px-8 py-2 border-x-2 border-amber-400 shadow-2xl transform -skew-x-12 flex items-center justify-center">
              <span class="transform skew-x-12 text-2xl md:text-3xl font-black text-white tracking-widest drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)]">
                VS
              </span>
            </div>
          </div>
          <div
            class="relative flex-1 bg-gradient-to-l from-[#002b66] via-[#001d47] to-[#000d24] flex items-center justify-end pr-6 pl-12 text-white [clip-path:polygon(15%_0,100%_0,100%_100%,0_100%)] z-10 ml-auto transition-all duration-300"
            :class="store.activeTeam === 'B' ? 'team-turn-glow' : ''"
          >
            <div class="flex items-center gap-4 flex-row-reverse">
              <div class="w-14 h-14 rounded-full bg-white flex items-center justify-center p-1 shadow-md border-2 border-amber-400/50 shrink-0">
                <img
                  v-if="teamBLogo"
                  :src="formatImageUrl(teamBLogo)"
                  :alt="teamBName"
                  class="w-full h-full object-contain rounded-full"
                />
                <span v-else class="text-gray-900 font-black text-lg">
                  {{ teamBName.slice(0, 3).toUpperCase() }}
                </span>
              </div>
              <div class="flex flex-col items-end text-right">
                <span class="text-xl md:text-2xl font-black tracking-wider uppercase text-white drop-shadow">
                  {{ teamBName }}
                </span>
                <span class="text-xs text-amber-300 font-bold tracking-widest">
                  PONTOS: {{ store.teamBScore }}
                </span>
              </div>
            </div>
          </div>
          <div class="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-amber-600 via-amber-300 to-amber-600 z-30"></div>
        </div>
      </footer>
    </div>

    <!-- 11. Fallback -->
    <SuspenseScreen v-else message="A aguardar a próxima pergunta do moderador..." transparent />

    <!-- Sobreposições -->
    <div
      v-if="store.podiumReveal.finalRankingVisible"
      class="fixed inset-0 z-50 bg-petro-dark/95 flex flex-col items-center justify-center gap-6 p-10"
    >
      <h2 class="text-2xl font-bold text-white">Ranking Final do Campeonato</h2>
      <PhaseRankingBoard :rankings="sortedChampionshipRanking" :eliminated-team-ids="[]" />
    </div>
    <div
      v-if="store.phaseRankingReveal.visible"
      class="fixed inset-0 z-50 bg-petro-bg/90 flex flex-col items-center justify-center gap-6 p-10"
    >
      <h2 class="text-2xl font-bold text-petro-primary">Ranking da Fase {{ store.phase }}</h2>
      <div class="flex flex-col gap-3 w-full max-w-lg">
        <div
          v-for="(r, i) in sortedPhaseRanking"
          :key="r.teamId"
          class="flex items-center justify-between rounded-xl px-5 py-3 transition-all duration-500"
          :class="
            store.eliminatedTeamIds.includes(r.teamId)
              ? 'bg-gray-100 opacity-50'
              : 'bg-white shadow ring-2 ring-yellow-300 phase-rank-glow'
          "
        >
          <span class="font-semibold">{{ i + 1 }}º {{ r.name }}</span>
          <div class="flex items-center gap-2">
            <span
              class="text-[10px] font-bold px-2 py-0.5 rounded-full"
              :class="store.eliminatedTeamIds.includes(r.teamId) ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-700'"
            >
              {{ store.eliminatedTeamIds.includes(r.teamId) ? 'ELIMINADA' : 'AVANÇA' }}
            </span>
            <span class="font-bold text-petro-primary">{{ r.score }} pts</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.repescada-glow {
  animation: repescadaPulse 1.8s ease-in-out infinite;
}
@keyframes repescadaPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.4); }
  50% { box-shadow: 0 0 25px 4px rgba(251, 191, 36, 0.5); }
}
.team-turn-glow {
  animation: bgLightPulse 0.9s infinite alternate ease-in-out;
  z-index: 20 !important;
}
.team-turn-glow .rounded-full {
  animation: avatarAuraPulse 0.9s infinite alternate ease-in-out !important;
}
.team-turn-glow .uppercase {
  animation: textNeonPulse 0.9s infinite alternate ease-in-out;
}
@keyframes bgLightPulse {
  0% { filter: brightness(1) contrast(1); }
  100% { filter: brightness(1.35) contrast(1.05); }
}
@keyframes avatarAuraPulse {
  0% { box-shadow: 0 0 0px rgba(251, 191, 36, 0); border-color: rgba(251, 191, 36, 0.4); }
  100% { box-shadow: 0 0 25px 8px rgba(251, 191, 36, 0.85); border-color: rgb(251, 191, 36); }
}
@keyframes textNeonPulse {
  0% { text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
  100% { text-shadow: 0 0 12px rgba(255, 255, 255, 0.9), 0 0 25px rgba(251, 191, 36, 0.8); }
}
.phase-rank-glow {
  animation: phaseRankPulse 2s ease-in-out infinite;
}
@keyframes phaseRankPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(250, 204, 21, 0); }
}
.edition-badge {
  animation: editionBadgeIn 0.8s cubic-bezier(0.22, 1, 0.36, 1) both,
             editionBadgeGlow 3s ease-in-out infinite 0.8s;
}
@keyframes editionBadgeIn {
  from { transform: translateY(-20px) scale(0.9); opacity: 0; }
  to { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes editionBadgeGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); }
  50% { box-shadow: 0 0 20px 4px rgba(212, 175, 55, 0.35); }
}
.firework {
  position: absolute;
  top: 25%;
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: radial-gradient(circle, #fde68a, #f59e0b, transparent 70%);
  animation: fireworkBurst 2.4s ease-out infinite;
}
@keyframes fireworkBurst {
  0% { transform: translateY(0) scale(0); opacity: 0; box-shadow: none; }
  12% { opacity: 1; }
  45% {
    transform: translateY(-180px) scale(1);
    box-shadow:
      0 0 0 2px rgba(253, 230, 138, 0.9),
      40px 20px 0 2px rgba(253, 230, 138, 0.8),
      -40px 20px 0 2px rgba(253, 230, 138, 0.8),
      30px -30px 0 2px rgba(245, 158, 11, 0.8),
      -30px -30px 0 2px rgba(245, 158, 11, 0.8),
      0px -50px 0 2px rgba(245, 158, 11, 0.7);
  }
  100% { transform: translateY(-220px) scale(1.4); opacity: 0; }
}
.champion-logo {
  animation: championLogoIn 1.2s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes championLogoIn {
  from { transform: scale(0.4) rotate(-15deg); opacity: 0; }
  to { transform: scale(1) rotate(0deg); opacity: 1; }
}
.champion-name {
  animation: championNamePulse 1.6s ease-in-out infinite;
}
@keyframes championNamePulse {
  0%, 100% { text-shadow: 0 0 20px rgba(251, 191, 36, 0.6); }
  50% { text-shadow: 0 0 40px rgba(251, 191, 36, 1); }
}
</style>
