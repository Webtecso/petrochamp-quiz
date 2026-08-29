<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getBackendUrl } from '../services/backendConfig'

interface RepescagemConfig {
  id: number
  championship: string
  phase: number
  maxRepescados: number
  votingDurationSeconds: number
  started: boolean
}

const championship = ref<'universitario' | 'ensino_medio' | 'exibicao'>('universitario')
const phase = ref(1)
const maxRepescados = ref(2)
const votingDurationSeconds = ref(60)
const configs = ref<RepescagemConfig[]>([])
const errorMsg = ref('')

async function loadConfigs(): Promise<void> {
  const res = await fetch(`${getBackendUrl()}/api/repescagem/configs?championship=${championship.value}`)
  configs.value = await res.json()
}

onMounted(loadConfigs)

async function createConfig(): Promise<void> {
  errorMsg.value = ''
  try {
    const res = await fetch(`${getBackendUrl()}/api/repescagem/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        championship: championship.value,
        phase: phase.value,
        maxRepescados: maxRepescados.value,
        votingDurationSeconds: votingDurationSeconds.value
      })
    })
    if (!res.ok) throw new Error()
    await loadConfigs()
  } catch {
    errorMsg.value = 'Falha ao criar a configuração de repescagem.'
  }
}

async function removeConfig(id: number): Promise<void> {
  errorMsg.value = ''
  try {
    const res = await fetch(`${getBackendUrl()}/api/repescagem/config/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error)
    }
    await loadConfigs()
  } catch (e) {
    errorMsg.value = e instanceof Error && e.message ? e.message : 'Falha ao remover a configuração.'
  }
}

const championshipLabels: Record<string, string> = {
  universitario: 'Universitário',
  ensino_medio: 'Ensino Médio',
  exibicao: 'Exibição'
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-2xl mx-auto w-full">
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
      Aqui só configuras a repescagem com antecedência. Abrir a votação, acompanhar os votos, gerar o
      chaveamento e inserir a campeã de volta é tudo feito pelo Moderador, na altura certa - depois da fase
      terminar de verdade.
    </div>

    <p v-if="errorMsg" class="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{{ errorMsg }}</p>

    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">Nova Configuração de Repescagem</h2>
      <div class="grid grid-cols-2 gap-3 mb-3">
        <select v-model="championship" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" @change="loadConfigs">
          <option value="universitario">Universitário</option>
          <option value="ensino_medio">Ensino Médio</option>
          <option value="exibicao">Exibição</option>
        </select>
        <input v-model.number="phase" type="number" min="1" placeholder="Nº da fase eliminada" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label class="text-xs text-gray-500 block mb-1">Equipas a repescar</label>
          <input v-model.number="maxRepescados" type="number" min="1" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="text-xs text-gray-500 block mb-1">Duração da votação (segundos)</label>
          <input v-model.number="votingDurationSeconds" type="number" min="10" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold" @click="createConfig">
        Criar Configuração
      </button>
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h3 class="font-semibold text-sm text-gray-600 mb-3">Configurações - {{ championshipLabels[championship] }}</h3>
      <div v-if="!configs.length" class="text-xs text-gray-400">Nenhuma configuração criada ainda.</div>
      <div v-for="c in configs" :key="c.id" class="flex items-center justify-between gap-3 border-b border-gray-50 py-3 last:border-0">
        <div class="text-sm">
          Fase {{ c.phase }} · repescar {{ c.maxRepescados }} · {{ c.votingDurationSeconds }}s de votação
          <span
            class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
            :class="c.started ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
          >
            {{ c.started ? 'JÁ INICIADA' : 'POR INICIAR' }}
          </span>
        </div>
        <button v-if="!c.started" class="text-xs text-red-400 underline" @click="removeConfig(c.id)">Apagar</button>
      </div>
    </div>
  </div>
</template>
