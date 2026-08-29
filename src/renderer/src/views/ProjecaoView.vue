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
import PresentationRankingBoard from '../components/PresentationRankingBoard.vue'
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
    await quizContent.fetchEvaluationItems(newVal) // NOVO - antes só recarregava perguntas normais e de desempate ao trocar de campeonato; itens analíticos ficavam presos ao campeonato anterior.
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
// NOVO - pool de itens analíticos da fase atual, paralelo a
// 'phaseQuestions'. Sem isto não havia nenhuma forma de encontrar o
// item ativo quando o sorteio caía num item analítico em vez de uma
// pergunta normal.
const phaseEvaluationItems = computed(() => quizContent.itemsForPhase(store.phase))

const currentQuizQuestion = computed(() => phaseQuestions.value.find((q) => q.id === store.currentQuestionId))
// NOVO - item analítico atualmente sorteado, localizado por
// store.currentAnalyticItemId (espelha liveState.currentAnalyticItemId
// do backend).
const currentAnalyticItem = computed(() =>
  phaseEvaluationItems.value.find((i) => i.id === store.currentAnalyticItemId)
)

// CORRIGIDO - antes 'currentQuestion' só olhava para
// store.currentQuestionId, que o backend deixa a 'null' sempre que o
// item sorteado é analítico (currentItemSource === 'analytic'). Como
// resultado, sempre que calhava uma Pergunta Analítica, o ecrã de
// batalha ficava totalmente vazio (sem texto, sem opções, sem imagem)
// - currentQuestion.value era sempre 'undefined' nesse caso. Agora
// escolhemos a fonte certa consoante store.currentItemSource, e todo o
// resto do ecrã (texto, imagem, opções de resposta) passa a funcionar
// igual para os dois tipos de item, porque ambos alimentam o mesmo
// computed.
const currentQuestion = computed(() => {
  if (store.currentItemSource === 'analytic') return currentAnalyticItem.value
  return currentQuizQuestion.value
})

// CORRIGIDO - EvaluationItem usa 'correctIndex' singular (não um array
// 'correctIndexes' como se assumiu antes), igual a QuizQuestion. Basta
// ler diretamente.
const currentQuestionCorrectIndex = computed(() => {
  const q = currentQuestion.value as { correctIndex?: number | null } | undefined
  return typeof q?.correctIndex === 'number' ? q.correctIndex : -1
})

// NOVO - EvaluationItem não tem um campo 'options' (array) como
// QuizQuestion; guarda cada opção em campos separados
// (optionA/B/C/D), e só faz sentido construir a lista quando
// mode === 'multipla_escolha' - em modo 'aberta' não há opções, a
// resposta é avaliada manualmente pelos jurados (fluxo já existente via
// store.awaitingJuryEvaluation). Este computed devolve:
// - o array de opções da pergunta normal (QuizQuestion.options), OU
// - as opções montadas do item analítico em 'multipla_escolha', OU
// - null quando não há opções para mostrar (item analítico 'aberta').
const currentQuestionOptions = computed((): string[] | null => {
  if (store.currentItemSource === 'analytic') {
    const item = currentAnalyticItem.value
    if (!item || item.mode !== 'multipla_escolha') return null
    return [item.optionA, item.optionB, item.optionC, item.optionD].filter(
      (o): o is string => !!o
    )
  }
  const q = currentQuestion.value as { options?: string[] } | undefined
  return q?.options ?? null
})

// NOVO - sinaliza uma pergunta analítica aberta ativa (sem opções, à
// espera de avaliação dos jurados), para o template mostrar uma
// mensagem adequada em vez de tentar renderizar <AnswerOptions> sem
// opções nenhumas.
const isOpenAnalyticQuestion = computed(
  () => store.currentItemSource === 'analytic' && currentAnalyticItem.value?.mode === 'aberta'
)

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
// Passa agora a funcionar também para itens analíticos, já que
// 'currentQuestion' cobre os dois tipos.
const questionImage = computed(() => (currentQuestion.value as { imageUrl?: string | null } | undefined)?.imageUrl ?? null)

// Pergunta de desempate ativa, espelha currentQuestion mas usa
// store.tiebreak.currentQuestionId e a lista carregada de TiebreakQuestion.
const currentTiebreakQuestion = computed(() =>
  quizContent.tiebreakQuestionsForPhase(store.phase).find((q) => q.id === store.tiebreak.currentQuestionId)
)
const tiebreakQuestionImage = computed(() => currentTiebreakQuestion.value?.imageUrl ?? null)

