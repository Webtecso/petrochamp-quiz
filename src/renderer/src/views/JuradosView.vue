<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCampeonatoStore } from '../stores/campeonato'
import { useJuradosStore } from '../stores/jurados'
import { useQuizContentStore, type EvaluationCriteria } from '../stores/quizContent'
import { useSettingsStore } from '../stores/settings'
import { usePhasesStore } from '../stores/phases'
import { getBackendUrl } from '../services/backendConfig'
import { startConfigSync } from '../services/configSync'
import type { EvaluationItem } from '../data/evaluationItems'
import LogoRed from '@renderer/components/LogoRed.vue'

interface PresentationCriteria {
  id: number
  label: string
  maxPoints: number
}

const store = useCampeonatoStore()
const jurados = useJuradosStore()
const quizContent = useQuizContentStore()
const settings = useSettingsStore()
const phasesStore = usePhasesStore()

onMounted(async () => {
  await phasesStore.fetchPhases(store.championship ?? undefined)
  await settings.fetchSettings()
  jurados.listenToServer()
  startConfigSync()
})

watch(
  () => store.championship,
  (val) => phasesStore.fetchPhases(val ?? undefined)
)

const currentPhaseRecord = computed(() =>
  phasesStore.phases.find((p) => p.order === store.phase)
)

const isPresentationPhase = computed(
  () => currentPhaseRecord.value?.type === 'apresentacao' || currentPhaseRecord.value?.type === 'apresentacao_quiz'
)
const hasBattle = computed(() => !!store.teamA && !!store.teamB)

const phaseConfig = computed(() => phasesStore.configFor(store.phase))
const evaluationItems = computed(() => quizContent.itemsForPhase(store.phase))
const openItems = computed(() => evaluationItems.value.filter((i) => i.mode !== 'multipla_escolha'))

function jurorsAllowedFor(item: EvaluationItem | undefined): typeof jurados.jurors {
  if (!item || !item.jurorIds || item.jurorIds.length === 0) return jurados.jurors
  return jurados.jurors.filter((j) => item.jurorIds!.includes(j.id))
}

const newJurorName = ref('')
const newJurorCode = ref('')
const registerError = ref('')

async function addJuror(): Promise<void> {
  if (jurados.jurors.length >= settings.maxJurors) return
  const code = (newJurorCode.value || '').trim().toUpperCase()
  if (!code) {
    registerError.value = 'Introduz o código do jurado.'
    return
  }
  const result = await jurados.registerJuror(code)
  if (!result.success) {
    registerError.value = result.error || 'Falha ao registar jurado.'
    return
  }
  registerError.value = ''
  newJurorName.value = ''
  newJurorCode.value = ''
}

// ==================== Notas Iniciais ====================

function initialScoreFor(jurorId: string, team: 'a' | 'b'): number {
  const entry = jurados.initialEntryFor(jurorId)
  return team === 'a' ? (entry?.scoreA ?? 0) : (entry?.scoreB ?? 0)
}

function updateInitialScore(jurorId: string, team: 'a' | 'b', value: number): void {
  const max = phaseConfig.value.initialScoreMaxPoints ?? 999
  const clamped = Math.min(Math.max(value, 0), max)
  const currentA = initialScoreFor(jurorId, 'a')
  const currentB = initialScoreFor(jurorId, 'b')
  jurados.setInitialScore(jurorId, team === 'a' ? clamped : currentA, team === 'b' ? clamped : currentB)
}

function confirmInitialScores(): void {
  if (jurados.initialScoresConfirmed) return
  jurados.confirmInitialScores()
}

// ==================== Perguntas Analíticas - nota única (sem critérios) ====================
// Usado só quando o item ativo NÃO tem critérios definidos (ver bloco
// "Avaliação por Critérios" abaixo, que assume prioridade quando existem).

const selectedItemId = ref('')
watch(openItems, (items) => {
  if (!selectedItemId.value && items.length) selectedItemId.value = items[0].id
})
const selectedItem = computed(() => openItems.value.find((i) => i.id === selectedItemId.value))
const itemSubmitted = computed(() => (selectedItem.value ? jurados.isSubmitted(selectedItem.value.id) : false))
const allowedJurorsForSelected = computed(() => jurorsAllowedFor(selectedItem.value))

