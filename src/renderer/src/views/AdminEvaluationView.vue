<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useQuizContentStore, type EvaluationCriteria } from '../stores/quizContent'
import { usePhasesStore } from '../stores/phases'
import { getBackendUrl } from '../services/backendConfig'
import { uploadImage } from '../services/upload'
import type { ChampionshipType } from '../stores/campeonato'

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const MAX_OPTIONS = 8
const MIN_OPTIONS = 2

interface Juror {
  id: string
  name: string
  code: string
}

interface EvaluationItemExtended {
  id: string
  championship: string
  type: string
  mode: string
  text: string
  imageUrl?: string | null
  optionA?: string | null
  optionB?: string | null
  optionC?: string | null
  optionD?: string | null
  optionE?: string | null
  optionF?: string | null
  optionG?: string | null
  optionH?: string | null
  correctIndexes?: number[] | string | null
  timeSeconds?: number | null
  maxPoints: number
  phase: number
  scope: string
  jurorIds?: string[]
}

const quizContent = useQuizContentStore()
const phasesStore = usePhasesStore()

const selectedChampionship = ref<ChampionshipType>('universitario')
const championshipOptions: { value: ChampionshipType; label: string }[] = [
  { value: 'universitario', label: 'Universitário' },
  { value: 'ensino_medio', label: 'Ensino Médio' },
  { value: 'exibicao', label: 'Exibição' }
]

const jurors = ref<Juror[]>([])
async function loadJurors(): Promise<void> {
  const res = await fetch(`${getBackendUrl()}/api/jurors`)
  jurors.value = await res.json()
}

const editingId = ref<string | null>(null)
const errorMsg = ref('')
const uploading = ref(false)

const form = ref({
  mode: 'aberta' as 'aberta' | 'multipla_escolha',
  text: '',
  maxPoints: 20,
  phase: null as number | null,
  scope: 'single' as 'single' | 'all',
  options: ['', ''] as string[],
  correctIndexes: [] as number[],
  timeSeconds: 30,
  imageUrl: '',
  jurorIds: [] as string[]
})

const registeredPhases = computed(() =>
  phasesStore.phases.filter((p) => p.type === 'quiz' || p.type === 'apresentacao_quiz')
)

