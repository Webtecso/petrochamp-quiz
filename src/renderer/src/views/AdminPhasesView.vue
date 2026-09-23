<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { usePhasesStore, type Phase } from '../stores/phases'
import type { ChampionshipType } from '../stores/campeonato'
import { adminFetch } from '../services/adminAuth'

const phasesStore = usePhasesStore()
const errorMsg = ref('')
const repairing = ref(false)
const resyncing = ref(false)
const selectedChampionship = ref<ChampionshipType>('universitario')

const championshipOptions: { value: ChampionshipType; label: string }[] = [
  { value: 'universitario', label: 'Universitário' },
  { value: 'ensino_medio', label: 'Ensino Médio' },
  { value: 'exibicao', label: 'Exibição' }
]

const editingId = ref<string | null>(null)
const form = ref({
  label: '',
  type: 'quiz' as 'quiz' | 'apresentacao',
  useQuestions: true,
  useJudges: false,
  maxQuestions: null as number | null,
  questionsPerTeam: null as number | null,
  useInitialScores: false,
  initialScoreMaxPoints: null as number | null,
  presentationMinutes: null as number | null,
  presentationWeight: 50 as number | null,
  quizWeight: 50 as number | null,
  noElimination: false,
  questionSelectionMode: 'automatic' as 'automatic' | 'per_team'
})

onMounted(() => {
  phasesStore.fetchPhases(selectedChampionship.value)
})

watch(selectedChampionship, (val) => {
  resetForm()
  phasesStore.fetchPhases(val)
})

// DEPOIS de form estar declarado
watch(
  () => form.value.type,
  (type) => {
    if (type === 'apresentacao') {
      form.value.useQuestions = false
      form.value.questionsPerTeam = null
      form.value.maxQuestions = null
      form.value.useInitialScores = false
    } else if (type === 'quiz') {
      form.value.useQuestions = true
      form.value.presentationMinutes = null
    }
  }
)

function resetForm(): void {
  editingId.value = null
  form.value = {
    label: '',
    type: 'quiz',
    useQuestions: true,
    useJudges: false,
    maxQuestions: null,
    questionsPerTeam: null,
    useInitialScores: false,
    initialScoreMaxPoints: null,
    presentationMinutes: null,
    presentationWeight: 50,
    quizWeight: 50,
    noElimination: false,
    questionSelectionMode: 'automatic'
  }
}

function editPhase(p: Phase): void {
  editingId.value = p.id
  // se ainda houver fases antigas apresentacao_quiz na BD, trata como apresentacao
  const type =
    p.type === 'apresentacao' || p.type === 'apresentacao_quiz' ? 'apresentacao' : 'quiz'
  form.value = {
    label: p.label,
    type,
    useQuestions: type === 'apresentacao' ? false : p.useQuestions,
    useJudges: p.useJudges,
    maxQuestions: p.maxQuestions ?? null,
    questionsPerTeam: p.questionsPerTeam ?? null,
    useInitialScores: p.useInitialScores,
    initialScoreMaxPoints: p.initialScoreMaxPoints ?? null,
    presentationMinutes: p.presentationMinutes ?? null,
    presentationWeight: p.presentationWeight ?? 50,
    quizWeight: p.quizWeight ?? 50,
    noElimination: p.noElimination ?? false,
    questionSelectionMode: p.questionSelectionMode ?? 'automatic'
  }
}

async function resyncPresentationDuplas(): Promise<void> {
  try {
    await adminFetch(`/api/bracket-live/${selectedChampionship.value}/resync-presentation`, {
      method: 'POST'
    })
  } catch (e) {
    console.error('Falha ao sincronizar duplas de apresentação automaticamente:', e)
  }
}

async function savePhase(): Promise<void> {
  if (!form.value.label.trim()) return
  errorMsg.value = ''

  if (form.value.type === 'apresentacao') {
    form.value.useQuestions = false
  }
  if (form.value.type === 'quiz') {
    form.value.useQuestions = true
  }

  try {
    if (editingId.value !== null) {
      await phasesStore.updatePhase(editingId.value, {
        ...form.value,
        championship: selectedChampionship.value
      })
    } else {
      await phasesStore.addPhase({
        ...form.value,
        championship: selectedChampionship.value
      })
    }
    if (form.value.type === 'apresentacao') {
      await resyncPresentationDuplas()
    }
    resetForm()
  } catch {
    errorMsg.value = 'Não foi possível guardar a fase. Confirma que o backend está a correr.'
  }
}

async function removePhase(id: string): Promise<void> {
  errorMsg.value = ''
  try {
    await phasesStore.deletePhase(id, selectedChampionship.value)
    if (editingId.value === id) resetForm()
  } catch {
    errorMsg.value = 'Não foi possível remover a fase.'
  }
}

async function moveUp(phase: Phase): Promise<void> {
  const idx = phasesStore.phases.findIndex((p) => p.id === phase.id)
  if (idx <= 0) return
  const prev = phasesStore.phases[idx - 1]
  await phasesStore.swapPhases(phase.id, prev.id, selectedChampionship.value)
}

