<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCampeonatoStore } from '../stores/campeonato'
import { useJuradosStore } from '../stores/jurados'
import { useQuizContentStore } from '../stores/quizContent'
import { useSettingsStore } from '../stores/settings'
import { usePhasesStore } from '../stores/phases'
import { getBackendUrl } from '../services/backendConfig'
import LogoMark from '../components/LogoMark.vue'

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

// CORRIGIDO: removido o redirecionamento forçado para "Escolher Equipas".
// Este painel já não depende de existir uma batalha 1x1 — pode estar em
// três modos: batalha (Quiz), apresentação de projetos, ou à espera.
onMounted(async () => {
  await phasesStore.fetchPhases(store.championship ?? undefined)
  await settings.fetchSettings()
  jurados.listenToServer()
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
watch(evaluationItems, (items) => {
  if (!selectedItemId.value && items.length) selectedItemId.value = items[0].id
})
const selectedItem = computed(() => evaluationItems.value.find((i) => i.id === selectedItemId.value))
const itemSubmitted = computed(() => (selectedItem.value ? jurados.isSubmitted(selectedItem.value.id) : false))

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
  if (!selectedItem.value || itemSubmitted.value) return
  jurados.confirmItem(selectedItem.value.id)
}

// ==================== Apresentação de Projetos (NOVO) ====================

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

    <div class="bg-petro-primary/5 border border-petro-primary/20 rounded-xl px-4 py-2 text-xs text-petro-primary text-center max-w-md">
      Os jurados também podem entrar remotamente, no telemóvel, através de <b>/portal/jurados.html</b> no endereço do PC do moderador.
    </div>

    <div class="bg-white rounded-2xl shadow p-5 w-full max-w-2xl">
      <h3 class="font-semibold text-sm text-gray-600 mb-3">
        Jurados Registados ({{ jurados.jurors.length }}/{{ settings.maxJurors }})
      </h3>
      <div class="flex flex-wrap gap-2 mb-3">
        <span
          v-for="j in jurados.jurors"
          :key="j.id"
          class="bg-petro-primary/10 text-petro-primary text-sm px-3 py-1.5 rounded-full flex items-center gap-2"
        >
          {{ j.name }}
          <button class="text-petro-primary/50 hover:text-petro-primary" @click="jurados.removeJuror(j.id)">✕</button>
        </span>
        <span v-if="jurados.jurors.length === 0" class="text-xs text-gray-400">Nenhum jurado registado ainda.</span>
      </div>

      <div v-if="jurados.jurors.length < settings.maxJurors" class="flex gap-2">
        <input
          v-model="newJurorName"
          type="text"
          placeholder="Código do jurado (dado pelo Admin)"
          class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-petro-primary uppercase"
          @keyup.enter="addJuror"
        />
        <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold" @click="addJuror">
          Entrar
        </button>
      </div>
      <p v-else class="text-xs text-gray-400">Limite de {{ settings.maxJurors }} jurados atingido.</p>
      <p v-if="registerError" class="text-xs text-red-500 mt-2">{{ registerError }}</p>
    </div>

    <!-- ==================== MODO: APRESENTAÇÃO DE PROJETOS ==================== -->
    <template v-if="isPresentationPhase">
      <div v-if="store.presentationFlow.stage === 'idle'" class="bg-white rounded-2xl shadow p-6 max-w-md text-center">
        <p class="text-sm text-gray-500">
          A aguardar o Moderador iniciar a apresentação de uma equipa.
        </p>
      </div>

      <div v-else class="bg-white rounded-2xl shadow p-5 w-full max-w-2xl">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 class="font-semibold text-sm text-gray-600">Avaliação do Projeto</h3>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-petro-primary/10 text-petro-primary uppercase">
            {{ presentationStageLabel }}
          </span>
        </div>

        <p class="text-lg font-bold text-petro-primary">{{ store.presentationFlow.teamName }}</p>
        <p class="text-sm text-gray-500 mb-4">Tema: {{ store.presentationFlow.theme }}</p>

        <div v-if="store.presentationFlow.stage !== 'concluded'" class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-4">
          A avaliação fica disponível assim que o Moderador finalizar a apresentação desta equipa.
        </div>

        <div v-if="!presentationCriteria.length" class="text-xs text-gray-400 text-center py-4">
          Nenhum critério cadastrado para esta fase — configura em Admin → Apresentação.
        </div>

        <template v-else-if="store.presentationFlow.stage === 'concluded'">
          <div v-if="jurados.jurors.length === 0" class="text-xs text-gray-400 text-center py-4">
            Regista pelo menos um jurado para começar a avaliar.
          </div>
          <div v-else class="flex flex-col gap-4">
            <div
              v-for="j in jurados.jurors"
              :key="j.id"
              class="border border-gray-100 rounded-xl p-4 flex flex-col gap-2"
              :class="jurorHasSubmittedPresentation(j.id) ? 'bg-green-50/50' : ''"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold">{{ j.name }}</span>
                <span v-if="jurorHasSubmittedPresentation(j.id)" class="text-xs text-green-600 font-semibold">
                  Submetido ✓ — {{ jurorPresentationTotal(j.id) }}/{{ totalCriteriaPoints }} pts
                </span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div v-for="c in presentationCriteria" :key="c.id" class="flex items-center justify-between gap-2">
                  <span class="text-xs text-gray-500 truncate">{{ c.label }}</span>
                  <input
                    type="number"
                    min="0"
                    :max="c.maxPoints"
                    :disabled="jurorHasSubmittedPresentation(j.id)"
                    :value="presentationScoreFor(j.id, c.id)"
                    class="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center disabled:bg-gray-50"
                    @input="updatePresentationScore(j.id, c.id, c.maxPoints, Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
              </div>
              <button
                v-if="!jurorHasSubmittedPresentation(j.id)"
                class="self-end bg-petro-primary text-white rounded-lg px-3 py-1.5 text-xs font-semibold"
                @click="submitPresentation(j.id)"
              >
                Submeter Avaliação
              </button>
            </div>

            <p v-if="store.presentationFlow.allJurorsSubmitted" class="text-sm text-green-600 font-semibold text-center pt-2 border-t border-gray-100">
              Todos os jurados avaliaram — nota final calculada.
            </p>
          </div>
        </template>
      </div>
    </template>

    <!-- ==================== MODO: BATALHA (Quiz) ==================== -->
    <template v-else-if="hasBattle">
      <div v-if="!phaseConfig.useJudges" class="bg-white rounded-2xl shadow p-6 max-w-md text-center">
        <p class="text-sm text-gray-500">
          A Fase {{ store.phase }} não está configurada para usar avaliação dos jurados. Se isto não estiver certo,
          pede ao Administrador para ativar "Avaliação dos Jurados" para esta fase no Painel Admin → Fases.
        </p>
      </div>

      <template v-else>
        <div v-if="phaseConfig.useInitialScores" class="bg-white rounded-2xl shadow p-5 w-full max-w-2xl">
          <h3 class="font-semibold text-sm text-gray-600 mb-3">
            Notas Iniciais (antes da batalha) — até {{ phaseConfig.initialScoreMaxPoints ?? '—' }} pts por jurado
          </h3>
          <div v-if="jurados.jurors.length === 0" class="text-xs text-gray-400 text-center py-4">
            Regista pelo menos um jurado para atribuir as notas iniciais.
          </div>
          <div v-else class="flex flex-col gap-3">
            <div
              v-for="j in jurados.jurors"
              :key="'initial-' + j.id"
              class="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3 flex-wrap"
            >
              <span class="text-sm font-medium w-full sm:w-28 truncate">{{ j.name }}</span>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">{{ store.teamA?.name }}</span>
                <input
                  type="number"
                  min="0"
                  :max="phaseConfig.initialScoreMaxPoints ?? undefined"
                  :disabled="jurados.initialScoresConfirmed"
                  :value="initialScoreFor(j.id, 'a')"
                  class="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center disabled:bg-gray-50"
                  @input="updateInitialScore(j.id, 'a', Number(($event.target as HTMLInputElement).value))"
                />
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">{{ store.teamB?.name }}</span>
                <input
                  type="number"
                  min="0"
                  :max="phaseConfig.initialScoreMaxPoints ?? undefined"
                  :disabled="jurados.initialScoresConfirmed"
                  :value="initialScoreFor(j.id, 'b')"
                  class="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center disabled:bg-gray-50"
                  @input="updateInitialScore(j.id, 'b', Number(($event.target as HTMLInputElement).value))"
                />
              </div>
            </div>
            <div class="flex items-center justify-end mt-2 pt-3 border-t border-gray-100">
              <button
                v-if="!jurados.initialScoresConfirmed"
                class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold"
                @click="confirmInitialScores"
              >
                Confirmar Notas Iniciais
              </button>
              <span v-else class="text-green-600 text-sm font-semibold">Confirmado ✓ — já somado ao placar</span>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-2xl shadow p-5 w-full max-w-2xl">
          <h3 class="font-semibold text-sm text-gray-600 mb-3">Pergunta / Item a Avaliar</h3>

          <div v-if="!evaluationItems.length" class="text-xs text-gray-400 text-center py-4">
            Não há itens de avaliação cadastrados para a Fase {{ store.phase }}. Adiciona-os no Painel do Administrador.
          </div>

          <template v-else>
            <select
              v-model="selectedItemId"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-petro-primary mb-3"
            >
              <option v-for="item in evaluationItems" :key="item.id" :value="item.id">
                Analítica · {{ item.maxPoints }} pts {{ jurados.isSubmitted(item.id) ? '· ✓ avaliado' : '' }}
              </option>
            </select>

            <p v-if="selectedItem" class="text-sm text-gray-500 mb-4">{{ selectedItem.text }}</p>

            <div v-if="jurados.jurors.length === 0" class="text-xs text-gray-400 text-center py-4">
              Regista pelo menos um jurado para começar a pontuar (localmente ou pelo portal remoto).
            </div>

            <div v-else class="flex flex-col gap-3">
              <div
                v-for="j in jurados.jurors"
                :key="j.id"
                class="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-4 py-3 flex-wrap"
              >
                <span class="text-sm font-medium w-full sm:w-28 truncate">{{ j.name }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-400">{{ store.teamA?.name }}</span>
                  <input
                    type="number"
                    min="0"
                    :max="selectedItem?.maxPoints ?? 0"
                    :disabled="itemSubmitted"
                    :value="scoreFor(j.id, 'a')"
                    class="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center disabled:bg-gray-50"
                    @input="updateScore(j.id, 'a', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-gray-400">{{ store.teamB?.name }}</span>
                  <input
                    type="number"
                    min="0"
                    :max="selectedItem?.maxPoints ?? 0"
                    :disabled="itemSubmitted"
                    :value="scoreFor(j.id, 'b')"
                    class="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center disabled:bg-gray-50"
                    @input="updateScore(j.id, 'b', Number(($event.target as HTMLInputElement).value))"
                  />
                </div>
              </div>

              <div class="flex items-center justify-between mt-2 pt-3 border-t border-gray-100 flex-wrap gap-2">
                <span class="text-sm font-semibold text-petro-primary">
                  Total: {{ store.teamA?.name }} {{ totals.totalA }} pts · {{ store.teamB?.name }} {{ totals.totalB }} pts
                </span>
                <button
                  v-if="!itemSubmitted"
                  class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold"
                  @click="confirmItem"
                >
                  Confirmar Pontuação
                </button>
                <span v-else class="text-green-600 text-sm font-semibold">Confirmado ✓</span>
              </div>
            </div>
          </template>
        </div>
      </template>
    </template>

    <!-- ==================== MODO: SEM NADA EM CURSO ==================== -->
    <div v-else class="bg-white rounded-2xl shadow p-6 max-w-md text-center">
      <p class="text-sm text-gray-500">
        Não há nenhuma avaliação em curso neste momento. Este painel fica ativo automaticamente quando o
        Moderador iniciar uma batalha com avaliação por jurados, ou uma apresentação de projetos.
      </p>
    </div>
  </div>
</template>
