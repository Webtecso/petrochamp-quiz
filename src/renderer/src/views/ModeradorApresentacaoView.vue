<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCampeonatoStore } from '../stores/campeonato'
import { useJuradosStore } from '../stores/jurados'
import { usePhasesStore } from '../stores/phases'
import { useTeamsStore } from '../stores/teams'
import { getBackendUrl } from '../services/backendConfig'
import { PowerPointViewer, type PowerPointViewerExpose } from 'pptx-vue-viewer'

interface Dupla {
  id: number
  order: number
  themeA: string
  themeB: string | null
  teamAId: string
  teamBId: string | null
}

interface DocumentInfo {
  id: number
  fileUrl: string
  fileName: string
}

const router = useRouter()
const store = useCampeonatoStore()
const jurados = useJuradosStore()
const phasesStore = usePhasesStore()
const teamsStore = useTeamsStore()

if (!store.championship) {
  router.replace('/moderador/campeonato')
}

const duplas = ref<Dupla[]>([])
const documentsMap = ref<Record<string, DocumentInfo>>({})

const viewerContent = ref<Uint8Array | undefined>(undefined)
const viewerRef = ref<PowerPointViewerExpose>()
const viewerLoading = ref(false)

// Ações do viewer só podem ser feitas via ribbon reduzida - o moderador
// nunca deve editar, partilhar ou exportar o ficheiro a partir daqui.
const VIEWER_HIDDEN_ACTIONS = ['share', 'broadcast', 'insert', 'collaboration', 'edit', 'save', 'export', 'print'] as const

const currentPhaseRecord = computed(() => phasesStore.phases.find((p) => p.order === store.phase))
const isPresentationPhase = computed(
  () => currentPhaseRecord.value?.type === 'apresentacao' || currentPhaseRecord.value?.type === 'apresentacao_quiz'
)
const isCompositePhase = computed(() => currentPhaseRecord.value?.type === 'apresentacao_quiz')

async function loadDuplas(): Promise<void> {
  if (!currentPhaseRecord.value) {
    duplas.value = []
    return
  }
  const res = await fetch(`${getBackendUrl()}/api/presentation/duplas?phaseId=${currentPhaseRecord.value.id}`)
  duplas.value = await res.json()
}

async function loadDocuments(): Promise<void> {
  if (!currentPhaseRecord.value) {
    documentsMap.value = {}
    return
  }
  const res = await fetch(`${getBackendUrl()}/api/presentation-documents?phaseId=${currentPhaseRecord.value.id}`)
  const docs: (DocumentInfo & { duplaId: number; teamId: string })[] = await res.json()
  const map: Record<string, DocumentInfo> = {}
  for (const d of docs) {
    map[`${d.duplaId}:${d.teamId}`] = { id: d.id, fileUrl: d.fileUrl, fileName: d.fileName }
  }
  documentsMap.value = map
}

onMounted(async () => {
  await phasesStore.fetchPhases(store.championship ?? undefined)
  await teamsStore.fetchTeams()
  jurados.listenToServer()
  await loadDuplas()
  await loadDocuments()
})

watch(currentPhaseRecord, async () => {
  await loadDuplas()
  await loadDocuments()
})

function teamName(id: string): string {
  return teamsStore.teamById(id)?.name ?? '?'
}

function docFor(duplaId: number, teamId: string): DocumentInfo | undefined {
  return documentsMap.value[`${duplaId}:${teamId}`]
}

async function loadPptxContent(fileUrl: string): Promise<void> {
  viewerLoading.value = true
  viewerContent.value = undefined
  try {
    const res = await fetch(`${getBackendUrl()}${fileUrl}`)
    viewerContent.value = new Uint8Array(await res.arrayBuffer())
  } finally {
    viewerLoading.value = false
  }
}

const activeDocument = computed(() => {
  if (!store.presentationFlow.duplaId || !store.presentationFlow.teamId) return undefined
  return docFor(store.presentationFlow.duplaId, store.presentationFlow.teamId)
})

// Sempre que entra em apresentação com documento, carrega o .pptx.
watch(
  () => [store.presentationFlow.stage, activeDocument.value?.id] as const,
  async ([stage]) => {
    if (
      stage === 'presenting' &&
      store.presentationFlow.presentationMode === 'document' &&
      activeDocument.value
    ) {
      await loadPptxContent(activeDocument.value.fileUrl)
    }
  },
  { immediate: true }
)

// Liga o modo de apresentação (animações/transições nativas) assim que o
// viewer estiver montado com conteúdo carregado.
function onViewerMounted(): void {
  viewerRef.value?.setMode('present')
}

// A fonte de verdade do slide atual é o backend (currentPage via socket,
// distribuído a todos os ecrãs por state:sync). Este watcher reage a
// QUALQUER mudança - vinda do próprio moderador ou de outro ecrã - e
// manda o viewer local saltar/animar até lá.
watch(
  () => store.presentationFlow.currentPage,
  (page) => {
    if (viewerRef.value && viewerContent.value) {
      viewerRef.value.goTo(page - 1)
    }
  }
)

