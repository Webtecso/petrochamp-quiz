<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { usePhasesStore } from '../stores/phases'
import { useTeamsStore } from '../stores/teams'
import { getBackendUrl } from '../services/backendConfig'
import { adminFetch } from '../services/adminAuth'
import { connectSocket } from '../services/socket'
import { PowerPointViewer } from 'pptx-vue-viewer'
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
  fileUrl: string
  fileName: string
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

const previewOpenKey = ref<string | null>(null)
const previewContent = ref<Record<string, Uint8Array>>({})
const previewLoadingKey = ref<string | null>(null)
const previewErrorKey = ref<string | null>(null)

import type { ToolbarActionId } from 'pptx-vue-viewer'

const PREVIEW_HIDDEN_ACTIONS: ToolbarActionId[] = ['share', 'broadcast', 'insert', 'collaboration', 'edit', 'save', 'export', 'print']

const championshipOptions: { value: ChampionshipType; label: string }[] = [
  { value: 'universitario', label: 'Universitário' },
  { value: 'ensino_medio', label: 'Ensino Médio' },
  { value: 'exibicao', label: 'Exibição' }
]

const presentationPhases = computed(() =>
  phasesStore.phases.filter((p) => p.type === 'apresentacao' || p.type === 'apresentacao_quiz')
)

// A fase atualmente selecionada, para decidir se mostramos a secção de
// criação manual de duplas (só faz sentido em Apresentação sem
// eliminação - ver nota em routes/presentation.ts POST /duplas).
const selectedPhase = computed(() =>
  phasesStore.phases.find((p) => p.id === selectedPhaseId.value) ?? null
)

const canCreateManualDuplas = computed(
  () => selectedPhase.value?.type === 'apresentacao' && selectedPhase.value?.noElimination === true
)

const totalCriteriaPoints = computed(() => criteria.value.reduce((sum, c) => sum + c.maxPoints, 0))

// CORRIGIDO - antes filtrava só as equipas já usadas nesta fase (como
// Equipa A), mas não filtrava por categoria/campeonato. Isso fazia com
// que, ao selecionar por exemplo "Ensino Médio" no dropdown de cima,
// aparecessem no formulário também equipas de "Universitário" e
// "Exibição" - dados de campeonatos diferentes misturados no mesmo
// dropdown. Agora só entram equipas cuja `category` é igual ao
// `selectedChampionship` atualmente escolhido, exatamente como o
// fluxo automático (bracketLive.ts generate) já filtra por
// `category: championship` ao gerar o chaveamento - mantém os dois
// caminhos (manual e automático) consistentes entre si.
const teamsWithoutDupla = computed(() => {
  const usedAsA = new Set(duplas.value.map((d) => d.teamAId))
  return teamsStore.teams.filter(
    (t) => t.category === selectedChampionship.value && !usedAsA.has(t.id)
  )
})

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
    map[`${d.duplaId}:${d.teamId}`] = { id: d.id, fileUrl: d.fileUrl, fileName: d.fileName }
  }
  documentsMap.value = map
}

// Força uma sincronização com o Cloud (POST /api/sync/run) e só depois
// recarrega os dados desta view. Se o backend não tiver CLOUD_API_URL
// configurado, o sync simplesmente não corre (ran: false) e seguimos só
// com o refresh local - não é tratado como erro.
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
// ou 'phases', recarrega os dados desta view - assim não é preciso reabrir
// o app para ver o que mudou no outro lado (local ↔ cloud).
function onConfigUpdated(payload: { type: string; championship?: string | null }): void {
  if (payload.type === 'presentation' || payload.type === 'bracket' || payload.type === 'phases') {
    loadAll()
  }
}

onMounted(async () => {
  await teamsStore.fetchTeams()
  await loadPhases()
  // No build Admin Cloud, connectSocket() devolve null (o backend Cloud não
  // tem Socket.io por design) - o optional chaining evita que isso rebente.
  const socket = connectSocket()
  socket?.on('config:updated', onConfigUpdated)
})

