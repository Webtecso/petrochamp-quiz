<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTiebreakQuestionsStore } from '../stores/tiebreakQuestions'
import { uploadImage } from '../services/upload'
import type { QuizQuestion } from '../data/questions'

const tiebreakStore = useTiebreakQuestionsStore()

onMounted(() => {
  tiebreakStore.fetchQuestions()
})

const editingId = ref<number | null>(null)
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

function resetForm(): void {
  editingId.value = null
  form.value = { text: '', imageUrl: '', optionA: '', optionB: '', optionC: '', optionD: '', correctIndex: 0, points: 10, phase: 1 }
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
  try {
    form.value.imageUrl = await uploadImage(file)
  } finally {
    uploading.value = false
  }
}

async function saveQuestion(): Promise<void> {
  if (!form.value.text.trim()) return
  const options = [
    { label: 'A', text: form.value.optionA },
    { label: 'B', text: form.value.optionB },
    { label: 'C', text: form.value.optionC },
    { label: 'D', text: form.value.optionD }
  ]
  const payload = {
    text: form.value.text,
    options,
    correctIndex: form.value.correctIndex,
    points: form.value.points,
    phase: form.value.phase,
    imageUrl: form.value.imageUrl || undefined
  }
  if (editingId.value !== null) {
    await tiebreakStore.updateQuestion(editingId.value, payload)
  } else {
    await tiebreakStore.addQuestion(payload)
  }
  resetForm()
}

async function removeQuestion(id: number): Promise<void> {
  await tiebreakStore.deleteQuestion(id)
  if (editingId.value === id) resetForm()
}

const groupedByPhase = computed(() => {
  const groups: Record<number, QuizQuestion[]> = { 1: [], 2: [], 3: [] }
  for (const q of tiebreakStore.questions) {
    if (!groups[q.phase]) groups[q.phase] = []
    groups[q.phase].push(q)
  }
  return groups
})
</script>

<template>
  <div class="flex flex-col gap-6 max-w-3xl mx-auto w-full">
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
      Estas perguntas ficam reservadas só para desempates — nunca aparecem no jogo normal. A lógica que as aciona
      automaticamente quando há empate ainda não está ligada; por agora, o banco já fica pronto e organizado.
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">{{ editingId !== null ? 'Editar Pergunta de Desempate' : 'Nova Pergunta de Desempate' }}</h2>
      <div class="flex flex-col gap-3">
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

        <div class="grid grid-cols-3 gap-3">
          <select v-model.number="form.correctIndex" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option :value="0">A</option>
            <option :value="1">B</option>
            <option :value="2">C</option>
            <option :value="3">D</option>
          </select>
          <input v-model.number="form.points" type="number" min="1" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <select v-model.number="form.phase" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option :value="1">1 · Perfuração</option>
            <option :value="2">2 · Extração</option>
            <option :value="3">3 · Refinação</option>
          </select>
        </div>

        <div class="flex gap-2 justify-end">
          <button v-if="editingId !== null" class="text-sm text-gray-400 underline" @click="resetForm">Cancelar</button>
          <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold" @click="saveQuestion">
            {{ editingId !== null ? 'Guardar Alterações' : 'Adicionar' }}
          </button>
        </div>
      </div>
    </div>

    <div v-for="phase in [1, 2, 3]" :key="phase" class="bg-white rounded-2xl shadow p-6">
      <h3 class="font-semibold text-sm text-gray-600 mb-3">Fase {{ phase }} ({{ groupedByPhase[phase]?.length ?? 0 }})</h3>
      <div v-if="!groupedByPhase[phase]?.length" class="text-xs text-gray-400">Nenhuma pergunta de desempate cadastrada.</div>
      <div v-for="q in groupedByPhase[phase]" :key="q.id" class="flex items-center justify-between gap-3 border-b border-gray-50 py-2 last:border-0">
        <div class="text-sm flex-1 truncate">{{ q.text }} <span class="text-petro-primary font-semibold">· {{ q.points }} pts</span></div>
        <div class="flex gap-2 shrink-0">
          <button class="text-xs text-petro-primary underline" @click="editQuestion(q)">Editar</button>
          <button class="text-xs text-red-400 underline" @click="removeQuestion(q.id)">Remover</button>
        </div>
      </div>
    </div>
  </div>
</template>