// Rede de segurança: se alguém navegar dentro do próprio widget (thumbnail,
// atalho de teclado) sem passar pelo socket, repõe o slide oficial - assim
// este ecrã nunca fica dessincronizado do telão/jurados.
function onActiveSlideChange(index: number): void {
  const expected = store.presentationFlow.currentPage - 1
  if (index !== expected) {
    viewerRef.value?.goTo(expected)
  }
}

function requestNextPage(): void {
  const total = viewerRef.value?.getSlideCount() ?? Infinity
  if (store.presentationFlow.currentPage >= total) return
  store.nextPresentationPage()
}

function requestPrevPage(): void {
  if (store.presentationFlow.currentPage <= 1) return
  store.prevPresentationPage()
}

const availableItems = computed(() => {
  const list: { duplaId: number; teamId: string; theme: string }[] = []
  for (const d of duplas.value) {
    if (!store.presentationFlow.presentedTeamIds.includes(d.teamAId)) {
      list.push({ duplaId: d.id, teamId: d.teamAId, theme: d.themeA })
    }
    if (d.teamBId && !store.presentationFlow.presentedTeamIds.includes(d.teamBId)) {
      list.push({ duplaId: d.id, teamId: d.teamBId, theme: d.themeB ?? d.themeA })
    }
  }
  return list
})

const allPresented = computed(
  () => duplas.value.length > 0 && availableItems.value.length === 0 && store.presentationFlow.stage === 'idle'
)

const pendingSelection = ref<{ duplaId: number; teamId: string; theme: string } | null>(null)

function selectTeam(item: { duplaId: number; teamId: string; theme: string }): void {
  pendingSelection.value = item
}

function cancelSelection(): void {
  pendingSelection.value = null
}

const pendingDocument = computed(() => {
  if (!pendingSelection.value) return undefined
  return docFor(pendingSelection.value.duplaId, pendingSelection.value.teamId)
})

function confirmStart(useDocument: boolean): void {
  if (!pendingSelection.value) return
  store.startPresentation(pendingSelection.value.duplaId, pendingSelection.value.teamId, useDocument)
  pendingSelection.value = null
}

const minutes = computed(() => Math.floor(store.presentationFlow.timeLeft / 60))
const seconds = computed(() => store.presentationFlow.timeLeft % 60)

function finishPresentation(): void {
  if (store.presentationFlow.timeLeft > 0) return
  store.finishPresentation()
}

function advanceNext(): void {
  if (!store.presentationFlow.allJurorsSubmitted) return
  store.advanceToNextPresentation()
}

