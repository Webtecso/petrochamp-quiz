<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { usePhasesStore } from '../stores/phases'
import { useTeamsStore } from '../stores/teams'
import { getBackendUrl } from '../services/backendConfig'
import { adminFetch } from '../services/adminAuth'
import { connectSocket } from '../services/socket'
import type { ChampionshipType } from '../stores/campeonato'

interface Dupla {
  id: string
  order: number
  themeA: string
  themeB: string | null
  teamAId: string
  teamBId: string | null
}
interface Criteria {
  id: string
  label: string
  maxPoints: number
}
interface DocumentInfo {
  id: string
  slides: { order: number; imageUrl: string }[]
}
interface PendingSlide {
  file: File
  order: number
  previewUrl: string
}

const phasesStore = usePhasesStore()
const teamsStore = useTeamsStore()

const selectedChampionship = ref<ChampionshipType>('universitario')
const selectedPhaseId = ref<string | null>(null)
const duplas = ref<Dupla[]>([])
const criteria = ref<Criteria[]>([])
const documentsMap = ref<Record<string, DocumentInfo>>({})
const errorMsg = ref('')
const uploadingKey = ref<string | null>(null)
const refreshing = ref(false)
const pendingByTeam = ref<Record<string, PendingSlide[]>>({})

const championshipOptions: { value: ChampionshipType; label: string }[] = [
  { value: 'universitario', label: 'Universitário' },
  { value: 'ensino_medio', label: 'Ensino Médio' },
  { value: 'exibicao', label: 'Exibição' }
]

const presentationPhases = computed(() =>
  phasesStore.phases.filter((p) => p.type === 'apresentacao' || p.type === 'apresentacao_quiz')
)

const totalCriteriaPoints = computed(() => criteria.value.reduce((sum, c) => sum + c.maxPoints, 0))

async function loadPhases(): Promise<void> {
  await phasesStore.fetchPhases(selectedChampionship.value)
  selectedPhaseId.value = presentationPhases.value[0]?.id ?? null
  await loadAll()
}

async function loadAll(): Promise<void> {
  if (!selectedPhaseId.value) {
    duplas.value = []
    criteria.value = []
    documentsMap.value = {}
    return
  }
  const [duplasRes, criteriaRes, documentsRes] = await Promise.all([
    fetch(`${getBackendUrl()}/api/presentation/duplas?phaseId=${selectedPhaseId.value}&championship=${selectedChampionship.value}`),
    fetch(`${getBackendUrl()}/api/presentation/criteria?phaseId=${selectedPhaseId.value}`),
    fetch(`${getBackendUrl()}/api/presentation-documents?phaseId=${selectedPhaseId.value}`)
  ])
  duplas.value = await duplasRes.json()
  criteria.value = await criteriaRes.json()

  const docs: (DocumentInfo & { duplaId: string; teamId: string })[] = await documentsRes.json()
  const map: Record<string, DocumentInfo> = {}
  for (const d of docs) {
    if (d.slides.length) map[`${d.duplaId}:${d.teamId}`] = { id: d.id, slides: d.slides }
  }
  documentsMap.value = map
}

// Força uma sincronização com o Cloud (POST /api/sync/run) e só depois
// recarrega os dados desta view. Se o backend não tiver CLOUD_API_URL
// configurado, o sync simplesmente não corre (ran: false) e seguimos só
// com o refresh local — não é tratado como erro.
async function manualRefresh(): Promise<void> {
  refreshing.value = true
  errorMsg.value = ''
  try {
    await adminFetch('/api/sync/run', { method: 'POST' }).catch(() => null)
    await loadAll()
  } catch {
    errorMsg.value = 'Falha ao atualizar.'
  } finally {
    refreshing.value = false
  }
}

// Sempre que o backend emitir 'config:updated' para 'presentation', 'bracket'
// ou 'phases', recarrega os dados desta view — assim não é preciso reabrir
// o app para ver o que mudou no outro lado (local ↔ cloud).
function onConfigUpdated(payload: { type: string; championship?: string | null }): void {
  if (payload.type === 'presentation' || payload.type === 'bracket' || payload.type === 'phases') {
    loadAll()
  }
}

onMounted(async () => {
  await teamsStore.fetchTeams()
  await loadPhases()
  const socket = connectSocket()
  socket.on('config:updated', onConfigUpdated)
})

onUnmounted(() => {
  const socket = connectSocket()
  socket.off('config:updated', onConfigUpdated)
})