onUnmounted(() => {
  const socket = connectSocket()
  socket?.off('config:updated', onConfigUpdated)
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

// Estado e ação para criação manual de duplas, só usado quando
// canCreateManualDuplas === true (fase Apresentação sem eliminação).
const newDuplaTeamAId = ref('')
const newDuplaTeamBId = ref('')
const newDuplaThemeA = ref('')
const newDuplaThemeB = ref('')
const creatingDupla = ref(false)

async function addManualDupla(): Promise<void> {
  if (!selectedPhaseId.value || !newDuplaTeamAId.value) return
  errorMsg.value = ''
  creatingDupla.value = true
  try {
    const res = await adminFetch('/api/presentation/duplas', {
      method: 'POST',
      body: JSON.stringify({
        phaseId: selectedPhaseId.value,
        teamAId: newDuplaTeamAId.value,
        teamBId: newDuplaTeamBId.value || null,
        themeA: newDuplaThemeA.value,
        themeB: newDuplaTeamBId.value ? newDuplaThemeB.value : null
      })
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Falha ao criar a dupla.')
    }
    newDuplaTeamAId.value = ''
    newDuplaTeamBId.value = ''
    newDuplaThemeA.value = ''
    newDuplaThemeB.value = ''
    await loadAll()
  } catch (e) {
    errorMsg.value = e instanceof Error && e.message ? e.message : 'Falha ao criar a dupla.'
  } finally {
    creatingDupla.value = false
  }
}

async function removeDupla(id: string): Promise<void> {
  await adminFetch(`/api/presentation/duplas/${id}`, { method: 'DELETE' })
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
  if (!id) return '-'
  return teamsStore.teamById(id)?.name ?? '?'
}

function docFor(duplaId: string, teamId: string): DocumentInfo | undefined {
  return documentsMap.value[`${duplaId}:${teamId}`]
}

async function togglePreview(duplaId: string, teamId: string): Promise<void> {
  const key = `${duplaId}:${teamId}`

  // já está aberto - fecha
  if (previewOpenKey.value === key) {
    previewOpenKey.value = null
    return
  }

  const doc = docFor(duplaId, teamId)
  if (!doc) return

  previewOpenKey.value = key
  previewErrorKey.value = null

  // já carregado antes (ex: reabrir) - não busca de novo
  if (previewContent.value[key]) return

  previewLoadingKey.value = key
  try {
    const res = await fetch(`${getBackendUrl()}${doc.fileUrl}`)
    if (!res.ok) throw new Error()
    previewContent.value[key] = new Uint8Array(await res.arrayBuffer())
  } catch {
    previewErrorKey.value = key
    previewOpenKey.value = null
  } finally {
    previewLoadingKey.value = null
  }
}

async function onPptxSelected(duplaId: string, teamId: string, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.name.toLowerCase().endsWith('.pptx')) {
    errorMsg.value = 'Só são aceites ficheiros .pptx.'
    input.value = ''
    return
  }

  const key = `${duplaId}:${teamId}`
  errorMsg.value = ''
  uploadingKey.value = key
  try {
    const formData = new FormData()
    formData.append('duplaId', duplaId)
    formData.append('teamId', teamId)
    formData.append('file', file)
    const res = await adminFetch('/api/presentation-documents', { method: 'POST', body: formData })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Falha ao enviar o ficheiro.')
    }
    delete previewContent.value[key]
    if (previewOpenKey.value === key) previewOpenKey.value = null
    await loadAll()
  } catch (e) {
    errorMsg.value = e instanceof Error && e.message ? e.message : 'Falha ao enviar o ficheiro.'
  } finally {
    uploadingKey.value = null
    input.value = ''
  }
}

async function removeDocument(id: string, duplaId: string, teamId: string): Promise<void> {
  const key = `${duplaId}:${teamId}`
  delete previewContent.value[key]
  if (previewOpenKey.value === key) previewOpenKey.value = null
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
        Nenhuma fase deste campeonato está configurada como "Apresentação" ou "Apresentação + Quiz" - vai a
        Admin → Fases primeiro e muda o Tipo de Fase.
      </p>
    </div>

    <p v-if="errorMsg" class="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{{ errorMsg }}</p>

    <!--
      Secção de criação manual de duplas. Só aparece quando a fase
      selecionada é do tipo "apresentacao" com noElimination === true,
      porque só essas fases ficam fora da geração automática via
      chaveamento (ver comentário em routes/presentation.ts POST /duplas).
      Nas restantes fases (apresentacao_quiz, ou apresentacao ligada a
      bracket), esta secção fica escondida e nada muda em relação ao
      comportamento anterior. Os dropdowns já herdam o filtro por
      categoria via teamsWithoutDupla (ver correção acima).
    -->
    <div v-if="selectedPhaseId && canCreateManualDuplas" class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-1">Criar Dupla Manualmente</h2>
      <p class="text-xs text-gray-400 mb-4">
        Esta fase é "Apresentação sem eliminação" - não está ligada a um Chaveamento, por isso as duplas têm de
        ser criadas aqui manualmente. Só aparecem equipas da categoria "{{ championshipOptions.find(o => o.value === selectedChampionship)?.label }}". A Equipa B é opcional (deixa em branco para uma apresentação individual).
      </p>

      <div class="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label class="text-[10px] text-gray-400 block mb-1">Equipa A</label>
          <select v-model="newDuplaTeamAId" class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full">
            <option value="" disabled>Selecionar equipa...</option>
            <option v-for="t in teamsWithoutDupla" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </div>
        <div>
          <label class="text-[10px] text-gray-400 block mb-1">Equipa B (opcional)</label>
          <select v-model="newDuplaTeamBId" class="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full">
            <option value="">- Nenhuma -</option>
            <option
              v-for="t in teamsWithoutDupla.filter((x) => x.id !== newDuplaTeamAId)"
              :key="t.id"
              :value="t.id"
            >
              {{ t.name }}
            </option>
          </select>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 mb-4">
        <input
          v-model="newDuplaThemeA"
          type="text"
          placeholder="Tema da Equipa A (opcional)"
          class="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <input
          v-if="newDuplaTeamBId"
          v-model="newDuplaThemeB"
          type="text"
          placeholder="Tema da Equipa B (opcional)"
          class="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <button
        class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
        :disabled="!newDuplaTeamAId || creatingDupla"
        @click="addManualDupla"
      >
        {{ creatingDupla ? 'A criar...' : 'Adicionar Dupla' }}
      </button>
    </div>

    <div v-if="selectedPhaseId" class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-2">Duplas, Temas e Documentos</h2>
      <p class="text-xs text-gray-400 mb-4">
        <template v-if="canCreateManualDuplas">
          Duplas criadas manualmente acima. Aqui editas o tema de cada equipa, carregas o ficheiro .pptx/critérios, ou
          removes uma dupla.
        </template>
        <template v-else>
          As duplas são geradas automaticamente ao criares o Chaveamento em Admin → Chaveamento. Aqui só editas o
          tema de cada equipa, e carregas o ficheiro .pptx/critérios.
        </template>
      </p>

      <div v-if="!duplas.length" class="text-xs text-gray-400">
        <template v-if="canCreateManualDuplas">Nenhuma dupla ainda - usa o formulário acima para criar.</template>
        <template v-else>
          Nenhuma dupla ainda - gera o Chaveamento em Admin → Chaveamento para esta fase ficar preenchida
          automaticamente.
        </template>
      </div>

      <div v-for="d in duplas" :key="d.id" class="border-b border-gray-50 py-3 last:border-0">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold">Dupla #{{ d.order }}</span>
          <button
            v-if="canCreateManualDuplas"
            class="text-[10px] text-red-400 underline"
            @click="removeDupla(d.id)"
          >
            Remover Dupla
          </button>
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
                📄 {{ docFor(d.id, d.teamAId)!.fileName }}
              </span>
              <button
                v-if="docFor(d.id, d.teamAId)"
                class="text-[10px] text-petro-primary underline"
                @click="togglePreview(d.id, d.teamAId)"
              >
                {{ previewOpenKey === `${d.id}:${d.teamAId}` ? 'Fechar' : 'Pré-visualizar' }}
              </button>
              <button v-if="docFor(d.id, d.teamAId)" class="text-[10px] text-red-400 underline" @click="removeDocument(docFor(d.id, d.teamAId)!.id, d.id, d.teamAId)">
                Remover
              </button>
              <label class="text-[10px] bg-petro-dark text-white px-2 py-1 rounded-lg cursor-pointer">
                {{ uploadingKey === `${d.id}:${d.teamAId}` ? 'A enviar...' : 'Upload .pptx' }}
                <input type="file" accept=".pptx" class="hidden" @change="onPptxSelected(d.id, d.teamAId, $event)" />
              </label>
            </div>
          </div>
        </div>

        <!-- Pré-visualização Equipa A -->
        <div v-if="previewOpenKey === `${d.id}:${d.teamAId}`" class="bg-white border-2 border-petro-primary/20 rounded-lg p-4 mb-2">
          <div v-if="previewLoadingKey === `${d.id}:${d.teamAId}`" class="bg-gray-100 rounded-lg h-96 flex items-center justify-center text-sm text-gray-500">
            A carregar pré-visualização...
          </div>
          <div v-else-if="previewErrorKey === `${d.id}:${d.teamAId}`" class="bg-red-50 rounded-lg p-4 text-center text-sm text-red-600">
            Falha ao carregar o ficheiro.
          </div>
          <PowerPointViewer
            v-else-if="previewContent[`${d.id}:${d.teamAId}`]"
            :content="previewContent[`${d.id}:${d.teamAId}`]"
            :can-edit="false"
            :hidden-actions="PREVIEW_HIDDEN_ACTIONS"
            style="height: 45vh"
            class="rounded-lg overflow-hidden"
          />
        </div>

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
                📄 {{ docFor(d.id, d.teamBId)!.fileName }}
              </span>
              <button
                v-if="docFor(d.id, d.teamBId)"
                class="text-[10px] text-petro-primary underline"
                @click="togglePreview(d.id, d.teamBId!)"
              >
                {{ previewOpenKey === `${d.id}:${d.teamBId}` ? 'Fechar' : 'Pré-visualizar' }}
              </button>
              <button v-if="docFor(d.id, d.teamBId)" class="text-[10px] text-red-400 underline" @click="removeDocument(docFor(d.id, d.teamBId)!.id, d.id, d.teamBId!)">
                Remover
              </button>
              <label class="text-[10px] bg-petro-dark text-white px-2 py-1 rounded-lg cursor-pointer">
                {{ uploadingKey === `${d.id}:${d.teamBId}` ? 'A enviar...' : 'Upload .pptx' }}
                <input type="file" accept=".pptx" class="hidden" @change="onPptxSelected(d.id, d.teamBId!, $event)" />
              </label>
            </div>
          </div>

          <!-- Pré-visualização Equipa B -->
          <div v-if="previewOpenKey === `${d.id}:${d.teamBId}`" class="bg-white border-2 border-petro-primary/20 rounded-lg p-4 mt-2">
            <div v-if="previewLoadingKey === `${d.id}:${d.teamBId}`" class="bg-gray-100 rounded-lg h-96 flex items-center justify-center text-sm text-gray-500">
              A carregar pré-visualização...
            </div>
            <div v-else-if="previewErrorKey === `${d.id}:${d.teamBId}`" class="bg-red-50 rounded-lg p-4 text-center text-sm text-red-600">
              Falha ao carregar o ficheiro.
            </div>
            <PowerPointViewer
              v-else-if="previewContent[`${d.id}:${d.teamBId}`]"
              :content="previewContent[`${d.id}:${d.teamBId}`]"
              :can-edit="false"
              :hidden-actions="PREVIEW_HIDDEN_ACTIONS"
              style="height: 45vh"
              class="rounded-lg overflow-hidden"
            />
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