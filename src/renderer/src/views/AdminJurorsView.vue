<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { usePhasesStore } from '../stores/phases'
import { adminFetch } from '../services/adminAuth'
import type { ChampionshipType } from '../stores/campeonato'

interface Juror {
  id: string
  name: string
  code: string
}
interface Authorization {
  id: string
  phaseId: string
  jurorId: string
}

const phasesStore = usePhasesStore()
const selectedChampionship = ref<ChampionshipType>('universitario')
const selectedPhaseId = ref<string | null>(null)
const jurors = ref<Juror[]>([])
const authorizations = ref<Authorization[]>([])
const newJurorName = ref('')
const errorMsg = ref('')

const championshipOptions: { value: ChampionshipType; label: string }[] = [
  { value: 'universitario', label: 'Universitário' },
  { value: 'ensino_medio', label: 'Ensino Médio' },
  { value: 'exibicao', label: 'Exibição' }
]

async function loadJurors(): Promise<void> {
  const res = await adminFetch('/api/jurors')
  if (res.ok) {
    jurors.value = await res.json()
  }
}

async function loadPhases(): Promise<void> {
  await phasesStore.fetchPhases(selectedChampionship.value)
  selectedPhaseId.value = phasesStore.phases[0]?.id ?? null
  await loadAuthorizations()
}

async function loadAuthorizations(): Promise<void> {
  if (!selectedPhaseId.value) {
    authorizations.value = []
    return
  }
  const res = await adminFetch(`/api/jurors/authorizations?phaseId=${selectedPhaseId.value}`)
  if (res.ok) {
    authorizations.value = await res.json()
  }
}

onMounted(async () => {
  await loadJurors()
  await loadPhases()
})

watch(selectedChampionship, loadPhases)
watch(selectedPhaseId, loadAuthorizations)

function isAuthorized(jurorId: string): boolean {
  return authorizations.value.some((a) => a.jurorId === jurorId)
}

async function toggleAuthorization(jurorId: string): Promise<void> {
  if (!selectedPhaseId.value) return
  const existing = authorizations.value.find((a) => a.jurorId === jurorId)
  if (existing) {
    await adminFetch(`/api/jurors/authorizations/${existing.id}`, { method: 'DELETE' })
  } else {
    await adminFetch('/api/jurors/authorizations', {
      method: 'POST',
      body: JSON.stringify({ phaseId: selectedPhaseId.value, jurorId })
    })
  }
  await loadAuthorizations()
}

async function addJuror(): Promise<void> {
  if (!newJurorName.value.trim()) return
  errorMsg.value = ''
  try {
    const res = await adminFetch('/api/jurors', {
      method: 'POST',
      body: JSON.stringify({ name: newJurorName.value.trim() })
    })
    if (!res.ok) throw new Error()
    newJurorName.value = ''
    await loadJurors()
  } catch {
    errorMsg.value = 'Falha ao criar jurado.'
  }
}

async function removeJuror(id: string): Promise<void> {
  const ok = confirm('Remover este jurado? O código dele deixa de funcionar.')
  if (!ok) return
  await adminFetch(`/api/jurors/${id}`, { method: 'DELETE' })
  await loadJurors()
  await loadAuthorizations()
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-2xl mx-auto w-full">
    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">Jurados Cadastrados</h2>
      <div class="flex gap-2 mb-4">
        <input
          v-model="newJurorName"
          type="text"
          placeholder="Nome do jurado"
          class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          @keyup.enter="addJuror"
        />
        <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold" @click="addJuror">
          Adicionar
        </button>
      </div>
      <p v-if="errorMsg" class="text-xs text-red-500 mb-2">{{ errorMsg }}</p>
      <div v-if="!jurors.length" class="text-xs text-gray-400">Nenhum jurado cadastrado ainda.</div>
      <div v-for="j in jurors" :key="j.id" class="flex items-center justify-between gap-3 border-b border-gray-50 py-2 last:border-0">
        <div class="text-sm">
          {{ j.name }}
          <span class="font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs ml-2">{{ j.code }}</span>
        </div>
        <button class="text-xs text-red-400 underline" @click="removeJuror(j.id)">Remover</button>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">Autorizar Jurados por Fase</h2>
      <div class="grid grid-cols-2 gap-3 mb-4">
        <select v-model="selectedChampionship" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option v-for="opt in championshipOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <select v-model="selectedPhaseId" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option v-for="p in phasesStore.phases" :key="p.id" :value="p.id">Fase {{ p.order }} · {{ p.label }}</option>
        </select>
      </div>

      <p v-if="!phasesStore.phases.length" class="text-xs text-gray-400">
        Este campeonato ainda não tem fases cadastradas.
      </p>
      <p v-else-if="!jurors.length" class="text-xs text-gray-400">Cadastra jurados acima primeiro.</p>
      <div v-else class="flex flex-col gap-2">
        <div v-for="j in jurors" :key="j.id" class="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-2">
          <span class="text-sm">{{ j.name }} <span class="text-gray-400 font-mono text-xs">{{ j.code }}</span></span>
          <button
            class="w-12 h-6 rounded-full transition relative shrink-0"
            :class="isAuthorized(j.id) ? 'bg-petro-primary' : 'bg-gray-200'"
            @click="toggleAuthorization(j.id)"
          >
            <span class="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all" :class="isAuthorized(j.id) ? 'left-6' : 'left-0.5'"></span>
          </button>
        </div>
      </div>
      <p class="text-[11px] text-gray-400 mt-3">
        Se uma fase não tiver nenhum jurado autorizado aqui, qualquer código válido pode entrar nela sem restrição.
      </p>
    </div>
  </div>
</template>