function resolveImageUrl(path?: string | null): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${getBackendUrl()}${cleanPath}`
}

async function loadForChampionship(): Promise<void> {
  await phasesStore.fetchPhases(selectedChampionship.value)
  await quizContent.fetchEvaluationItems(selectedChampionship.value)
  if (registeredPhases.value.length > 0 && form.value.phase === null) {
    form.value.phase = registeredPhases.value[0].order
  }
}

onMounted(async () => {
  await loadJurors()
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
    mode: 'aberta',
    text: '',
    maxPoints: 20,
    phase: defaultPhase,
    scope: 'single',
    options: ['', ''],
    correctIndexes: [],
    timeSeconds: 30,
    imageUrl: '',
    jurorIds: []
  }
  newCriteriaLabel.value = ''
  newCriteriaPoints.value = 10
  errorMsg.value = ''
}

function addOption(): void {
  if (form.value.options.length >= MAX_OPTIONS) return
  form.value.options.push('')
}

function removeOption(index: number): void {
  if (form.value.options.length <= MIN_OPTIONS) return
  form.value.options.splice(index, 1)
  form.value.correctIndexes = form.value.correctIndexes
    .filter((i) => i !== index)
    .map((i) => (i > index ? i - 1 : i))
}

function editItem(item: EvaluationItemExtended): void {
  editingId.value = item.id

  let indexes: number[] = []
  if (item.correctIndexes !== undefined && item.correctIndexes !== null) {
    try {
      if (typeof item.correctIndexes === 'string') {
        const parsed = JSON.parse(item.correctIndexes)
        indexes = Array.isArray(parsed) ? parsed : []
      } else if (Array.isArray(item.correctIndexes)) {
        indexes = [...item.correctIndexes]
      }
    } catch {
      indexes = []
    }
  }

  const loadedOptions = LABELS
    .map((label) => (item as any)[`option${label}`] as string | null | undefined)
    .filter((v) => v !== null && v !== undefined) as string[]

  form.value = {
    mode: (item.mode as 'aberta' | 'multipla_escolha') ?? 'aberta',
    text: item.text,
    maxPoints: item.maxPoints,
    phase: item.phase,
    scope: (item.scope as 'single' | 'all') ?? 'single',
    options: loadedOptions.length >= MIN_OPTIONS ? loadedOptions : ['', ''],
    correctIndexes: indexes,
    timeSeconds: item.timeSeconds ?? 30,
    imageUrl: item.imageUrl ?? '',
    jurorIds: item.jurorIds ?? []
  }
  loadCriteria(item.id)
}

function toggleJuror(jurorId: string): void {
  const idx = form.value.jurorIds.indexOf(jurorId)
  if (idx === -1) form.value.jurorIds.push(jurorId)
  else form.value.jurorIds.splice(idx, 1)
}

function toggleCorrectIndex(index: number): void {
  const idx = form.value.correctIndexes.indexOf(index)
  if (idx === -1) {
    form.value.correctIndexes.push(index)
  } else {
    form.value.correctIndexes.splice(idx, 1)
  }
}

async function onFileSelected(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement
  if (!target.files || !target.files[0]) return
  const file = target.files[0]
  uploading.value = true
  errorMsg.value = ''
  try {
    const url = await uploadImage(file)
    form.value.imageUrl = url
  } catch {
    errorMsg.value = 'Falha ao carregar a imagem. Tenta outra vez.'
  } finally {
    uploading.value = false
    target.value = ''
  }
}

async function saveItem(): Promise<void> {
  if (!form.value.text.trim()) return
  if (form.value.phase === null) {
    errorMsg.value = 'Cadastra primeiro pelo menos uma fase de Quiz para este campeonato.'
    return
  }
  if (form.value.mode === 'multipla_escolha') {
    if (form.value.options.some((o) => !o.trim())) {
      errorMsg.value = 'Preenche o texto de todas as alíneas.'
      return
    }
    if (form.value.correctIndexes.length === 0) {
      errorMsg.value = 'Seleciona pelo menos uma resposta correta.'
      return
    }
  }

  errorMsg.value = ''

  const optionsPayload = form.value.mode === 'multipla_escolha'
    ? form.value.options.map((text, i) => ({ label: LABELS[i], text }))
    : undefined

  const payload = {
    championship: selectedChampionship.value,
    type: 'analitica' as const,
    mode: form.value.mode,
    text: form.value.text,
    maxPoints: form.value.maxPoints,
    phase: Number(form.value.phase),
    scope: form.value.scope,
    options: optionsPayload,
    correctIndexes: form.value.mode === 'multipla_escolha' ? JSON.stringify(form.value.correctIndexes) : undefined,
    timeSeconds: form.value.timeSeconds,
    imageUrl: form.value.imageUrl || undefined,
    jurorIds: form.value.mode === 'aberta' ? form.value.jurorIds : []
  }
  try {
    if (editingId.value !== null) {
      await quizContent.updateEvaluationItem(editingId.value, payload)
    } else {
      await quizContent.addEvaluationItem(payload)
      const savedItem = quizContent.evaluationItems.find(
        (i) => i.text === payload.text && i.phase === payload.phase && i.mode === payload.mode
      )
      if (savedItem) {
        editItem(savedItem as unknown as EvaluationItemExtended)
        return
      }
    }
    resetForm()
  } catch {
    errorMsg.value = 'Não foi possível guardar o item. Confirma que o backend está a correr.'
  }
}

async function removeItem(id: string): Promise<void> {
  errorMsg.value = ''
  try {
    await quizContent.deleteEvaluationItem(id, selectedChampionship.value)
    if (editingId.value === id) resetForm()
  } catch {
    errorMsg.value = 'Não foi possível remover o item - confirma que o backend está a correr e tenta outra vez.'
  }
}

async function clearAllItems(): Promise<void> {
  if (!confirm('Tem a certeza que deseja apagar TODOS os itens de avaliação deste campeonato?')) return
  errorMsg.value = ''
  try {
    await quizContent.clearAllEvaluationItems(selectedChampionship.value)
    resetForm()
  } catch {
    errorMsg.value = 'Falhou a apagar alguns itens - verifica se ainda há algum na lista e tenta outra vez.'
  }
}

function getPhaseLabel(phaseOrder: number): string {
  const found = phasesStore.phases.find((p) => p.order === phaseOrder)
  if (found) return `Fase ${found.order} (${found.label})`
  return `Fase ${phaseOrder}`
}

function jurorName(id: string): string {
  return jurors.value.find((j) => j.id === id)?.name ?? '?'
}

function itemOptionCount(item: EvaluationItemExtended): number {
  return LABELS.filter((label) => (item as any)[`option${label}`]).length
}

const newCriteriaLabel = ref('')
const newCriteriaPoints = ref(10)

function criteriaFor(itemId: string): EvaluationCriteria[] {
  return quizContent.criteriaForItem(itemId)
}

async function loadCriteria(itemId: string): Promise<void> {
  try {
    await quizContent.fetchEvaluationCriteria(itemId)
  } catch {
    errorMsg.value = 'Não foi possível carregar os critérios desta pergunta.'
  }
}

async function addCriteria(): Promise<void> {
  if (!editingId.value || !newCriteriaLabel.value.trim()) return
  try {
    await quizContent.addEvaluationCriteria(editingId.value, newCriteriaLabel.value.trim(), newCriteriaPoints.value)
    newCriteriaLabel.value = ''
    newCriteriaPoints.value = 10
  } catch {
    errorMsg.value = 'Não foi possível adicionar o critério.'
  }
}

async function removeCriteria(criteriaId: string): Promise<void> {
  if (!editingId.value) return
  try {
    await quizContent.deleteEvaluationCriteria(criteriaId, editingId.value)
  } catch {
    errorMsg.value = 'Não foi possível remover o critério.'
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-3xl mx-auto w-full">
    <div class="bg-white rounded-2xl shadow p-4">
      <label class="text-xs text-gray-500 block mb-1">Campeonato</label>
      <select v-model="selectedChampionship" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
        <option v-for="opt in championshipOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <p class="text-[11px] text-gray-400 mt-1">
        Os itens de avaliação são independentes por campeonato - cada um tem o seu próprio banco.
      </p>
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">
        {{ editingId !== null ? 'Editar Pergunta Analítica' : 'Nova Pergunta Analítica' }}
      </h2>

      <p class="text-[11px] text-gray-400 mb-3">
        Perguntas analíticas podem ser de <b>múltipla escolha</b> (correção automática, tempo próprio, até 8 alíneas) ou
        <b>abertas</b> (as equipas argumentam e os jurados atribuem a nota).
      </p>

      <div class="flex flex-col gap-3">
        <div>
          <label class="text-xs text-gray-500 block mb-1">Tipo de Pergunta</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-semibold border transition"
              :class="form.mode === 'aberta' ? 'bg-petro-primary text-white border-petro-primary' : 'bg-white border-gray-200 text-gray-600'"
              @click="form.mode = 'aberta'"
            >
              Aberta (jurados avaliam)
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-semibold border transition"
              :class="form.mode === 'multipla_escolha' ? 'bg-petro-primary text-white border-petro-primary' : 'bg-white border-gray-200 text-gray-600'"
              @click="form.mode = 'multipla_escolha'"
            >
              Múltipla Escolha
            </button>
          </div>
        </div>

        <div>
          <label class="text-xs text-gray-500 block mb-1">Fase</label>
          <select
            v-model="form.phase"
            :disabled="registeredPhases.length === 0"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option v-if="registeredPhases.length === 0" :value="null" disabled>
              ⚠️ Nenhuma fase de Quiz cadastrada para este campeonato
            </option>
            <option v-for="p in registeredPhases" :key="p.id" :value="p.order">
              Fase {{ p.order }} · {{ p.label }}
            </option>
          </select>
        </div>

        <div>
          <label class="text-xs text-gray-500 block mb-1">Quem responde?</label>
          <select v-model="form.scope" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="single">Apenas uma equipa responde essa questão</option>
            <option value="all">As duas equipas respondem essa questão</option>
          </select>
        </div>

        <textarea
          v-model="form.text"
          rows="2"
          placeholder="Enunciado da pergunta analítica"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        ></textarea>

        <div>
          <label class="text-xs text-gray-500 block mb-1">Pontuação Máxima</label>
          <input v-model.number="form.maxPoints" type="number" min="1" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label class="text-xs text-gray-500 block mb-1">Tempo para responder (segundos)</label>
          <input v-model.number="form.timeSeconds" type="number" min="5" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div class="flex items-center gap-4">
          <div class="w-20 h-14 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
            <img v-if="form.imageUrl" :src="resolveImageUrl(form.imageUrl)" alt="Imagem" class="w-full h-full object-cover" />
            <span v-else class="text-[10px] text-gray-400 text-center px-1">Sem imagem</span>
          </div>
          <label class="bg-petro-primary/10 text-petro-primary text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer text-center">
            {{ uploading ? 'A enviar...' : 'Carregar Imagem (opcional)' }}
            <input type="file" accept="image/*" class="hidden" :disabled="uploading" @change="onFileSelected" />
          </label>
        </div>

        <!-- MÚLTIPLA ESCOLHA -->
        <template v-if="form.mode === 'multipla_escolha'">
          <div>
            <label class="text-xs text-gray-500 block mb-2">
              Alíneas ({{ form.options.length }}/{{ MAX_OPTIONS }}) - marca as respostas corretas
            </label>
            <div class="flex flex-col gap-2">
              <div v-for="(opt, i) in form.options" :key="i" class="flex items-center gap-2">
                <label class="flex items-center gap-1.5 shrink-0 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    :checked="form.correctIndexes.includes(i)"
                    @change="toggleCorrectIndex(i)"
                    class="rounded text-petro-primary focus:ring-petro-primary"
                  />
                  <span class="w-6 text-xs font-bold text-gray-500">{{ LABELS[i] }}</span>
                </label>
                <input
                  v-model="form.options[i]"
                  type="text"
                  :placeholder="`Opção ${LABELS[i]}`"
                  class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  v-if="form.options.length > MIN_OPTIONS"
                  type="button"
                  class="text-xs text-red-400 underline shrink-0"
                  @click="removeOption(i)"
                >
                  Remover
                </button>
              </div>
            </div>
            <button
              v-if="form.options.length < MAX_OPTIONS"
              type="button"
              class="mt-2 text-xs text-petro-primary font-semibold underline"
              @click="addOption"
            >
              + Adicionar alínea
            </button>
          </div>
        </template>

        <!-- ABERTA -->
        <template v-else>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Jurados que avaliam esta pergunta</label>
            <p v-if="!jurors.length" class="text-xs text-gray-400">
              Nenhum jurado cadastrado ainda - vai a Admin → Jurados primeiro.
            </p>
            <div v-else class="flex flex-wrap gap-2">
              <button
                v-for="j in jurors"
                :key="j.id"
                type="button"
                class="text-xs px-3 py-1.5 rounded-full border transition"
                :class="form.jurorIds.includes(j.id) ? 'bg-petro-primary text-white border-petro-primary' : 'bg-white border-gray-200 text-gray-600'"
                @click="toggleJuror(j.id)"
              >
                {{ j.name }}
              </button>
            </div>
            <p class="text-[11px] text-gray-400 mt-1">
              Se não escolheres nenhum, todos os jurados registados na partida poderão avaliar esta pergunta.
            </p>
          </div>

          <div v-if="editingId !== null" class="border-t border-gray-100 pt-3">
            <label class="text-xs text-gray-500 block mb-1">Critérios de Avaliação</label>

            <div v-if="!criteriaFor(editingId).length" class="text-[11px] text-gray-400 mb-2">
              Sem critérios definidos - os jurados vão pontuar com uma nota única (0 a {{ form.maxPoints }}).
            </div>

            <div
              v-for="c in criteriaFor(editingId)"
              :key="c.id"
              class="flex items-center gap-2 mb-1 bg-gray-50 rounded-lg px-2 py-1.5"
            >
              <span class="text-sm flex-1">{{ c.label }}</span>
              <span class="text-xs text-gray-400">{{ c.maxPoints }} pts</span>
              <button class="text-xs text-red-400 underline" @click="removeCriteria(c.id)">Remover</button>
            </div>

            <div class="flex gap-2 mt-2">
              <input
                v-model="newCriteriaLabel"
                type="text"
                placeholder="Nome do critério (ex: Clareza)"
                class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                @keyup.enter="addCriteria"
              />
              <input
                v-model.number="newCriteriaPoints"
                type="number"
                min="1"
                class="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                class="bg-petro-primary/10 text-petro-primary text-xs font-semibold px-3 rounded-lg shrink-0"
                @click="addCriteria"
              >
                Adicionar
              </button>
            </div>
          </div>
          <p v-else class="text-[11px] text-amber-600">
            Guarda a pergunta primeiro para poderes adicionar critérios de avaliação.
          </p>
        </template>

        <p v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</p>

        <div class="flex gap-2 justify-end">
          <button v-if="editingId !== null" class="text-sm text-gray-400 underline" @click="resetForm">Concluído</button>
          <button
            :disabled="registeredPhases.length === 0"
            class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
            @click="saveItem"
          >
            {{ editingId !== null ? 'Guardar Alterações' : 'Adicionar Item' }}
          </button>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-sm text-gray-600">Itens Cadastrados</h3>
        <button
          v-if="quizContent.evaluationItems.length"
          class="text-xs text-red-500 hover:underline"
          @click="clearAllItems"
        >
          🗑️ Apagar Todos
        </button>
      </div>

      <div v-if="!quizContent.evaluationItems.length" class="text-xs text-gray-400 py-4 text-center">
        Nenhum item cadastrado para este campeonato.
      </div>

      <div
        v-for="item in quizContent.evaluationItems"
        :key="item.id"
        class="flex items-center justify-between gap-3 border-b border-gray-50 py-2 last:border-0"
      >
        <div class="text-sm flex-1 truncate">
          <span class="text-xs text-gray-400 uppercase">
            {{ getPhaseLabel(item.phase) }}
            <span v-if="item.scope === 'all'"> · As duas equipas respondem</span>
            <span v-else> · Apenas uma equipa responde</span>
            <span
              class="ml-1 font-bold px-1.5 py-0.5 rounded"
              :class="item.mode === 'multipla_escolha' ? 'bg-amber-100 text-amber-700' : 'bg-petro-primary/10 text-petro-primary'"
            >
              {{ item.mode === 'multipla_escolha' ? `Múltipla escolha · ${itemOptionCount(item as unknown as EvaluationItemExtended)} alíneas · ${item.timeSeconds ?? 30}s` : `Aberta · ${item.timeSeconds ?? 30}s` }}
            </span>
          </span>
          <div>{{ item.text }} <span class="text-petro-primary font-semibold">· {{ item.maxPoints }} pts</span></div>
          <div v-if="item.mode === 'aberta' && item.jurorIds?.length" class="text-[11px] text-gray-400 mt-0.5">
            Avaliada por: {{ item.jurorIds.map(jurorName).join(', ') }}
          </div>
        </div>
        <div class="flex gap-2 shrink-0">
          <button class="text-xs text-petro-primary underline" @click="editItem(item as unknown as EvaluationItemExtended)">Editar</button>
          <button class="text-xs text-red-400 underline" @click="removeItem(item.id)">Remover</button>
        </div>
      </div>
    </div>
  </div>
</template>
