<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Capacitor } from '@capacitor/core'
import { useCampeonatoStore, type ChampionshipType } from '../stores/campeonato'
import { usePhasesStore } from '../stores/phases'
import { getBracketFor } from '../data/bracket'
import { api } from '../services/api'

const router = useRouter()
const store = useCampeonatoStore()
const phasesStore = usePhasesStore()
const editionName = ref('')
const triedWithoutName = ref(false)
const phaseCounts = ref<Record<ChampionshipType, number>>({
  universitario: 0,
  ensino_medio: 0,
  exibicao: 0
})

onMounted(async () => {
  const types: ChampionshipType[] = ['universitario', 'ensino_medio', 'exibicao']
  await Promise.all(
    types.map(async (t) => {
      const phases = await api.get<unknown[]>(`/phases?championship=${t}`)
      phaseCounts.value[t] = phases.length
    })
  )
})

const options: { type: ChampionshipType; title: string; subtitle: string }[] = [
  { type: 'universitario', title: 'Campeonato Universitário', subtitle: 'Equipas de universidades' },
  { type: 'ensino_medio', title: 'Campeonato Ensino Médio', subtitle: 'Equipas de escolas' },
  { type: 'exibicao', title: 'Batalha de Exibição', subtitle: 'Demonstração pública' }
]

const hasEditionName = computed(() => editionName.value.trim().length > 0)

async function choose(type: ChampionshipType): Promise<void> {
  if (!hasEditionName.value) {
    triedWithoutName.value = true
    return
  }
  if (phaseCounts.value[type] === 0) return
  await store.selectChampionship(type, editionName.value.trim())
  await phasesStore.fetchPhases(type)

  const firstPhase = phasesStore.phases.find((p) => p.order === 1)
  if (firstPhase?.type === 'apresentacao' || firstPhase?.type === 'apresentacao_quiz') {
    router.push('/moderador/apresentacao')
    return
  }

  const hasBracket = !!getBracketFor(type)
  const isTabletOrPhone = Capacitor.isNativePlatform()
  if (isTabletOrPhone && hasBracket) {
    router.push('/moderador/chaveamento')
  } else {
    router.push('/moderador/equipas')
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center px-10 py-12 gap-8">
    <h1 class="text-2xl font-bold text-petro-primary">Escolha o Campeonato</h1>

    <div class="w-full max-w-sm">
      <label class="text-xs text-gray-500 block mb-1">
        Nome da Edição <span class="text-red-500">*</span>
      </label>
      <input
        v-model="editionName"
        type="text"
        placeholder="Ex: Petrochamp Universitário 2026"
        class="w-full border rounded-lg px-3 py-2 text-sm text-center"
        :class="triedWithoutName && !hasEditionName ? 'border-red-400' : 'border-gray-200'"
        @input="triedWithoutName = false"
      />
      <p v-if="triedWithoutName && !hasEditionName" class="text-xs text-red-500 mt-1">
        Escreve o nome da edição antes de escolheres o campeonato - fica gravado no histórico.
      </p>
    </div>

    <div class="grid grid-cols-3 gap-6 w-full max-w-3xl">
      <div v-for="opt in options" :key="opt.type" class="flex flex-col gap-2">
        <button
          class="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-3 border-2 border-transparent transition text-center"
          :class="hasEditionName && phaseCounts[opt.type] > 0 ? 'hover:border-petro-primary hover:scale-[1.02]' : 'opacity-50 cursor-not-allowed'"
          @click="choose(opt.type)"
        >
          <div class="w-14 h-14 rounded-full bg-petro-primary/10 flex items-center justify-center text-petro-primary font-bold text-xl">
            {{ opt.title.charAt(0) }}
          </div>
          <div class="font-semibold">{{ opt.title }}</div>
          <div class="text-xs text-gray-400">{{ opt.subtitle }}</div>
        </button>
        <RouterLink
          v-if="phaseCounts[opt.type] === 0"
          to="/admin/fases"
          class="text-[11px] text-amber-600 underline text-center"
        >
          Sem fases configuradas - ir ao Admin
        </RouterLink>
      </div>
    </div>
  </div>
</template>