// NOVO - este item específico tem critérios? Se sim, a UI de nota única
// abaixo fica escondida e usa-se o bloco de critérios em vez dela.
const selectedItemHasCriteria = computed(() => {
  if (!selectedItem.value) return false
  return quizContent.criteriaForItem(selectedItem.value.id).length > 0
})

const allJurorsScored = computed(() => {
  if (!selectedItem.value) return false
  if (jurados.jurors.length < store.expectedJurorCount) return false
  return jurados.jurors.every((j) =>
    jurados.entries.some((e) => e.jurorId === j.id && e.itemId === selectedItem.value!.id)
  )
})

function scoreFor(jurorId: string, team: 'a' | 'b'): number {
  if (!selectedItem.value) return 0
  const entry = jurados.entryFor(jurorId, selectedItem.value.id)
  return team === 'a' ? (entry?.scoreA ?? 0) : (entry?.scoreB ?? 0)
}

function updateScore(jurorId: string, team: 'a' | 'b', value: number): void {
  if (!selectedItem.value) return
  const clamped = Math.min(Math.max(value, 0), selectedItem.value.maxPoints)
  const currentA = scoreFor(jurorId, 'a')
  const currentB = scoreFor(jurorId, 'b')
  jurados.setEntry(
    jurorId,
    selectedItem.value.id,
    team === 'a' ? clamped : currentA,
    team === 'b' ? clamped : currentB
  )
}

const totals = computed(() =>
  selectedItem.value ? jurados.totalsForItem(selectedItem.value.id) : { totalA: 0, totalB: 0 }
)

function confirmItem(): void {
  if (!selectedItem.value || itemSubmitted.value || !allJurorsScored.value) return
  jurados.confirmItem(selectedItem.value.id)
}

// ==================== NOVO - Avaliação por Critérios (Pergunta Analítica) ====================
// Abre automaticamente quando liveState.analyticEvaluation.itemId (via
// store, sincronizado por socket) aponta para uma pergunta com critérios -
// não precisa de nenhuma ação do moderador ou dos jurados para aparecer.

const activeAnalyticItemId = computed(() => store.analyticEvaluation.itemId)
const activeAnalyticItem = computed(() =>
  evaluationItems.value.find((i) => i.id === activeAnalyticItemId.value)
)
const analyticCriteria = ref<EvaluationCriteria[]>([])

watch(
  activeAnalyticItemId,
  async (itemId) => {
    if (!itemId) {
      analyticCriteria.value = []
      return
    }
    await quizContent.fetchEvaluationCriteria(itemId)
    analyticCriteria.value = quizContent.criteriaForItem(itemId)
  },
  { immediate: true }
)

const analyticAllowedJurors = computed(() => jurorsAllowedFor(activeAnalyticItem.value))
const missingAnalyticJurors = computed(() =>
  analyticAllowedJurors.value.filter((juror) => !jurorHasSubmittedAnalytic(juror.id))
)

function jurorHasSubmittedAnalytic(jurorId: string): boolean {
  return store.analyticEvaluation.jurorsSubmitted.includes(jurorId)
}

function analyticScoreFor(jurorId: string, criteriaId: string, team: 'A' | 'B'): number {
  const entry = store.analyticEvaluation.criteriaScores.find(
    (e) => e.jurorId === jurorId && e.criteriaId === criteriaId && e.team === team
  )
  return entry?.score ?? 0
}

function updateAnalyticScore(jurorId: string, criteriaId: string, team: 'A' | 'B', maxPoints: number, value: number): void {
  const clamped = Math.min(Math.max(value, 0), maxPoints)
  store.setAnalyticCriteriaScore(jurorId, criteriaId, team, clamped)
}

function jurorAnalyticTotal(jurorId: string, team: 'A' | 'B'): number {
  return store.analyticEvaluation.criteriaScores
    .filter((e) => e.jurorId === jurorId && e.team === team)
    .reduce((sum, e) => sum + e.score, 0)
}