watch(selectedChampionship, loadPhases)
watch(selectedPhaseId, loadAll)

const editingTheme = ref<Record<string, string>>({})

async function saveTheme(duplaId: string, team: 'A' | 'B'): Promise<void> {
  const key = `${duplaId}:${team}`
  const theme = editingTheme.value[key]?.trim()
  if (!theme) return
  await adminFetch(`/api/presentation/duplas/${duplaId}/theme`, {
    method: 'PATCH',
    body: JSON.stringify({ team, theme })
  })
  delete editingTheme.value[key]
  await loadAll()
}

const newCriteriaLabel = ref('')
const newCriteriaMax = ref(5)

async function addCriteria(): Promise<void> {
  if (!newCriteriaLabel.value.trim() || !selectedPhaseId.value) return
  errorMsg.value = ''
  try {
    const res = await adminFetch('/api/presentation/criteria', {
      method: 'POST',
      body: JSON.stringify({
        phaseId: selectedPhaseId.value,
        label: newCriteriaLabel.value.trim(),
        maxPoints: newCriteriaMax.value
      })
    })
    if (!res.ok) throw new Error()
    newCriteriaLabel.value = ''
    newCriteriaMax.value = 5
    await loadAll()
  } catch {
    errorMsg.value = 'Falha ao criar o critério.'
  }
}

async function removeCriteria(id: string): Promise<void> {
  await adminFetch(`/api/presentation/criteria/${id}`, { method: 'DELETE' })
  await loadAll()
}

function teamName(id: string | null): string {
  if (!id) return '—'
  return teamsStore.teamById(id)?.name ?? '?'
}

function docFor(duplaId: string, teamId: string): DocumentInfo | undefined {
  return documentsMap.value[`${duplaId}:${teamId}`]
}

function extractOrderClient(filename: string, fallbackIndex: number): number {
  const match = filename.match(/(\d+)(?=\.[^.]*$)/)
  if (match) return Number(match[1])
  return 100000 + fallbackIndex
}

function onFilesSelected(duplaId: string, teamId: string, event: Event): void {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return

  const invalid = files.some((f) => f.type !== 'image/png' && f.type !== 'image/jpeg')
  if (invalid) {
    errorMsg.value = 'Só são aceites imagens PNG ou JPEG.'
    input.value = ''
    return
  }

  const indexed = files
    .map((file, i) => ({ file, order: extractOrderClient(file.name, i) }))
    .sort((a, b) => a.order - b.order)
    .map((x, i) => ({ file: x.file, order: i + 1, previewUrl: URL.createObjectURL(x.file) }))

  pendingByTeam.value[`${duplaId}:${teamId}`] = indexed
  input.value = ''
}

function movePending(key: string, index: number, direction: -1 | 1): void {
  const list = pendingByTeam.value[key]
  const target = index + direction
  if (!list || target < 0 || target >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(target, 0, item)
  list.forEach((s, i) => (s.order = i + 1))
}

function removePendingSlide(key: string, index: number): void {
  pendingByTeam.value[key]?.splice(index, 1)
}

async function confirmUpload(duplaId: string, teamId: string): Promise<void> {
  const key = `${duplaId}:${teamId}`
  const list = pendingByTeam.value[key]
  if (!list?.length) return
  errorMsg.value = ''
  uploadingKey.value = key
  try {
    const formData = new FormData()
    formData.append('duplaId', duplaId)
    formData.append('teamId', teamId)
    for (const s of list) {
      formData.append('files', s.file)
      formData.append('orders', String(s.order))
    }
    const res = await adminFetch('/api/presentation-documents', { method: 'POST', body: formData })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error)
    }
    delete pendingByTeam.value[key]
    await loadAll()
  } catch (e) {
    errorMsg.value = e instanceof Error && e.message ? e.message : 'Falha ao enviar as imagens.'
  } finally {
    uploadingKey.value = null
  }
}