// CORRIGIDO - caminhos relativos (ex: 'uploads/xxx.jpg') resolviam
// apenas para '/uploads/xxx.jpg', que o browser interpretava contra a
// própria origem da Projeção (Vite, porta 5173) - onde esse ficheiro
// não existe. Ele só existe no backend (porta 4000, onde
// express.static('/uploads', ...) está montado). Por isso NENHUMA
// imagem de pergunta, de desempate, ou logo de equipa aparecia, mesmo
// com o caminho gravado corretamente na base de dados - só as slides
// de apresentação em modo documento funcionavam, porque já prefixavam
// com getBackendUrl() à parte. Agora formatImageUrl faz o mesmo para
// todos os casos relativos.
function formatImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('file://')) {
    return url
  }
  if (/^[a-zA-Z]:[\\/]/.test(url)) {
    return `file:///${url.replace(/\\/g, '/')}`
  }
  const path = url.startsWith('/') ? url : `/${url}`
  return `${getBackendUrl()}${path}`
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

const roundJustEnded = computed(() => {
  return (
    matchStarted.value &&
    !currentQuestion.value &&
    !store.tiebreak.active &&
    !store.tiebreak.pending &&
    !store.countdown.active &&
    !store.awaitingJuryEvaluation
  )
})
</script>