function submitAnalyticEvaluation(jurorId: string): void {
  if (!activeAnalyticItemId.value || jurorHasSubmittedAnalytic(jurorId)) return
  store.submitAnalyticEvaluation(jurorId, activeAnalyticItemId.value)
}

const allAnalyticJurorsSubmitted = computed(() => {
  if (!activeAnalyticItemId.value || !analyticCriteria.value.length) return false
  const allowed = analyticAllowedJurors.value
  if (allowed.length === 0) return false
  return allowed.every((juror) => jurorHasSubmittedAnalytic(juror.id))
})

const canAdvanceAnalyticEvaluation = computed(() => allAnalyticJurorsSubmitted.value)

function advanceAnalyticEvaluation(): void {
  if (!canAdvanceAnalyticEvaluation.value) return
}

// ==================== Apresentação de Projetos ====================

const presentationCriteria = ref<PresentationCriteria[]>([])

async function loadPresentationCriteria(): Promise<void> {
  if (!currentPhaseRecord.value) {
    presentationCriteria.value = []
    return
  }
  const res = await fetch(`${getBackendUrl()}/api/presentation/criteria?phaseId=${currentPhaseRecord.value.id}`)
  presentationCriteria.value = await res.json()
}

watch(currentPhaseRecord, loadPresentationCriteria, { immediate: true })

const totalCriteriaPoints = computed(() => presentationCriteria.value.reduce((sum, c) => sum + c.maxPoints, 0))

function presentationScoreFor(jurorId: string, criteriaId: number): number {
  const entry = store.presentationFlow.criteriaScores.find((e) => e.jurorId === jurorId && e.criteriaId === criteriaId)
  return entry?.score ?? 0
}

function updatePresentationScore(jurorId: string, criteriaId: number, maxPoints: number, value: number): void {
  const clamped = Math.min(Math.max(value, 0), maxPoints)
  store.setPresentationScore(jurorId, criteriaId, clamped)
}

function jurorPresentationTotal(jurorId: string): number {
  return store.presentationFlow.criteriaScores
    .filter((e) => e.jurorId === jurorId)
    .reduce((sum, e) => sum + e.score, 0)
}

function jurorHasSubmittedPresentation(jurorId: string): boolean {
  return store.presentationFlow.jurorsSubmitted.includes(jurorId)
}

function submitPresentation(jurorId: string): void {
  if (jurorHasSubmittedPresentation(jurorId)) return
  store.submitPresentationEvaluation(jurorId)
}

const presentationStageLabel = computed(() => {
  switch (store.presentationFlow.stage) {
    case 'countdown':
      return 'A preparar a apresentação...'
    case 'presenting':
      return 'Em apresentação'
    case 'concluded':
      return 'Apresentação concluída - a aguardar avaliações'
    default:
      return ''
  }
})
</script>

