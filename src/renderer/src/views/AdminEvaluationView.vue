<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useQuizContentStore } from '../stores/quizContent'
import { usePhasesStore } from '../stores/phases'
import type { EvaluationItem } from '../data/evaluationItems'
import type { ChampionshipType } from '../stores/campeonato'

const quizContent = useQuizContentStore()
const phasesStore = usePhasesStore()

// CORRIGIDO: este ecrã nunca tinha seletor de campeonato — desde que
// fetchPhases/fetchEvaluationItems passaram a exigir championship, isto
// devolvia sempre listas vazias e os botões pareciam "desativados".
const selectedChampionship = ref<ChampionshipType>('universitario')
const championshipOptions: { value: ChampionshipType; label: string }[] = [
  { value: 'universitario', label: 'Universitário' },
  { value: 'ensino_medio', label: 'Ensino Médio' },
  { value: 'exibicao', label: 'Exibição' }
]

const editingId = ref<string | null>(null)
const errorMsg = ref('')
const form = ref({
  text: '',
  maxPoints: 20,
  phase: null as number | null,
  scope: 'single' as 'single' | 'all'
})

// CORRIGIDO: só fases que usam Quiz — Apresentação de Projetos já não usa
// EvaluationItem, tem a sua própria grelha (Admin → Apresentação).
const registeredPhases = computed(() =>
  phasesStore.phases.filter((p) => p.type === 'quiz' || p.type === 'apresentacao_quiz')
)

async function loadForChampionship(): Promise<void> {
  await phasesStore.fetchPhases(selectedChampionship.value)
  await quizContent.fetchEvaluationItems(selectedChampionship.value)
  if (registeredPhases.value.length > 0 && form.value.phase === null) {
    form.value.phase = registeredPhases.value[0].order
  }
}

onMounted(loadForChampionship)
watch(selectedChampionship, () => {
  resetForm()
  loadForChampionship()
})

function resetForm(): void {
  editingId.value = null
  const defaultPhase = registeredPhases.value.length > 0 ? registeredPhases.value[0].order : null
  form.value = {
    text: '',
    maxPoints: 20,
    phase: defaultPhase,
    scope: 'single'
  }
  errorMsg.value = ''
}

function editItem(item: EvaluationItem): void {
  editingId.value = item.id
  form.value = {
    text: item.text,
    maxPoints: item.maxPoints,
    phase: item.phase,
    scope: item.scope ?? 'single'
  }
}

async function saveItem(): Promise<void> {
  if (!form.value.text.trim()) return
  if (form.value.phase === null) {
    errorMsg.value = 'Cadastra primeiro pelo menos uma fase de Quiz para este campeonato.'
    return
  }
  errorMsg.value = ''
  const payload = {
    championship: selectedChampionship.value,
    type: 'analitica' as const,
    text: form.value.text,
    maxPoints: form.value.maxPoints,
    phase: Number(form.value.phase),
    scope: form.value.scope
  }
  try {
    if (editingId.value !== null) {
      await quizContent.updateEvaluationItem(editingId.value, payload)
    } else {
      await quizContent.addEvaluationItem(payload)
    }
    resetForm()
  } catch {
    errorMsg.value = 'Não foi possível guardar o item. Confirma que o backend está a correr.'
  }
}

async function removeItem(id: string): Promise<void> {
  errorMsg.value = ''
  try {
    await quizContent.deleteEvaluationItem(id)
    if (editingId.value === id) resetForm()
  } catch {
    errorMsg.value = 'Não foi possível remover o item — confirma que o backend está a correr e tenta outra vez.'
  }
}

async function clearAllItems(): Promise<void> {
  if (!confirm('Tem a certeza que deseja apagar TODOS os itens de avaliação deste campeonato?')) return
  errorMsg.value = ''
  try {
    await quizContent.clearAllEvaluationItems()
    resetForm()
  } catch {
    errorMsg.value = 'Falhou a apagar alguns itens — verifica se ainda há algum na lista e tenta outra vez.'
  }
}

function getPhaseLabel(phaseOrder: number): string {
  const found = phasesStore.phases.find((p) => p.order === phaseOrder)
  if (found) return `Fase ${found.order} (${found.label})`
  return `Fase ${phaseOrder}`
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
        Os itens de avaliação são independentes por campeonato — cada um tem o seu próprio banco.
      </p>
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">
        {{ editingId !== null ? 'Editar Pergunta Analítica' : 'Nova Pergunta Analítica' }}
      </h2>

      <p class="text-[11px] text-gray-400 mb-3">
        Perguntas analíticas são avaliadas pelos jurados (sem alternativas nem pontuação automática). Para
        Apresentação de Projetos, usa Admin → Apresentação — tem a sua própria grelha de critérios.
      </p>

      <div class="flex flex-col gap-3">
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
            <option value="single">Apenas uma equipa de cada vez</option>
            <option value="all">Todas as equipas respondem à mesma pergunta</option>
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

        <p v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</p>

        <div class="flex gap-2 justify-end">
          <button v-if="editingId !== null" class="text-sm text-gray-400 underline" @click="resetForm">Cancelar</button>
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
            <span v-if="item.scope === 'all'"> · Todas as equipas</span>
          </span>
          <div>{{ item.text }} <span class="text-petro-primary font-semibold">· {{ item.maxPoints }} pts</span></div>
        </div>
        <div class="flex gap-2 shrink-0">
          <button class="text-xs text-petro-primary underline" @click="editItem(item)">Editar</button>
          <button class="text-xs text-red-400 underline" @click="removeItem(item.id)">Remover</button>
        </div>
      </div>
    </div>
  </div>
</template>