<template>
  <div class="relative min-h-screen">
    <!-- Fundo nítido (sem camada por cima) -->
    <div
      class="fixed inset-0 -z-10 bg-cover bg-center"
      :style="{ backgroundImage: `url(${projectionBg})` }"
    ></div>

    <div v-if="store.editionName" class="fixed top-6 left-1/2 -translate-x-1/2 z-40 edition-badge">
      <div class="bg-petro-primary/90 text-white px-5 py-2 rounded-full shadow-lg backdrop-blur-sm">
        <span class="font-bold tracking-widest uppercase" style="font-size: clamp(0.65rem, 1vw, 0.85rem)">{{ store.editionName }}</span>
      </div>
    </div>

    <!-- 1. TELA DE ESPERA INICIAL -->
    <div v-if="!store.championship" class="min-h-screen flex flex-col items-center justify-center gap-6 p-10 text-white">
      <div class="text-center flex flex-col items-center">
        <LogoMark class="mb-6" />
        <h1 class="font-extrabold mb-3 text-amber-400" style="font-size: clamp(1.75rem, 4vw, 3.5rem)">Aguardando Seleção do Campeonato</h1>
        <p class="text-slate-200" style="font-size: clamp(1rem, 1.6vw, 1.5rem)">O moderador irá iniciar a sessão a partir da consola de controlo.</p>
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
        class="object-contain champion-logo z-10"
        style="width: clamp(10rem, 20vw, 20rem); height: clamp(10rem, 20vw, 20rem)"
      />
      <h1 class="font-black text-amber-400 z-10 champion-name text-center" style="font-size: clamp(2.5rem, 6vw, 5.5rem)">
        {{ store.championReveal.teamName ?? 'Campeã' }}
      </h1>
      <p class="text-white/90 z-10 tracking-widest uppercase" style="font-size: clamp(1rem, 1.8vw, 1.5rem)">
        Grande Campeã{{ store.editionName ? ' - ' + store.editionName : '' }}
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

    <!--
      4.5 Batalha terminou (fim da última pergunta do Quiz de um round).
      NOVO - o backend passou a mostrar este estado (phaseFlow.stage ===
      'battleEnded') antes de avançar para ranking/repescagem/parceiros,
      e só avança quando o moderador confirmar
      (moderator:continueAfterBattleEnded). Tem de vir ANTES do bloco
      'ranking' abaixo, porque phaseFlow é o MESMO objeto de estado - se
      isto não estiver aqui em cima, o v-else-if de 'ranking' nunca
      dispara mal a fase muda, mas também nunca existe uma janela visual
      para 'battleEnded' em si.
    -->
    <div
      v-else-if="store.phaseFlow.stage === 'battleEnded'"
      class="min-h-screen flex flex-col items-center justify-center gap-6 p-10 text-white text-center"
    >
      <h2 class="font-black text-amber-400" style="font-size: clamp(2rem, 4.5vw, 3.5rem)">
        A batalha terminou!
      </h2>
      <p style="font-size: clamp(1.1rem, 2vw, 1.75rem)">
        Aguardem - o Moderador vai revelar o ranking a seguir.
      </p>
    </div>

    <!-- 5. Sequência de Fim de Fase -->
    <div
      v-else-if="store.phaseFlow.stage === 'ranking'"
      class="min-h-screen flex flex-col items-center justify-center gap-6 p-10"
    >
      <h2 class="font-bold text-petro-primary" style="font-size: clamp(1.5rem, 2.6vw, 2.25rem)">Ranking da Fase {{ store.phase }}</h2>
      <PhaseRankingBoard :rankings="store.phaseRankings" :eliminated-team-ids="store.eliminatedTeamIds" />
    </div>

    <!--
      6.75 Ranking pós-apresentações (só fase apresentacao_quiz) - NOVO.
      Mostra só as notas de apresentação (sem AVANÇA/ELIMINADA), porque
      nesta fase quem passa só é decidido depois do Quiz, com a média
      ponderada pelos pesos definidos no Admin (ver finishMatch no
      backend). Diferente do bloco 5 acima (store.phaseFlow.stage ===
      'ranking'), que é o ranking real com eliminação, usado só na fase
      'apresentacao' pura - este bloco nunca reaproveita esse componente,
      para não mostrar avança/eliminada indevidamente aqui.
    -->
    <div
      v-else-if="store.phaseFlow.stage === 'presentationRanking'"
      class="min-h-screen flex flex-col items-center justify-center gap-6 p-10"
    >
      <h2 class="font-bold text-petro-primary" style="font-size: clamp(1.5rem, 2.6vw, 2.25rem)">
        Notas de Apresentação - Fase {{ store.phase }}
      </h2>
      <PresentationRankingBoard :rankings="store.presentationPhaseScores" />
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
      :message="store.phaseFlow.suspensePhrase ?? 'Preparem-se - a próxima fase está prestes a começar...'"
      transparent
    />

    <!-- 5.5 Votação de Repescagem -->
    <SuspenseScreen
      v-else-if="store.repescagemReveal.stage === 'suspense'"
      message="A VOTAÇÃO VAI COMEÇAR - Prepare-se!"
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
      <h2 class="font-bold text-amber-400" style="font-size: clamp(1.5rem, 3vw, 2.5rem)">Vote na sua equipa favorita!</h2>
      <div class="flex flex-col gap-4 w-full max-w-2xl">
        <div v-for="t in repescagemStore.tally" :key="t.teamId" class="flex flex-col gap-1">
          <div class="flex items-center justify-between" style="font-size: clamp(0.85rem, 1.3vw, 1.1rem)">
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
      <h2 class="font-black text-amber-400" style="font-size: clamp(2rem, 4.5vw, 3.5rem)">ESTAS EQUIPAS ESTÃO DE VOLTA À COMPETIÇÃO!</h2>
      <p class="text-white/80 uppercase tracking-widest" style="font-size: clamp(0.8rem, 1.2vw, 1rem)">Escolhidas pelo público</p>
      <div class="flex flex-col gap-3 w-full max-w-md">
        <div
          v-for="name in store.repescagemReveal.repescadaNames"
          :key="name"
          class="bg-amber-500/20 border-2 border-amber-400 rounded-xl px-6 py-3 font-bold repescada-glow"
          style="font-size: clamp(1rem, 1.8vw, 1.5rem)"
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

    <!-- 6.6 Em apresentação - modo documento -->
    <div
      v-else-if="store.presentationFlow.stage === 'presenting' && store.presentationFlow.presentationMode === 'document'"
      class="min-h-screen bg-black relative overflow-hidden"
    >
      <div class="absolute top-0 inset-x-0 flex items-start justify-between px-6 py-4 bg-black/70 z-20 text-white gap-4">
        <div class="flex flex-row items-center gap-3 min-w-0">
          <span
            class="font-black text-amber-400 uppercase tracking-wide truncate shrink-0"
            style="font-size: clamp(1rem, 1.6vw, 1.5rem)"
          >
            {{ store.presentationFlow.teamName }}
          </span>
          <span
            v-if="store.presentationFlow.theme"
            class="inline-block bg-white/10 text-white/90 rounded-full px-3 py-1 font-semibold truncate min-w-0"
            style="font-size: clamp(0.7rem, 1.1vw, 0.95rem)"
          >
            {{ store.presentationFlow.theme }}
          </span>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span
            class="bg-amber-500 text-black rounded-full px-4 py-1.5 font-black tracking-wide"
            style="font-size: clamp(0.85rem, 1.2vw, 1.1rem)"
          >
            Slide {{ store.presentationFlow.currentPage }} / {{ store.presentationFlow.slides?.length ?? 0 }}
          </span>
          <span
            class="bg-white text-black rounded-full px-4 py-1.5 font-black tracking-widest tabular-nums"
            style="font-size: clamp(0.85rem, 1.2vw, 1.1rem)"
          >
            {{ String(Math.floor(store.presentationFlow.timeLeft / 60)).padStart(2, '0') }}:{{ String(store.presentationFlow.timeLeft % 60).padStart(2, '0') }}
          </span>
        </div>
      </div>
      <div class="absolute inset-0 pt-20 flex overflow-hidden">
        <div
          class="shrink-0 flex transition-transform duration-500 ease-in-out"
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
    </div>

    <div
      v-else-if="store.presentationFlow.stage === 'presenting'"
      class="min-h-screen flex flex-col items-center justify-center gap-6 p-10 text-white text-center"
    >
      <h2 class="uppercase tracking-widest text-amber-400 font-bold" style="font-size: clamp(0.8rem, 1.2vw, 1rem)">Apresentação de Projetos</h2>
      <p class="font-black" style="font-size: clamp(2.5rem, 6vw, 5.5rem)">{{ store.presentationFlow.teamName }}</p>
      <p class="text-white/80" style="font-size: clamp(1.1rem, 1.8vw, 1.5rem)">Tema: {{ store.presentationFlow.theme }}</p>
      <div class="font-black text-amber-400 mt-4" style="font-size: clamp(4rem, 12vw, 10rem)">
        {{ String(Math.floor(store.presentationFlow.timeLeft / 60)).padStart(2, '0') }}:{{ String(store.presentationFlow.timeLeft % 60).padStart(2, '0') }}
      </div>
    </div>

    <!-- 6.7 Apresentação Concluída -->
    <div
      v-else-if="store.presentationFlow.stage === 'concluded'"
      class="min-h-screen flex flex-col items-center justify-center gap-4 p-10 text-white text-center"
    >
      <h2 class="font-black text-amber-400" style="font-size: clamp(2rem, 4vw, 3.25rem)">Apresentação Concluída</h2>
      <p style="font-size: clamp(1.1rem, 2vw, 1.75rem)">Muito obrigado, {{ store.presentationFlow.teamName }}!</p>
    </div>

    <!-- 6.8 Introdução ao Quiz -->
    <SuspenseScreen
      v-else-if="store.phaseFlow.stage === 'quizIntro'"
      message="Vamos entrar agora para a Batalha de Quiz - as equipas vão disputar para a eliminação!"
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

    <CountdownScreen
      v-else-if="store.tiebreak.pending"
      :seconds="store.countdown.value"
      message="Empate! Vamos ao desempate..."
      transparent
    />

    <!-- 8.5 Desempate - ativo, com pergunta e respostas em tempo real -->
    <div
      v-else-if="store.tiebreak.active"
      class="h-screen w-screen flex flex-col justify-between p-6 select-none overflow-hidden battle-container tiebreak-container"
    >
      <header class="flex flex-col items-center justify-center gap-2 px-4 py-3 w-full max-w-7xl mx-auto shrink-0">
        <div class="bg-red-600 text-white font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg animate-pulse" style="font-size: clamp(0.65rem, 1vw, 0.85rem)">
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
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold tracking-wide bg-red-50 text-red-700 border border-red-200/60"
                style="font-size: clamp(0.65rem, 1vw, 0.85rem)"
                :class="tiebreakQuestionImage ? 'self-start' : 'self-center'"
              >
                <span>⚔️</span> PERGUNTA DE DESEMPATE
              </div>
              <h1
                class="font-extrabold text-slate-800 leading-tight md:leading-snug transition-all duration-300"
                :class="tiebreakQuestionImage ? 'text-left' : 'text-center'"
                :style="{
                  fontSize:
                    currentTiebreakQuestion.text && currentTiebreakQuestion.text.length > 120
                      ? 'clamp(1.4rem, 2.6vw, 2.25rem)'
                      : 'clamp(1.8rem, 3.8vw, 3.5rem)'
                }"
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
        <div v-else class="text-white text-center" style="font-size: clamp(1rem, 1.6vw, 1.25rem)">
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
              <span class="font-black tracking-wider uppercase text-white drop-shadow" style="font-size: clamp(1rem, 1.8vw, 1.5rem)">{{ teamAName }}</span>
            </div>
          </div>
          <div class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div class="bg-[#0a0f1d] px-8 py-2 border-x-2 border-red-400 shadow-2xl transform -skew-x-12 flex items-center justify-center">
              <span class="transform skew-x-12 font-black text-white tracking-widest" style="font-size: clamp(1.25rem, 2vw, 1.75rem)">VS</span>
            </div>
          </div>
          <div class="relative flex-1 bg-gradient-to-l from-[#002b66] via-[#001d47] to-[#000d24] flex items-center justify-end pr-6 pl-12 text-white [clip-path:polygon(15%_0,100%_0,100%_100%,0_100%)] z-10 ml-auto">
            <div class="flex items-center gap-4 flex-row-reverse">
              <div class="w-14 h-14 rounded-full bg-white flex items-center justify-center p-1 shadow-md border-2 border-red-400/60 shrink-0">
                <img v-if="teamBLogo" :src="formatImageUrl(teamBLogo)" :alt="teamBName" class="w-full h-full object-contain rounded-full" />
                <span v-else class="text-gray-900 font-black text-lg">{{ teamBName.slice(0, 3).toUpperCase() }}</span>
              </div>
              <span class="font-black tracking-wider uppercase text-white drop-shadow" style="font-size: clamp(1rem, 1.8vw, 1.5rem)">{{ teamBName }}</span>
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
      message="Todas as apresentações desta fase foram avaliadas - o Moderador vai revelar o ranking."
      transparent
    />

    <SuspenseScreen
      v-else-if="isPresentationPhaseNow && store.presentationFlow.stage === 'idle' && store.phaseFlow.stage === 'idle' && !matchStarted"
      message="A próxima apresentação vai começar dentro de instantes. Aguardem."
      transparent
    />

    <SuspenseScreen
      v-else-if="!matchStarted"
      :message="startMessage"
      transparent
    />

    <!--
      10. BATALHA ATIVA
      CORRIGIDO - este bloco antes só renderizava perguntas normais
      (currentQuestion vinha exclusivamente de store.currentQuestionId).
      Como 'currentQuestion' agora é um computed unificado (ver script),
      este MESMO bloco passa a mostrar corretamente também os itens
      analíticos - o texto, a imagem (agora com formatImageUrl corrigido)
      e as opções de resposta reaproveitam a mesma estrutura já adaptável
      (flex + clamp() + object-contain), que redimensiona a caixa central
      conforme o comprimento do texto e a presença/ausência de imagem.
    -->
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
              <span class="text-gray-400 font-bold uppercase tracking-wider" style="font-size: clamp(0.6rem, 0.9vw, 0.75rem)">PERGUNTA</span>
              <span class="font-black text-gray-800" style="font-size: clamp(0.85rem, 1.3vw, 1.1rem)">
                {{ store.currentQuestionIndex || 1 }} / {{ totalQuestionsForCounter }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex flex-col items-center justify-center text-center">
          <LogoMark />
          <span class="font-bold text-gray-600 tracking-widest uppercase mt-1 whitespace-nowrap" style="font-size: clamp(0.55rem, 0.8vw, 0.7rem)">
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
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold tracking-wide transition-all"
                style="font-size: clamp(0.65rem, 1vw, 0.85rem)"
                :class="questionImage ? 'bg-amber-50 text-amber-700 border border-amber-200/60 self-start' : 'bg-slate-100 text-slate-600 self-center'"
              >
                <span>❓</span> {{ questionImage ? 'ENUNCIADO' : 'QUESTÃO POR RESPONDER' }}
              </div>
              <h1
                class="font-extrabold text-slate-800 leading-tight md:leading-snug transition-all duration-300"
                :class="questionImage ? 'text-left' : 'text-center'"
                :style="{
                  fontSize:
                    currentQuestion?.text && currentQuestion.text.length > 120
                      ? 'clamp(1.4rem, 2.6vw, 2.25rem)'
                      : 'clamp(1.8rem, 3.8vw, 3.5rem)'
                }"
              >
                {{ currentQuestion?.text }}
              </h1>
              <div class="w-full mt-2 text-left">
                <!--
                  CORRIGIDO - usava 'currentQuestion.options' diretamente,
                  mas esse campo só existe em QuizQuestion. Para
                  EvaluationItem (perguntas analíticas), as opções vêm em
                  optionA/B/C/D separados, já tratados pelo computed
                  'currentQuestionOptions' (existia no script mas nunca
                  tinha sido ligado aqui no template - por isso as
                  perguntas analíticas nunca apareciam na Projeção).
                  Para o modo 'aberta' (sem opções, avaliação manual dos
                  jurados) mostramos uma mensagem em vez de tentar
                  renderizar opções inexistentes.
                -->
                <AnswerOptions
                  v-if="currentQuestion && currentQuestionOptions"
                  :options="currentQuestionOptions"
                  :correct-index="currentQuestionCorrectIndex"
                  :team-a-answer="store.teamAAnswer"
                  :team-b-answer="store.teamBAnswer"
                  :team-a-correct="store.teamACorrect"
                  :team-b-correct="store.teamBCorrect"
                />
                <p
                  v-else-if="isOpenAnalyticQuestion"
                  class="text-slate-500 font-semibold"
                  style="font-size: clamp(0.9rem, 1.4vw, 1.15rem)"
                >
                  Pergunta de resposta aberta - avaliação dos jurados em curso.
                </p>
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
                <span class="font-black tracking-wider uppercase text-white drop-shadow" style="font-size: clamp(1rem, 1.8vw, 1.5rem)">
                  {{ teamAName }}
                </span>
                <span class="text-amber-300 font-bold tracking-widest" style="font-size: clamp(0.65rem, 1vw, 0.85rem)">
                  PONTOS: {{ store.teamAScore }}
                </span>
              </div>
            </div>
          </div>
          <div class="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div class="bg-[#0a0f1d] px-8 py-2 border-x-2 border-amber-400 shadow-2xl transform -skew-x-12 flex items-center justify-center">
              <span
                class="transform skew-x-12 font-black text-white tracking-widest drop-shadow-[0_2px_8px_rgba(255,255,255,0.5)]"
                style="font-size: clamp(1.25rem, 2vw, 1.75rem)"
              >
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
                <span class="font-black tracking-wider uppercase text-white drop-shadow" style="font-size: clamp(1rem, 1.8vw, 1.5rem)">
                  {{ teamBName }}
                </span>
                <span class="text-amber-300 font-bold tracking-widest" style="font-size: clamp(0.65rem, 1vw, 0.85rem)">
                  PONTOS: {{ store.teamBScore }}
                </span>
              </div>
            </div>
          </div>
          <div class="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-amber-600 via-amber-300 to-amber-600 z-30"></div>
        </div>
      </footer>
    </div>

    <div
      v-else-if="roundJustEnded"
      class="min-h-screen flex flex-col items-center justify-center gap-6 p-10 text-white text-center"
    >
      <h2 class="font-black text-amber-400" style="font-size: clamp(2rem, 4.5vw, 3.5rem)">
        A batalha terminou!
      </h2>
      <p style="font-size: clamp(1.1rem, 2vw, 1.75rem)">
        Preparem-se - vamos entrar para a próxima batalha.
      </p>
    </div>

    <SuspenseScreen v-else message="A aguardar a próxima pergunta do moderador..." transparent />

    <div
      v-if="store.podiumReveal.finalRankingVisible"
      class="fixed inset-0 z-50 bg-petro-dark/95 flex flex-col items-center justify-center gap-6 p-10"
    >
      <h2 class="font-bold text-white" style="font-size: clamp(1.5rem, 2.8vw, 2.25rem)">Ranking Final do Campeonato</h2>
      <PhaseRankingBoard :rankings="sortedChampionshipRanking" :eliminated-team-ids="[]" />
    </div>
    <div
      v-if="store.phaseRankingReveal.visible"
      class="fixed inset-0 z-50 bg-petro-bg/90 flex flex-col items-center justify-center gap-6 p-10"
    >
      <h2 class="font-bold text-petro-primary" style="font-size: clamp(1.5rem, 2.8vw, 2.25rem)">Ranking da Fase {{ store.phase }}</h2>
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
          <span class="font-semibold" style="font-size: clamp(0.9rem, 1.3vw, 1.1rem)">{{ i + 1 }}º {{ r.name }}</span>
          <div class="flex items-center gap-2">
            <span
              class="font-bold px-2 py-0.5 rounded-full"
              style="font-size: clamp(0.55rem, 0.75vw, 0.65rem)"
              :class="store.eliminatedTeamIds.includes(r.teamId) ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-700'"
            >
              {{ store.eliminatedTeamIds.includes(r.teamId) ? 'ELIMINADA' : 'AVANÇA' }}
            </span>
            <span class="font-bold text-petro-primary" style="font-size: clamp(0.9rem, 1.3vw, 1.1rem)">{{ r.score }} pts</span>
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
