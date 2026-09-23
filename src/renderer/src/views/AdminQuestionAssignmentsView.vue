<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { usePhasesStore } from '../stores/phases'
import { useQuizContentStore } from '../stores/quizContent'
import { useTeamsStore } from '../stores/teams'
import { useQuestionAssignmentsStore } from '../stores/questionAssignments'
import type { ChampionshipType } from '../stores/campeonato'

interface QuizQuestionExtended {
  id: string
  text: string
  phase: number
}

const phasesStore = usePhasesStore()
const quizContent = useQuizContentStore()
const teamsStore = useTeamsStore()
const assignmentsStore = useQuestionAssignmentsStore()

const selectedChampionship = ref<ChampionshipType>('universitario')
const championshipOptions: { value: ChampionshipType; label: string }[] = [
  { value: 'universitario', label: 'Universitário' },
  { value: 'ensino_medio', label: 'Ensino Médio' },
  { value: 'exibicao', label: 'Exibição' }
]

const perTeamPhases = computed(() =>
  phasesStore.phases.filter((p) => p.type === 'quiz' && p.questionSelectionMode === 'per_team')
)
const selectedPhaseId = ref<string>('')
const selectedTeamId = ref<string>('')

const teamsForChampionship = computed(() => teamsStore.teamsForCategory(selectedChampionship.value))

const questionsForPhase = computed(() => {
  const phase = phasesStore.phases.find((p) => p.id === selectedPhaseId.value)
  if (!phase) return []
  return (quizContent.questions as unknown as QuizQuestionExtended[]).filter(
    (q) => q.phase === phase.order
  )
})

// Sequencia atual (ja atribuida) e disponiveis (ainda nao usadas nessa sequencia)
const currentSequence = ref<string[]>([])

function loadSequenceFromStore(): void {
  if (!selectedTeamId.value) {
    currentSequence.value = []
    return
  }
  currentSequence.value = assignmentsStore.forTeam(selectedTeamId.value).map((a) => a.questionId)
}

const availableQuestions = computed(() =>
  questionsForPhase.value.filter((q) => !currentSequence.value.includes(q.id))
)

async function loadAll(): Promise<void> {
  await phasesStore.fetchPhases(selectedChampionship.value)
  await quizContent.fetchQuestions(selectedChampionship.value)
  await teamsStore.fetchTeams()
  if (perTeamPhases.value.length > 0 && !selectedPhaseId.value) {
    selectedPhaseId.value = perTeamPhases.value[0].id
  }
}

onMounted(loadAll)
watch(selectedChampionship, loadAll)
watch(selectedPhaseId, async () => {
  if (selectedPhaseId.value) await assignmentsStore.fetchForPhase(selectedPhaseId.value)
  loadSequenceFromStore()
})
watch(selectedTeamId, loadSequenceFromStore)

function addToSequence(questionId: string): void {
  currentSequence.value.push(questionId)
}
function removeFromSequence(index: number): void {
  currentSequence.value.splice(index, 1)
}
function moveUp(index: number): void {
  if (index <= 0) return
  const arr = currentSequence.value
  ;[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
}
function moveDown(index: number): void {
  const arr = currentSequence.value
  if (index >= arr.length - 1) return
  ;[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
}

const saving = ref(false)
const errorMsg = ref('')

async function save(): Promise<void> {
  if (!selectedPhaseId.value || !selectedTeamId.value) return
  saving.value = true
  errorMsg.value = ''
  try {
    await assignmentsStore.saveForTeam(selectedPhaseId.value, selectedTeamId.value, currentSequence.value)
  } catch {
    errorMsg.value = 'Não foi possível guardar a atribuição.'
  } finally {
    saving.value = false
  }
}

function questionText(id: string): string {
  return quizContent.questions.find((q) => q.id === id)?.text ?? '(pergunta removida)'
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto space-y-6">
    <h1 class="text-xl font-semibold text-gray-800">Seleção de Perguntas por Equipa</h1>

    <div class="flex gap-3">
      <select v-model="selectedChampionship" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
        <option v-for="c in championshipOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
      </select>
      <select v-model="selectedPhaseId" class="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1">
        <option value="" disabled>Escolhe uma fase (modo por equipa)</option>
        <option v-for="p in perTeamPhases" :key="p.id" :value="p.id">{{ p.label }}</option>
      </select>
    </div>

    <p v-if="perTeamPhases.length === 0" class="text-sm text-gray-500">
      Nenhuma fase de Quiz está no modo "Seleção de perguntas por equipa". Ativa isso em Fases.
    </p>

    <template v-if="selectedPhaseId">
      <select v-model="selectedTeamId" class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full">
        <option value="" disabled>Escolhe uma equipa</option>
        <option v-for="t in teamsForChampionship" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>

      <div v-if="selectedTeamId" class="grid grid-cols-2 gap-4">
        <div>
          <h2 class="text-sm font-semibold text-gray-600 mb-2">Perguntas disponíveis</h2>
          <div class="space-y-1 max-h-96 overflow-y-auto">
            <div
              v-for="q in availableQuestions"
              :key="q.id"
              class="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <span class="truncate">{{ q.text }}</span>
              <button class="text-xs text-petro-primary underline shrink-0 ml-2" @click="addToSequence(q.id)">
                Adicionar
              </button>
            </div>
          </div>
        </div>

        <div>
          <h2 class="text-sm font-semibold text-gray-600 mb-2">Sequência da equipa (ordem de uso)</h2>
          <div class="space-y-1 max-h-96 overflow-y-auto">
            <div
              v-for="(qid, index) in currentSequence"
              :key="qid + '-' + index"
              class="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <span class="truncate">{{ index + 1 }}. {{ questionText(qid) }}</span>
              <div class="flex items-center gap-2 shrink-0 ml-2">
                <button class="text-xs text-gray-500" @click="moveUp(index)">↑</button>
                <button class="text-xs text-gray-500" @click="moveDown(index)">↓</button>
                <button class="text-xs text-red-400 underline" @click="removeFromSequence(index)">Remover</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="selectedTeamId" class="flex items-center gap-3">
        <button
          class="bg-petro-primary text-white text-sm rounded-lg px-4 py-2 disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          Guardar sequência
        </button>
        <span v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</span>
      </div>
    </template>
  </div>
</template>