async function removeDocument(id: string): Promise<void> {
  await adminFetch(`/api/presentation-documents/${id}`, { method: 'DELETE' })
  await loadAll()
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-2xl mx-auto w-full">
    <div class="bg-white rounded-2xl shadow p-4">
      <div class="flex items-center justify-between gap-3 mb-3">
        <h1 class="font-semibold text-petro-primary text-sm">Apresentações</h1>
        <button
          class="text-[11px] bg-petro-dark text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
          :disabled="refreshing"
          @click="manualRefresh"
        >
          {{ refreshing ? 'A atualizar...' : '↻ Atualizar' }}
        </button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <select v-model="selectedChampionship" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option v-for="opt in championshipOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <select v-model="selectedPhaseId" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" :disabled="!presentationPhases.length">
          <option v-for="p in presentationPhases" :key="p.id" :value="p.id">Fase {{ p.order }} · {{ p.label }}</option>
        </select>
      </div>
      <p v-if="!presentationPhases.length" class="text-xs text-amber-600 mt-2">
        Nenhuma fase deste campeonato está configurada como "Apresentação" ou "Apresentação + Quiz" — vai a
        Admin → Fases primeiro e muda o Tipo de Fase.
      </p>
    </div>

    <p v-if="errorMsg" class="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{{ errorMsg }}</p>

    <div v-if="selectedPhaseId" class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-2">Duplas, Temas e Documentos</h2>
      <p class="text-xs text-gray-400 mb-4">
        As duplas são geradas automaticamente ao criares o Chaveamento em Admin → Chaveamento. Aqui só editas o
        tema de cada equipa, e carregas os slides/critérios.
      </p>

      <div v-if="!duplas.length" class="text-xs text-gray-400">
        Nenhuma dupla ainda — gera o Chaveamento em Admin → Chaveamento para esta fase ficar preenchida
        automaticamente.
      </div>

      <div v-for="d in duplas" :key="d.id" class="border-b border-gray-50 py-3 last:border-0">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold">Dupla #{{ d.order }}</span>
        </div>

        <!-- Equipa A -->
        <div class="bg-gray-50 rounded-lg px-3 py-2 mb-2">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] text-gray-400">Tema:</span>
            <input
              :value="editingTheme[`${d.id}:A`] ?? d.themeA"
              @input="editingTheme[`${d.id}:A`] = ($event.target as HTMLInputElement).value"
              type="text"
              class="text-xs border border-gray-200 rounded px-2 py-1 flex-1"
            />
            <button
              v-if="editingTheme[`${d.id}:A`] !== undefined && editingTheme[`${d.id}:A`] !== d.themeA"
              class="text-[10px] text-petro-primary underline"
              @click="saveTheme(d.id, 'A')"
            >
              Guardar
            </button>
          </div>

          <div class="flex items-center justify-between gap-3">
            <span class="text-xs">{{ teamName(d.teamAId) }}</span>
            <div class="flex items-center gap-2">
              <span v-if="docFor(d.id, d.teamAId)" class="text-[10px] text-petro-primary bg-petro-primary/10 px-2 py-1 rounded-full">
                📄 {{ docFor(d.id, d.teamAId)!.slides.length }} slides
              </span>
              <button v-if="docFor(d.id, d.teamAId)" class="text-[10px] text-red-400 underline" @click="removeDocument(docFor(d.id, d.teamAId)!.id)">
                Remover
              </button>
              <label class="text-[10px] bg-petro-dark text-white px-2 py-1 rounded-lg cursor-pointer">
                Upload slides
                <input type="file" accept="image/png,image/jpeg" multiple class="hidden" @change="onFilesSelected(d.id, d.teamAId, $event)" />
              </label>
            </div>
          </div>

          <div v-if="pendingByTeam[`${d.id}:${d.teamAId}`]" class="mt-2 flex flex-wrap gap-2">
            <div
              v-for="(s, i) in pendingByTeam[`${d.id}:${d.teamAId}`]"
              :key="s.previewUrl"
              class="relative w-20 border border-gray-200 rounded-lg overflow-hidden bg-white"
            >
              <img :src="s.previewUrl" class="w-full h-14 object-cover" />
              <div class="flex items-center justify-between px-1 py-0.5 text-[9px] bg-gray-100">
                <span>#{{ s.order }}</span>
                <div class="flex gap-1">
                  <button @click="movePending(`${d.id}:${d.teamAId}`, i, -1)">◀</button>
                  <button @click="movePending(`${d.id}:${d.teamAId}`, i, 1)">▶</button>
                  <button class="text-red-500" @click="removePendingSlide(`${d.id}:${d.teamAId}`, i)">✕</button>
                </div>
              </div>
            </div>
            <button
              class="self-end bg-petro-primary text-white rounded-lg px-3 py-2 text-xs font-semibold"
              :disabled="uploadingKey === `${d.id}:${d.teamAId}`"
              @click="confirmUpload(d.id, d.teamAId)"
            >
              {{ uploadingKey === `${d.id}:${d.teamAId}` ? 'A enviar...' : 'Confirmar Ordem e Enviar' }}
            </button>
          </div>
        </div>

        <!-- Equipa B -->
        <div v-if="d.teamBId" class="bg-gray-50 rounded-lg px-3 py-2 mb-2">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] text-gray-400">Tema:</span>
            <input
              :value="editingTheme[`${d.id}:B`] ?? (d.themeB ?? '')"
              @input="editingTheme[`${d.id}:B`] = ($event.target as HTMLInputElement).value"
              type="text"
              class="text-xs border border-gray-200 rounded px-2 py-1 flex-1"
            />
            <button
              v-if="editingTheme[`${d.id}:B`] !== undefined && editingTheme[`${d.id}:B`] !== (d.themeB ?? '')"
              class="text-[10px] text-petro-primary underline"
              @click="saveTheme(d.id, 'B')"
            >
              Guardar
            </button>
          </div>

          <div class="flex items-center justify-between gap-3">
            <span class="text-xs">{{ teamName(d.teamBId) }}</span>
            <div class="flex items-center gap-2">
              <span v-if="docFor(d.id, d.teamBId)" class="text-[10px] text-petro-primary bg-petro-primary/10 px-2 py-1 rounded-full">
                📄 {{ docFor(d.id, d.teamBId)!.slides.length }} slides
              </span>
              <button v-if="docFor(d.id, d.teamBId)" class="text-[10px] text-red-400 underline" @click="removeDocument(docFor(d.id, d.teamBId)!.id)">
                Remover
              </button>
              <label class="text-[10px] bg-petro-dark text-white px-2 py-1 rounded-lg cursor-pointer">
                Upload slides
                <input type="file" accept="image/png,image/jpeg" multiple class="hidden" @change="onFilesSelected(d.id, d.teamBId!, $event)" />
              </label>
            </div>
          </div>

          <div v-if="pendingByTeam[`${d.id}:${d.teamBId}`]" class="mt-2 flex flex-wrap gap-2">
            <div
              v-for="(s, i) in pendingByTeam[`${d.id}:${d.teamBId}`]"
              :key="s.previewUrl"
              class="relative w-20 border border-gray-200 rounded-lg overflow-hidden bg-white"
            >
              <img :src="s.previewUrl" class="w-full h-14 object-cover" />
              <div class="flex items-center justify-between px-1 py-0.5 text-[9px] bg-gray-100">
                <span>#{{ s.order }}</span>
                <div class="flex gap-1">
                  <button @click="movePending(`${d.id}:${d.teamBId}`, i, -1)">◀</button>
                  <button @click="movePending(`${d.id}:${d.teamBId}`, i, 1)">▶</button>
                  <button class="text-red-500" @click="removePendingSlide(`${d.id}:${d.teamBId}`, i)">✕</button>
                </div>
              </div>
            </div>
            <button
              class="self-end bg-petro-primary text-white rounded-lg px-3 py-2 text-xs font-semibold"
              :disabled="uploadingKey === `${d.id}:${d.teamBId}`"
              @click="confirmUpload(d.id, d.teamBId!)"
            >
              {{ uploadingKey === `${d.id}:${d.teamBId}` ? 'A enviar...' : 'Confirmar Ordem e Enviar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedPhaseId" class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-1">Critérios de Avaliação</h2>
      <p class="text-xs text-gray-400 mb-4">Pontuação máxima total: {{ totalCriteriaPoints }} pts</p>
      <div class="grid grid-cols-3 gap-3 mb-3">
        <input v-model="newCriteriaLabel" type="text" placeholder="Nome do critério" class="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <input v-model.number="newCriteriaMax" type="number" min="1" placeholder="Nota máx." class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold mb-4" @click="addCriteria">
        Adicionar Critério
      </button>

      <div v-if="!criteria.length" class="text-xs text-gray-400">Nenhum critério cadastrado ainda.</div>
      <div v-for="c in criteria" :key="c.id" class="flex items-center justify-between gap-3 border-b border-gray-50 py-2 last:border-0">
        <span class="text-sm">{{ c.label }} <span class="text-petro-primary font-semibold">· {{ c.maxPoints }} pts</span></span>
        <button class="text-xs text-red-400 underline" @click="removeCriteria(c.id)">Remover</button>
      </div>
    </div>
  </div>
</template>
