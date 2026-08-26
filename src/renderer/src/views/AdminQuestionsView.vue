<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useQuizContentStore } from '../stores/quizContent'
import { usePhasesStore, type Phase } from '../stores/phases'
import { uploadImage } from '../services/upload'
import type { QuizQuestion } from '../data/questions'
import type { ChampionshipType } from '../stores/campeonato'

const quizContent = useQuizContentStore()
const phasesStore = usePhasesStore()

const selectedChampionship = ref<ChampionshipType>('universitario')
const championshipOptions: { value: ChampionshipType; label: string }[] = [
  { value: 'universitario', label: 'Universitário' },
  { value: 'ensino_medio', label: 'Ensino Médio' },
  { value: 'exibicao', label: 'Exibição' }
]

// NOVO: só fases que realmente usam Quiz — uma fase 'apresentacao' pura não
// tem perguntas, é só a grelha de critérios (Admin → Apresentação).
const quizPhases = computed(() =>
  phasesStore.phases.filter((p) => p.type === 'quiz' || p.type === 'apresentacao_quiz')
)

// CORRIGIDO — editingId é string (cuid) desde a migração, não number.
const editingId = ref<string | null>(null)
const form = ref({
  text: '',
  imageUrl: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correctIndex: 0,
  points: 10,
  phase: 1
})
const uploading = ref(false)
const uploadError = ref('')
const errorMsg = ref('')

async function loadForChampionship(): Promise<void> {
  await phasesStore.fetchPhases(selectedChampionship.value)
  await quizContent.fetchQuestions(selectedChampionship.value)
  if (quizPhases.value.length > 0 && editingId.value === null) {
    form.value.phase = quizPhases.value[0].order
  }
}

onMounted(loadForChampionship)
watch(selectedChampionship, () => {
  resetForm()
  loadForChampionship()
})

function resetForm(): void {
  editingId.value = null
  const defaultPhase = quizPhases.value[0]?.order ?? 1
  form.value = {
    text: '',
    imageUrl: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctIndex: 0,
    points: 10,
    phase: defaultPhase
  }
  uploadError.value = ''
  errorMsg.value = ''
}

function editQuestion(q: QuizQuestion): void {
  editingId.value = q.id
  form.value = {
    text: q.text,
    imageUrl: q.imageUrl ?? '',
    optionA: q.options[0]?.text ?? '',
    optionB: q.options[1]?.text ?? '',
    optionC: q.options[2]?.text ?? '',
    optionD: q.options[3]?.text ?? '',
    correctIndex: q.correctIndex,
    points: q.points,
    phase: q.phase
  }
}

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  uploadError.value = ''
  try {
    form.value.imageUrl = await uploadImage(file)
  } catch {
    uploadError.value = 'Falha ao enviar a imagem. Tenta novamente.'
  } finally {
    uploading.value = false
  }
}

function removeImage(): void {
  form.value.imageUrl = ''
}

async function saveQuestion(): Promise<void> {
  if (!form.value.text.trim()) return
  errorMsg.value = ''

  const options = [
    { label: 'A', text: form.value.optionA },
    { label: 'B', text: form.value.optionB },
    { label: 'C', text: form.value.optionC },
    { label: 'D', text: form.value.optionD }
  ]

  const payload = {
    championship: selectedChampionship.value,
    text: form.value.text,
    options,
    correctIndex: form.value.correctIndex,
    points: form.value.points,
    phase: form.value.phase,
    imageUrl: form.value.imageUrl || undefined
  }

  try {
    if (editingId.value !== null) {
      await quizContent.updateQuestion(editingId.value, payload)
    } else {
      await quizContent.addQuestion(payload)
    }
    resetForm()
  } catch {
    errorMsg.value = 'Não foi possível guardar a pergunta.'
  }
}

async function removeQuestion(id: string): Promise<void> {
  errorMsg.value = ''
  try {
    await quizContent.deleteQuestion(id, selectedChampionship.value)
    if (editingId.value === id) resetForm()
  } catch {
    errorMsg.value = 'Não foi possível remover a pergunta.'
  }
}

function getPhaseKey(phase: Phase): number {
  return phase.order
}