async function moveDown(phase: Phase): Promise<void> {
  const idx = phasesStore.phases.findIndex((p) => p.id === phase.id)
  if (idx === -1 || idx >= phasesStore.phases.length - 1) return
  const next = phasesStore.phases[idx + 1]
  await phasesStore.swapPhases(phase.id, next.id, selectedChampionship.value)
}

async function repairNumbering(): Promise<void> {
  repairing.value = true
  errorMsg.value = ''
  try {
    await phasesStore.repairNumbering(selectedChampionship.value)
  } catch {
    errorMsg.value = 'Não foi possível reparar a numeração.'
  } finally {
    repairing.value = false
  }
}

async function manualResyncPresentation(): Promise<void> {
  resyncing.value = true
  errorMsg.value = ''
  try {
    await resyncPresentationDuplas()
  } catch {
    errorMsg.value = 'Não foi possível sincronizar as duplas de apresentação.'
  } finally {
    resyncing.value = false
  }
}

function typeLabel(type: string): string {
  if (type === 'apresentacao' || type === 'apresentacao_quiz') return 'Apresentação de Projetos'
  return 'Quiz'
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-2xl mx-auto w-full">
    <div class="bg-white rounded-2xl shadow p-4">
      <label class="text-xs text-gray-500 block mb-1">Campeonato</label>
      <select v-model="selectedChampionship" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
        <option v-for="opt in championshipOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <p class="text-[11px] text-gray-400 mt-1">
        As fases são independentes por campeonato - cada um tem a sua própria lista.
      </p>
    </div>

    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
      <p class="text-xs text-amber-700">
        Se já apagaste fases de teste antes desta correção, a numeração pode ter ficado com "buracos". Clica aqui
        para corrigir, dentro do campeonato selecionado acima.
      </p>
      <button
        class="bg-amber-500 text-white rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap disabled:opacity-50"
        :disabled="repairing"
        @click="repairNumbering"
      >
        {{ repairing ? 'A reparar...' : 'Reparar Numeração' }}
      </button>
    </div>

    <div class="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-center justify-between gap-3">
      <p class="text-xs text-sky-700">
        Se uma fase de Apresentação não estiver a mostrar as duplas geradas pelo Chaveamento, clica aqui para
        forçar a sincronização (não apaga nada do chaveamento já feito).
      </p>
      <button
        class="bg-sky-500 text-white rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap disabled:opacity-50"
        :disabled="resyncing"
        @click="manualResyncPresentation"
      >
        {{ resyncing ? 'A sincronizar...' : 'Sincronizar Duplas de Apresentação' }}
      </button>
    </div>

    <p v-if="errorMsg" class="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{{ errorMsg }}</p>

    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">{{ editingId !== null ? 'Editar Fase' : 'Nova Fase' }}</h2>
      <div class="flex flex-col gap-3">
        <input
          v-model="form.label"
          type="text"
          placeholder="Nome da fase (ex: Perfuração)"
          class="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />

        <div>
          <label class="text-xs text-gray-500 block mb-1">Tipo de Fase</label>
          <select v-model="form.type" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="quiz">Quiz</option>
            <option value="apresentacao">Apresentação de Projetos</option>
            <!-- <option value="apresentacao_quiz">Apresentação + Quiz</option> -->
          </select>
        </div>

        <template v-if="form.type === 'quiz'">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 block mb-1">Máximo de perguntas nesta fase</label>
              <input v-model.number="form.maxQuestions" type="number" min="1" placeholder="Sem limite" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Perguntas por equipa</label>
              <input v-model.number="form.questionsPerTeam" type="number" min="1" placeholder="Sem limite" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Usa Perguntas?</span>
            <button
              class="w-12 h-6 rounded-full transition relative shrink-0"
              :class="form.useQuestions ? 'bg-petro-primary' : 'bg-gray-200'"
              @click="form.useQuestions = !form.useQuestions"
            >
              <span class="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all" :class="form.useQuestions ? 'left-6' : 'left-0.5'"></span>
            </button>
          </div>
        </template>

        <template v-if="form.type === 'apresentacao'">
          <div>
            <label class="text-xs text-gray-500 block mb-1">Tempo de apresentação (minutos)</label>
            <input v-model.number="form.presentationMinutes" type="number" min="1" placeholder="Ex: 10" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </template>

        <!-- NOVO - só para fase 'apresentacao' pura: opção de não eliminar
        ninguém e transportar a nota (ponderada) para o Quiz seguinte. -->
        <template v-if="form.type === 'apresentacao'">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-sm text-gray-600 block">Sem eliminação nesta fase</span>
              <p class="text-[11px] text-gray-400">
                Todas as equipas avançam. A nota da apresentação é somada (com peso) à nota do Quiz da fase seguinte.
              </p>
            </div>
            <button
              class="w-12 h-6 rounded-full transition relative shrink-0"
              :class="form.noElimination ? 'bg-petro-primary' : 'bg-gray-200'"
              @click="form.noElimination = !form.noElimination"
            >
              <span class="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all" :class="form.noElimination ? 'left-6' : 'left-0.5'"></span>
            </button>
          </div>
          <div v-if="form.noElimination" class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 block mb-1">Peso da Apresentação (%)</label>
              <input v-model.number="form.presentationWeight" type="number" min="0" max="100" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Peso do Quiz seguinte (%)</label>
              <input v-model.number="form.quizWeight" type="number" min="0" max="100" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </template>

        <!-- <template v-if="form.type === 'apresentacao_quiz'">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 block mb-1">Peso da Apresentação (%)</label>
              <input v-model.number="form.presentationWeight" type="number" min="0" max="100" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Peso do Quiz (%)</label>
              <input v-model.number="form.quizWeight" type="number" min="0" max="100" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </template> -->

        <div v-if="form.type === 'quiz'" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">Seleção de perguntas por equipa?</span>
          <button
            class="w-12 h-6 rounded-full transition relative shrink-0"
            :class="form.questionSelectionMode === 'per_team' ? 'bg-petro-primary' : 'bg-gray-200'"
            @click="form.questionSelectionMode = form.questionSelectionMode === 'per_team' ? 'automatic' : 'per_team'"
          >
            <span class="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all" :class="form.questionSelectionMode === 'per_team' ? 'left-6' : 'left-0.5'"></span>
          </button>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600">Usa Avaliação dos Jurados?</span>
          <button
            class="w-12 h-6 rounded-full transition relative shrink-0"
            :class="form.useJudges ? 'bg-petro-primary' : 'bg-gray-200'"
            @click="form.useJudges = !form.useJudges"
          >
            <span class="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all" :class="form.useJudges ? 'left-6' : 'left-0.5'"></span>
          </button>
        </div>

        <template v-if="form.type === 'quiz'">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Usa Notas Iniciais dos Jurados?</span>
            <button
              class="w-12 h-6 rounded-full transition relative shrink-0"
              :class="form.useInitialScores ? 'bg-petro-primary' : 'bg-gray-200'"
              @click="form.useInitialScores = !form.useInitialScores"
            >
              <span class="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all" :class="form.useInitialScores ? 'left-6' : 'left-0.5'"></span>
            </button>
          </div>
          <div v-if="form.useInitialScores">
            <label class="text-xs text-gray-500 block mb-1">Pontuação máxima por jurado (nota inicial)</label>
            <input v-model.number="form.initialScoreMaxPoints" type="number" min="1" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </template>

        <div class="flex gap-2 justify-end">
          <button v-if="editingId !== null" class="text-sm text-gray-400 underline" @click="resetForm">Cancelar</button>
          <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold" @click="savePhase">
            {{ editingId !== null ? 'Guardar Alterações' : 'Adicionar Fase' }}
          </button>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h3 class="font-semibold text-sm text-gray-600 mb-3">Fases deste Campeonato ({{ phasesStore.phases.length }})</h3>
      <div v-if="!phasesStore.phases.length" class="text-xs text-gray-400">
        Nenhuma fase cadastrada para este campeonato ainda.
      </div>
      <div v-for="(p, i) in phasesStore.phases" :key="p.id" class="flex items-center justify-between gap-3 border-b border-gray-50 py-3 last:border-0">
        <div class="flex items-center gap-2">
          <div class="flex flex-col">
            <button class="text-gray-300 hover:text-petro-primary disabled:opacity-20" :disabled="i === 0" @click="moveUp(p)">▲</button>
            <button class="text-gray-300 hover:text-petro-primary disabled:opacity-20" :disabled="i === phasesStore.phases.length - 1" @click="moveDown(p)">▼</button>
          </div>
          <div>
            <div class="font-semibold text-sm">
              Fase {{ p.order }} · {{ p.label }}
              <span class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-petro-primary/10 text-petro-primary">
                {{ typeLabel(p.type) }}
              </span>
            </div>
            <div class="text-xs text-gray-400">
              <span v-if="p.useQuestions">Perguntas</span>
              <span v-if="p.useQuestions && p.useJudges"> + </span>
              <span v-if="p.useJudges">Avaliação dos Jurados</span>
              <span v-if="!p.useQuestions && !p.useJudges && p.type === 'quiz'">Sem avaliação configurada</span>
              <span v-if="p.maxQuestions"> · máx {{ p.maxQuestions }} perguntas</span>
              <span v-if="p.questionsPerTeam"> · {{ p.questionsPerTeam }}/equipa</span>
              <span v-if="p.presentationMinutes"> · {{ p.presentationMinutes }} min de apresentação</span>
              <!-- <span v-if="p.type === 'apresentacao_quiz'"> · {{ p.presentationWeight }}%/{{ p.quizWeight }}%</span> -->
              <span v-if="p.type === 'apresentacao' && p.noElimination"> · sem eliminação ({{ p.presentationWeight }}%/{{ p.quizWeight }}%)</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2 shrink-0">
          <button class="text-xs text-petro-primary underline" @click="editPhase(p)">Editar</button>
          <button class="text-xs text-red-400 underline" @click="removePhase(p.id)">Remover</button>
        </div>
      </div>
    </div>
  </div>
</template>