<template>
  <div class="min-h-screen bg-petro-bg flex flex-col items-center px-8 py-10 gap-6">
    <LogoRed />
    <div class="text-xs font-semibold text-petro-primary uppercase tracking-wide" style="font-size: large;">Painel dos Jurados</div>

    <!-- Registo de jurado -->
    <div v-if="!jurados.jurors.length && !jurados.myJurorId" class="w-full max-w-md bg-petro-card p-6 rounded-2xl border border-white/10 flex flex-col gap-3">
      <p>Nome do Jurado</p>
      <input
        v-model="newJurorName"
        type="text"
        placeholder="Nome do jurado (opcional)"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-transparent text-red"
      />

      <p>Código do Jurado</p>
      <input
        v-model="newJurorCode"
        type="text"
        placeholder="Código do jurado (4 dígitos)"
        class="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-transparent text-red"
      />
      <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold" @click="addJuror">
        Registar
      </button>
      <p v-if="registerError" class="text-xs text-red-400">{{ registerError }}</p>
    </div>

    <div
      v-if="activeAnalyticItem && analyticCriteria.length"
      class="w-full max-w-4xl bg-petro-card p-6 rounded-2xl flex flex-col gap-4 border border-white/10"
    >
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-lg font-bold text-white">{{ activeAnalyticItem.text }}</h3>
        <div class="flex items-center gap-3">
          <span v-if="allAnalyticJurorsSubmitted" class="text-xs text-emerald-400 font-medium">
            ✓ Todos os jurados avaliaram
          </span>
          <span v-else class="text-xs text-amber-400">
            {{ missingAnalyticJurors.length }} de {{ analyticAllowedJurors.length }} jurados por confirmar
          </span>
          <button
            v-if="canAdvanceAnalyticEvaluation"
            class="px-4 py-1.5 rounded-lg bg-petro-primary text-white font-semibold text-xs"
            @click="advanceAnalyticEvaluation"
          >
            Avançar
          </button>
        </div>
      </div>

      <div v-for="juror in analyticAllowedJurors" :key="juror.id" class="border border-white/10 rounded-xl p-4 flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-gray-800">{{ juror.name }}</span>
          <span v-if="jurorHasSubmittedAnalytic(juror.id)" class="text-xs text-emerald-400">✓ Avaliação enviada</span>
        </div>

        <div v-for="c in analyticCriteria" :key="c.id" class="grid grid-cols-3 gap-3 items-center">
          <span class="text-sm text-gray-700">{{ c.label }} <span class="text-gray-400">/{{ c.maxPoints }}</span></span>
          <input
            type="number"
            min="0"
            :max="c.maxPoints"
            :value="analyticScoreFor(juror.id, c.id, 'A')"
            :disabled="jurorHasSubmittedAnalytic(juror.id)"
            @input="updateAnalyticScore(juror.id, c.id, 'A', c.maxPoints, Number(($event.target as HTMLInputElement).value))"
            class="border border-white/20 rounded-lg px-2 py-1.5 text-sm bg-transparent text-white"
            placeholder="Equipa A"
          />
          <input
            type="number"
            min="0"
            :max="c.maxPoints"
            :value="analyticScoreFor(juror.id, c.id, 'B')"
            :disabled="jurorHasSubmittedAnalytic(juror.id)"
            @input="updateAnalyticScore(juror.id, c.id, 'B', c.maxPoints, Number(($event.target as HTMLInputElement).value))"
            class="border border-white/20 rounded-lg px-2 py-1.5 text-sm bg-transparent text-white"
            placeholder="Equipa B"
          />
        </div>

        <div class="flex items-center justify-between text-xs text-gray-600">
          <span>Total - A: {{ jurorAnalyticTotal(juror.id, 'A') }} · B: {{ jurorAnalyticTotal(juror.id, 'B') }}</span>
          <button
            v-if="!jurorHasSubmittedAnalytic(juror.id)"
            class="px-4 py-1.5 rounded-lg bg-petro-primary text-white font-semibold text-xs"
            @click="submitAnalyticEvaluation(juror.id)"
          >
            Confirmar Avaliação
          </button>
        </div>
      </div>

      <p class="text-[11px] text-gray-400">
        O moderador só pode finalizar esta pergunta depois de todos os jurados acima confirmarem.
      </p>
    </div>

    <!-- Notas Iniciais -->
    <div
      v-if="phaseConfig.useInitialScores && hasBattle && !jurados.initialScoresConfirmed"
      class="w-full max-w-4xl bg-petro-card p-6 rounded-2xl flex flex-col gap-3 border border-white/10"
    >
      <h3 class="text-lg font-bold text-gray-800">Notas Iniciais</h3>
      <div v-for="j in jurados.jurors" :key="j.id" class="grid grid-cols-3 gap-3 items-center">
        <span class="text-sm text-gray-700">{{ j.name }}</span>
        <input
          type="number" min="0" :max="phaseConfig.initialScoreMaxPoints ?? 999"
          :value="initialScoreFor(j.id, 'a')"
          @input="updateInitialScore(j.id, 'a', Number(($event.target as HTMLInputElement).value))"
          class="border border-white/20 rounded-lg px-2 py-1.5 text-sm bg-transparent text-gray-800"
        />
        <input
          type="number" min="0" :max="phaseConfig.initialScoreMaxPoints ?? 999"
          :value="initialScoreFor(j.id, 'b')"
          @input="updateInitialScore(j.id, 'b', Number(($event.target as HTMLInputElement).value))"
          class="border border-white/20 rounded-lg px-2 py-1.5 text-sm bg-transparent text-gray-800"
        />
      </div>
      <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold self-end" @click="confirmInitialScores">
        Confirmar Notas Iniciais
      </button>
    </div>

    <!-- Bloco de Avaliação de Item - nota única (só quando o item ATIVO não tem critérios) -->
    <div
      v-if="selectedItem && !selectedItemHasCriteria"
      class="w-full max-w-4xl bg-petro-card p-6 rounded-2xl flex flex-col gap-4 border border-white/10"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-800">{{ selectedItem.text }}</h3>

        <button
          v-if="!itemSubmitted && allJurorsScored"
          class="px-6 py-2.5 rounded-xl bg-petro-primary text-white font-semibold hover:bg-petro-primary/90 transition"
          @click="confirmItem"
        >
          Confirmar Pontuação
        </button>
        <span v-else-if="!allJurorsScored" class="text-xs text-amber-600">
          A aguardar nota de todos os jurados...
        </span>
        <span v-else-if="itemSubmitted" class="text-xs text-emerald-500 font-medium">
          ✓ Pontuação confirmada
        </span>
      </div>

      <div v-for="j in allowedJurorsForSelected" :key="j.id" class="grid grid-cols-3 gap-3 items-center">
        <span class="text-sm text-gray-700">{{ j.name }}</span>
        <input
          type="number" min="0" :max="selectedItem.maxPoints"
          :value="scoreFor(j.id, 'a')"
          :disabled="itemSubmitted"
          @input="updateScore(j.id, 'a', Number(($event.target as HTMLInputElement).value))"
          class="border border-white/20 rounded-lg px-2 py-1.5 text-sm bg-transparent text-gray-800"
          placeholder="Equipa A"
        />
        <input
          type="number" min="0" :max="selectedItem.maxPoints"
          :value="scoreFor(j.id, 'b')"
          :disabled="itemSubmitted"
          @input="updateScore(j.id, 'b', Number(($event.target as HTMLInputElement).value))"
          class="border border-white/20 rounded-lg px-2 py-1.5 text-sm bg-transparent text-gray-800"
          placeholder="Equipa B"
        />
      </div>

      <div class="text-xs text-white/50">Totais - A: {{ totals.totalA }} · B: {{ totals.totalB }}</div>
    </div>

    <!-- Apresentação de Projetos -->
    <div
      v-if="isPresentationPhase && store.presentationFlow.stage !== 'idle'"
      class="w-full max-w-4xl bg-petro-card p-6 rounded-2xl flex flex-col gap-4 border border-white/10"
    >
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-gray-800">{{ store.presentationFlow.teamName }}</h3>
        <span class="text-xs text-gray-60">{{ presentationStageLabel }}</span>
      </div>

      <template v-if="store.presentationFlow.stage === 'concluded'">
        <div v-for="j in jurados.jurors" :key="j.id" class="border border-white/10 rounded-xl p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-gray-800">{{ j.name }}</span>
              <span v-if="jurorHasSubmittedPresentation(j.id)" class="text-xs text-emerald-400">✓ Avaliação enviada</span>
            </div>
          <div v-for="c in presentationCriteria" :key="c.id" class="grid grid-cols-2 gap-3 items-center">
            <span class="text-sm text-gray-700">{{ c.label }} <span class="text-gray-400">/{{ c.maxPoints }}</span></span>
            <input
              type="number" min="0" :max="c.maxPoints"
              :value="presentationScoreFor(j.id, c.id)"
              :disabled="jurorHasSubmittedPresentation(j.id)"
              @input="updatePresentationScore(j.id, c.id, c.maxPoints, Number(($event.target as HTMLInputElement).value))"
              class="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-transparent text-gray-800"
            />
          </div>
          <div class="flex items-center justify-between text-xs text-gray-600">
            <span>Total: {{ jurorPresentationTotal(j.id) }} / {{ totalCriteriaPoints }}</span>
            <button
              v-if="!jurorHasSubmittedPresentation(j.id)"
              class="px-4 py-1.5 rounded-lg bg-petro-primary text-white font-semibold text-xs"
              @click="submitPresentation(j.id)"
            >
              Confirmar Avaliação
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