function goNext(): void {
  if (isCompositePhase.value) {
    store.confirmQuizIntro()
  } else {
    store.confirmPresentationRanking()
  }
  router.push('/moderador/equipas')
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center px-10 py-12 gap-6">
    <h1 class="text-2xl font-bold text-petro-primary">Apresentação de Projetos - Fase {{ store.phase }}</h1>

    <div v-if="!isPresentationPhase" class="bg-white rounded-2xl shadow p-6 max-w-md text-center">
      <p class="text-sm text-gray-500">
        A Fase {{ store.phase }} não está configurada como Apresentação de Projetos.
      </p>
    </div>

    <template v-else>
      <!-- Nenhuma apresentação em curso: escolher a próxima, ou painel de decisão -->
      <div v-if="store.presentationFlow.stage === 'idle'" class="bg-white rounded-2xl shadow p-6 w-full max-w-lg">
        <div v-if="allPresented" class="text-center flex flex-col gap-3">
          <div class="text-3xl">✅</div>
          <p class="text-sm text-gray-600">
            {{ isCompositePhase
              ? 'Todas as equipas apresentaram e foram avaliadas. Agora é a vez do Quiz desta fase.'
              : 'Todas as equipas já apresentaram nesta fase.' }}
          </p>
          <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold self-center" @click="goNext">
            {{ isCompositePhase ? 'Ir para Escolha de Equipas (Quiz)' : 'Ir para o Ranking' }}
          </button>
        </div>

        <!-- Painel de decisão: com ou sem documento -->
        <div v-else-if="pendingSelection" class="flex flex-col gap-4 text-center">
          <h2 class="text-lg font-bold text-petro-primary">Iniciar Apresentação</h2>
          <div class="text-sm">
            <p class="font-semibold">{{ teamName(pendingSelection.teamId) }}</p>
            <p class="text-gray-400">Tema: {{ pendingSelection.theme }}</p>
          </div>

          <div v-if="pendingDocument" class="bg-petro-primary/5 border border-petro-primary/20 rounded-xl px-4 py-3 text-sm">
            📄 {{ pendingDocument.fileName }}
          </div>
          <p v-else class="text-xs text-gray-400">Documento não carregado</p>

          <div class="flex flex-col gap-2">
            <button
              v-if="pendingDocument"
              class="bg-petro-primary text-white rounded-lg px-4 py-3 text-sm font-semibold"
              @click="confirmStart(true)"
            >
              📄 Apresentar com Documento
            </button>
            <button
              class="bg-petro-dark text-white rounded-lg px-4 py-3 text-sm font-semibold"
              @click="confirmStart(false)"
            >
              ▶️ {{ pendingDocument ? 'Apresentar sem Documento' : 'Iniciar Apresentação' }}
            </button>
            <button class="text-xs text-gray-400 underline mt-1" @click="cancelSelection">Cancelar</button>
          </div>
        </div>

        <div v-else class="flex flex-col gap-3">
          <p class="text-sm text-gray-500 text-center mb-2">Escolhe a próxima equipa a apresentar:</p>
          <button
            v-for="item in availableItems"
            :key="item.teamId"
            class="bg-petro-primary/5 hover:bg-petro-primary/10 border border-petro-primary/20 rounded-xl px-4 py-3 text-left transition"
            @click="selectTeam(item)"
          >
            <div class="font-semibold text-sm">{{ teamName(item.teamId) }}</div>
            <div class="text-xs text-gray-400">
              Tema: {{ item.theme }}
              <span v-if="docFor(item.duplaId, item.teamId)" class="text-petro-primary"> · 📄 com documento</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Contagem regressiva antes de começar -->
      <div v-else-if="store.presentationFlow.stage === 'countdown'" class="bg-white rounded-2xl shadow p-6 w-full max-w-lg text-center">
        <p class="text-sm text-gray-500 mb-2">A preparar a apresentação de</p>
        <p class="text-lg font-bold text-petro-primary mb-4">{{ store.presentationFlow.teamName }}</p>
        <div class="text-5xl font-black text-petro-primary">{{ store.countdown.value }}</div>
      </div>

      <!-- Em apresentação -->
      <div v-else-if="store.presentationFlow.stage === 'presenting'" class="bg-white rounded-2xl shadow p-6 w-full max-w-lg text-center">
        <p class="text-sm text-gray-500 mb-1">Em apresentação</p>
        <p class="text-lg font-bold text-petro-primary mb-1">{{ store.presentationFlow.teamName }}</p>
        <p class="text-sm text-gray-500 mb-4">Tema: {{ store.presentationFlow.theme }}</p>

        <!-- Viewer do .pptx -->
        <div v-if="store.presentationFlow.presentationMode === 'document'" class="mb-4">
          <div v-if="viewerLoading" class="bg-gray-100 rounded-lg h-96 flex items-center justify-center text-sm text-gray-500">
            A carregar apresentação...
          </div>
          <PowerPointViewer
            v-else-if="viewerContent"
            ref="viewerRef"
            :content="viewerContent"
            :can-edit="false"
            :hidden-actions="VIEWER_HIDDEN_ACTIONS"
            style="height: 55vh"
            class="rounded-lg overflow-hidden"
            @vue:mounted="onViewerMounted"
            @active-slide-change="onActiveSlideChange"
          />
        </div>

        <!-- Controlos de página/slide, só em modo documento -->
        <div v-if="store.presentationFlow.presentationMode === 'document'" class="flex items-center justify-center gap-4 mb-4">
          <button
            class="bg-petro-dark text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
            :disabled="store.presentationFlow.currentPage <= 1"
            @click="requestPrevPage()"
          >
            ◀ Anterior
          </button>
          <span class="text-sm font-semibold text-gray-600">
            Slide {{ store.presentationFlow.currentPage }} / {{ viewerRef?.getSlideCount() ?? '?' }}
          </span>
          <button
            class="bg-petro-dark text-white rounded-lg px-4 py-2 text-sm font-semibold"
            @click="requestNextPage()"
          >
            Próxima ▶
          </button>
        </div>

        <div class="text-6xl font-black text-petro-primary mb-6">
          {{ String(minutes).padStart(2, '0') }}:{{ String(seconds).padStart(2, '0') }}
        </div>
        <button
          class="bg-amber-500 text-white rounded-lg px-6 py-3 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="store.presentationFlow.timeLeft > 0"
          @click="finishPresentation"
        >
          Finalizar Apresentação
        </button>
      </div>

      <!-- Concluída - à espera dos jurados, ou já com resultado -->
      <div v-else-if="store.presentationFlow.stage === 'concluded'" class="bg-white rounded-2xl shadow p-6 w-full max-w-lg text-center">
        <p class="text-sm text-gray-500 mb-1">Apresentação concluída</p>
        <p class="text-lg font-bold text-petro-primary mb-4">{{ store.presentationFlow.teamName }}</p>

        <div v-if="!store.presentationFlow.allJurorsSubmitted" class="flex flex-col gap-2">
          <p class="text-sm text-gray-500">A aguardar avaliação dos jurados...</p>
          <p class="text-xs text-gray-400">
            {{ store.presentationFlow.jurorsSubmitted.length }} de {{ store.expectedJurorCount }} jurados já submeteram
          </p>
        </div>
        <div v-else class="flex flex-col gap-3">
          <p class="text-green-600 text-sm font-semibold">Avaliação concluída ✓</p>
          <button
            v-if="store.presentationRoundReady"
            class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold self-center"
            @click="goNext"
          >
            Ir para o Ranking
          </button>
          <button v-else class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold self-center" @click="advanceNext">
            Avançar
          </button>
        </div>
      </div>
    </template>
  </div>
</template>