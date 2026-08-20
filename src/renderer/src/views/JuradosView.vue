<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCampeonatoStore } from '../stores/campeonato'
import { useJuradosStore } from '../stores/jurados'
import { useQuizContentStore } from '../stores/quizContent'
import { useSettingsStore } from '../stores/settings'
import { usePhasesStore } from '../stores/phases'
import { getBackendUrl } from '../services/backendConfig'
import { startConfigSync } from '../services/configSync'
import LogoMark from '../components/LogoMark.vue'
import type { EvaluationItem } from '../data/evaluationItems'

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
const multipleChoiceItems = computed(() => evaluationItems.value.filter((i) => i.mode === 'multipla_escolha'))

function jurorsAllowedFor(item: EvaluationItem | undefined): typeof jurados.jurors {
  if (!item || !item.jurorIds || item.jurorIds.length === 0) return jurados.jurors
  return jurados.jurors.filter((j) => item.jurorIds!.includes(j.id))
}

const newJurorName = ref('')
const registerError = ref('')

async function addJuror(): Promise<void> {
  if (jurados.jurors.length >= settings.maxJurors) return
  const result = await jurados.registerJuror(newJurorName.value)
  if (!result.success) {
    registerError.value = result.error || 'Falha ao registar jurado.'
    return
  }
  registerError.value = ''
  newJurorName.value = ''
}

// ==================== Notas Iniciais + Perguntas Analíticas (batalha) ====================

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

const selectedItemId = ref('')
watch(openItems, (items) => {
  if (!selectedItemId.value && items.length) selectedItemId.value = items[0].id
})
const selectedItem = computed(() => openItems.value.find((i) => i.id === selectedItemId.value))
const itemSubmitted = computed(() => (selectedItem.value ? jurados.isSubmitted(selectedItem.value.id) : false))
const allowedJurorsForSelected = computed(() => jurorsAllowedFor(selectedItem.value))

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
      return 'Apresentação concluída — a aguardar avaliações'
    default:
      return ''
  }
})
</script>

<template>
  <div class="min-h-screen bg-petro-bg flex flex-col items-center px-8 py-10 gap-6">
    <LogoMark />
    <div class="text-xs font-semibold text-petro-primary uppercase tracking-wide">Painel dos Jurados</div>

    <!-- Bloco de Avaliação de Item -->
    <div v-if="selectedItem" class="w-full max-w-4xl bg-petro-card p-6 rounded-2xl flex flex-col gap-4 border border-white/10">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-bold text-white">{{ selectedItem.title }}</h3>

        <!-- Botão com validação de submissão + pontuação de todos os jurados -->
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
    </div>
  </div>
</template>
