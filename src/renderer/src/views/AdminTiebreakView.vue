<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTiebreakQuestionsStore } from '../stores/tiebreakQuestions'
import { usePhasesStore } from '../stores/phases'
import { uploadImage } from '../services/upload'
import type { QuizQuestion } from '../data/questions'
import type { ChampionshipType } from '../stores/campeonato'

const tiebreakStore = useTiebreakQuestionsStore()
const phasesStore = usePhasesStore()

const selectedChampionship = ref<ChampionshipType>('universitario')
const championshipOptions: { value: ChampionshipType; label: string }[] = [
  { value: 'universitario', label: 'Universitário' },
  { value: 'ensino_medio', label: 'Ensino Médio' },
  { value: 'exibicao', label: 'Exibição' }
]

// Todas as fases cadastradas para o campeonato selecionado (desempate pode
// ocorrer em qualquer tipo de fase, não só Quiz).
const registeredPhases = computed(() => phasesStore.phases)

const editingId = ref<number | null>(null)
const errorMsg = ref('')
const uploading = ref(false)

const form = ref({
  text: '',
  imageUrl: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correctIndex: 0,
  points: 10,
  phase: null as number | null
})

async function loadForChampionship(): Promise<void> {
  await phasesStore.fetchPhases(selectedChampionship.value)
  await tiebreakStore.fetchQuestions(selectedChampionship.value)
  if (registeredPhases.value.length > 0 && form.value.phase === null) {
    form.value.phase = registeredPhases.value[0].order
  }
}

onMounted(async () => {
  await loadForChampionship()
})

watch(selectedChampionship, () => {
  resetForm()
  loadForChampionship()
})

function resetForm(): void {
  editingId.value = null
  const defaultPhase = registeredPhases.value.length > 0 ? registeredPhases.value[0].order : null
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
  errorMsg.value = ''
  try {
    form.value.imageUrl = await uploadImage(file)
  } catch {
    errorMsg.value = 'Falha ao carregar a imagem. Tenta outra vez.'
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function saveQuestion(): Promise<void> {
  if (!form.value.text.trim()) return
  if (form.value.phase === null) {
    errorMsg.value = 'Cadastra primeiro pelo menos uma fase para este campeonato.'
    return
  }
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
    phase: Number(form.value.phase),
    imageUrl: form.value.imageUrl || undefined
  }
  try {
    if (editingId.value !== null) {
      await tiebreakStore.updateQuestion(editingId.value, payload)
    } else {
      await tiebreakStore.addQuestion(payload)
    }
    resetForm()
  } catch {
    errorMsg.value = 'Não foi possível guardar a pergunta. Confirma que o backend está a correr.'
  }
}

async function removeQuestion(id: number): Promise<void> {
  errorMsg.value = ''
  try {
    await tiebreakStore.deleteQuestion(id)
    if (editingId.value === id) resetForm()
  } catch {
    errorMsg.value = 'Não foi possível remover a pergunta — tenta outra vez.'
  }
}

function getPhaseLabel(phaseOrder: number): string {
  const found = phasesStore.phases.find((p) => p.order === phaseOrder)
  if (found) return `Fase ${found.order} · ${found.label}`
  return `Fase ${phaseOrder}`
}

const groupedByPhase = computed(() => {
  const groups: Record<number, QuizQuestion[]> = {}
  for (const p of registeredPhases.value) {
    groups[p.order] = []
  }
  for (const q of tiebreakStore.questions) {
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
        As perguntas de desempate são independentes por campeonato — cada um tem o seu próprio banco.
      </p>
    </div>

    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
      Estas perguntas ficam reservadas só para desempates — nunca aparecem no jogo normal.
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">
        {{ editingId !== null ? 'Editar Pergunta de Desempate' : 'Nova Pergunta de Desempate' }}
      </h2>
      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 block mb-1">Fase</label>
          <select
            v-model="form.phase"
            :disabled="registeredPhases.length === 0"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option v-if="registeredPhases.length === 0" :value="null" disabled>
              ⚠️ Nenhuma fase cadastrada para este campeonato
            </option>
            <option v-for="p in registeredPhases" :key="p.id" :value="p.order">
              Fase {{ p.order }} · {{ p.label }}
            </option>
          </select>
        </div>

        <textarea v-model="form.text" rows="2" placeholder="Texto da pergunta" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"></textarea>

        <div class="flex items-center gap-4">
          <div class="w-20 h-14 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
            <img v-if="form.imageUrl" :src="form.imageUrl" alt="Imagem" class="w-full h-full object-cover" />
            <span v-else class="text-[10px] text-gray-400 text-center px-1">Sem imagem</span>
          </div>
          <label class="bg-petro-primary/10 text-petro-primary text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer text-center">
            {{ uploading ? 'A enviar...' : 'Carregar Imagem (opcional)' }}
            <input type="file" accept="image/*" class="hidden" :disabled="uploading" @change="onFileSelected" />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <input v-model="form.optionA" type="text" placeholder="Opção A" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input v-model="form.optionB" type="text" placeholder="Opção B" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input v-model="form.optionC" type="text" placeholder="Opção C" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input v-model="form.optionD" type="text" placeholder="Opção D" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <select v-model.number="form.correctIndex" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option :value="0">A</option>
            <option :value="1">B</option>
            <option :value="2">C</option>
            <option :value="3">D</option>
          </select>
          <input v-model.number="form.points" type="number" min="1" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        <p v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</p>

        <div class="flex gap-2 justify-end">
          <button v-if="editingId !== null" class="text-sm text-gray-400 underline" @click="resetForm">Cancelar</button>
          <button
            :disabled="registeredPhases.length === 0"
            class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            @click="saveQuestion"
          >
            {{ editingId !== null ? 'Guardar Alterações' : 'Adicionar' }}
          </button>
        </div>
      </div>
    </div>

    <div v-for="p in registeredPhases" :key="p.id" class="bg-white rounded-2xl shadow p-6">
      <h3 class="font-semibold text-sm text-gray-600 mb-3">
        {{ getPhaseLabel(p.order) }} ({{ groupedByPhase[p.order]?.length ?? 0 }})
      </h3>
      <div v-if="!groupedByPhase[p.order]?.length" class="text-xs text-gray-400">Nenhuma pergunta de desempate cadastrada.</div>
      <div v-for="q in groupedByPhase[p.order]" :key="q.id" class="flex items-center justify-between gap-3 border-b border-gray-50 py-2 last:border-0">
        <div class="text-sm flex-1 truncate">{{ q.text }} <span class="text-petro-primary font-semibold">· {{ q.points }} pts</span></div>
        <div class="flex gap-2 shrink-0">
          <button class="text-xs text-petro-primary underline" @click="editQuestion(q)">Editar</button>
          <button class="text-xs text-red-400 underline" @click="removeQuestion(q.id)">Remover</button>
        </div>
      </div>
    </div>
  </div>
</template>
