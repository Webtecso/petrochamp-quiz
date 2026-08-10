<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useLiveBracketStore } from '../stores/liveBracket'

const liveBracketStore = useLiveBracketStore()
const championship = ref<'universitario' | 'ensino_medio' | 'exibicao'>('universitario')
const generating = ref(false)
const clearing = ref(false)

onMounted(() => liveBracketStore.fetchBracket(championship.value))
watch(championship, (val) => liveBracketStore.fetchBracket(val))

async function generate(): Promise<void> {
  generating.value = true
  await liveBracketStore.generate(championship.value)
  generating.value = false
}

// NOVO
async function clearBracket(): Promise<void> {
  const ok = confirm('Eliminar chaveamento? Esta ação irá remover o chaveamento atual. Deseja continuar?')
  if (!ok) return
  clearing.value = true
  await liveBracketStore.clearBracket(championship.value)
  clearing.value = false
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-3xl mx-auto w-full">
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
      Gerar o chaveamento cria os confrontos a partir das equipas cadastradas (usa Grupo/Posição, se definidos).
      Gerar de novo substitui qualquer chaveamento anterior desta categoria.
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">Chaveamento ao Vivo</h2>
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <select v-model="championship" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="universitario">Universitário</option>
          <option value="ensino_medio">Ensino Médio</option>
          <option value="exibicao">Exibição</option>
        </select>
        <button
          class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          :disabled="generating"
          @click="generate"
        >
          {{ generating ? 'A gerar...' : 'Gerar Chaveamento' }}
        </button>
        <button
          class="bg-red-500 text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          :disabled="clearing || !liveBracketStore.matches.length"
          @click="clearBracket"
        >
          {{ clearing ? 'A eliminar...' : '🗑 Eliminar Chaveamento' }}
        </button>
      </div>

      <div v-if="!liveBracketStore.matches.length" class="text-xs text-gray-400">
        Nenhum chaveamento gerado ainda para esta categoria.
      </div>

      <div v-else class="flex flex-col gap-4">
        <div v-for="round in liveBracketStore.totalRounds" :key="round">
          <h3 class="text-xs font-semibold text-gray-500 uppercase mb-2">Ronda {{ round }}</h3>
          <div class="flex flex-col gap-2">
            <div
              v-for="m in liveBracketStore.matches.filter((x) => x.round === round)"
              :key="m.id"
              class="border border-gray-100 rounded-xl px-4 py-2 flex items-center justify-between text-sm"
            >
              <span :class="m.winnerId === m.teamA?.id ? 'font-bold text-petro-primary' : ''">{{ m.teamA?.name ?? '?' }}</span>
              <span class="text-gray-300 text-xs">vs</span>
              <span :class="m.winnerId === m.teamB?.id ? 'font-bold text-petro-primary' : ''">{{ m.teamB?.name ?? '?' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