const groupedByPhase = computed(() => {
  const groups: Record<number, QuizQuestion[]> = {}
  for (const phase of quizPhases.value) {
    groups[getPhaseKey(phase)] = []
  }
  for (const q of quizContent.questions) {
    if (!groups[q.phase]) groups[q.phase] = []
    groups[q.phase].push(q)
  }
  return groups
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-3xl mx-auto w-full">
    <div class="bg-white rounded-2xl shadow p-4">
      <label class="text-xs text-gray-500 block mb-1">Campeonato</label>
      <select v-model="selectedChampionship" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
        <option v-for="opt in championshipOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <p class="text-[11px] text-gray-400 mt-1">
        As perguntas são independentes por campeonato — cada um tem o seu próprio banco.
      </p>
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">
        {{ editingId !== null ? 'Editar Pergunta' : 'Nova Pergunta' }}
      </h2>

      <div class="flex flex-col gap-3">
        <textarea
          v-model="form.text"
          rows="2"
          placeholder="Texto da pergunta"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-petro-primary"
        ></textarea>

        <div class="flex items-center gap-4">
          <div class="w-20 h-14 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
            <img v-if="form.imageUrl" :src="form.imageUrl" alt="Imagem" class="w-full h-full object-cover" />
            <span v-else class="text-[10px] text-gray-400 text-center px-1">Sem imagem</span>
          </div>
          <div class="flex flex-col gap-1">
            <label class="bg-petro-primary/10 text-petro-primary text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer text-center">
              {{ uploading ? 'A enviar...' : 'Carregar Imagem (opcional)' }}
              <input type="file" accept="image/*" class="hidden" :disabled="uploading" @change="onFileSelected" />
            </label>
            <button v-if="form.imageUrl" class="text-xs text-red-400 underline" @click="removeImage">Remover imagem</button>
          </div>
        </div>
        <p v-if="uploadError" class="text-xs text-red-500">{{ uploadError }}</p>
        <p v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</p>

        <div class="grid grid-cols-2 gap-3">
          <input v-model="form.optionA" type="text" placeholder="Opção A" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input v-model="form.optionB" type="text" placeholder="Opção B" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input v-model="form.optionC" type="text" placeholder="Opção C" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input v-model="form.optionD" type="text" placeholder="Opção D" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="text-xs text-gray-500 block mb-1">Resposta Certa</label>
            <select v-model.number="form.correctIndex" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option :value="0">A</option>
              <option :value="1">B</option>
              <option :value="2">C</option>
              <option :value="3">D</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Pontos</label>
            <input v-model.number="form.points" type="number" min="1" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Fase</label>
            <select
              v-model="form.phase"
              :disabled="quizPhases.length === 0"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option v-if="quizPhases.length === 0" :value="null" disabled>
                ⚠️ Nenhuma fase de Quiz cadastrada para este campeonato
              </option>
              <option v-for="phase in quizPhases" :key="phase.id" :value="phase.order">
                Fase {{ phase.order }} · {{ phase.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex gap-2 justify-end">
          <button v-if="editingId !== null" class="text-sm text-gray-400 underline" @click="resetForm">Cancelar</button>
          <button
            :disabled="uploading || quizPhases.length === 0"
            class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            @click="saveQuestion"
          >
            {{ editingId !== null ? 'Guardar Alterações' : 'Adicionar Pergunta' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="!quizPhases.length" class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
      Este campeonato ainda não tem nenhuma fase do tipo Quiz ou Apresentação + Quiz — vai a Admin → Fases primeiro.
      (Fases do tipo "Apresentação de Projetos" pura não usam perguntas — usa Admin → Apresentação para essas.)
    </div>

    <div v-for="phase in quizPhases" :key="phase.id" class="bg-white rounded-2xl shadow p-6">
      <h3 class="font-semibold text-sm text-gray-600 mb-3">
        Fase {{ phase.order }} ({{ phase.label }}) · {{ groupedByPhase[getPhaseKey(phase)]?.length ?? 0 }} perguntas
      </h3>
      <div v-if="!groupedByPhase[getPhaseKey(phase)]?.length" class="text-xs text-gray-400">
        Nenhuma pergunta cadastrada para esta fase.
      </div>
      <div
        v-for="q in groupedByPhase[getPhaseKey(phase)]"
        :key="q.id"
        class="flex items-center justify-between gap-3 border-b border-gray-50 py-2 last:border-0"
      >
        <div class="text-sm flex-1 truncate">
          {{ q.text }} <span class="text-petro-primary font-semibold">· {{ q.points }} pts</span>
        </div>
        <div class="flex gap-2 shrink-0">
          <button class="text-xs text-petro-primary underline" @click="editQuestion(q)">Editar</button>
          <button class="text-xs text-red-400 underline" @click="removeQuestion(q.id)">Remover</button>
        </div>
      </div>
    </div>
  </div>
</template>
