<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()

const category = ref<'universitario' | 'ensino_medio' | 'exibicao'>('universitario')
const soundEnabled = ref(true)
const saved = ref(false)

function saveSettings(): void {
  saved.value = true
  setTimeout(() => {
    saved.value = false
  }, 2000)
}
</script>

<template>
  <div class="flex-1 px-10 py-8">
    <h1 class="text-2xl font-bold text-petro-primary mb-6 text-center">Configurações</h1>

    <div class="max-w-md mx-auto bg-white rounded-xl shadow p-6 flex flex-col gap-6">
      <div>
        <label class="text-sm font-semibold text-gray-600 block mb-2">Tempo por pergunta (segundos)</label>
        <input
          :value="settings.questionTimeSeconds"
          type="number"
          min="5"
          max="120"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-petro-primary"
          @change="settings.setQuestionTime(Number(($event.target as HTMLInputElement).value))"
        />
        <p class="text-xs text-gray-400 mt-1">Também disponível, com mais opções, no Painel do Administrador.</p>
      </div>

      <div>
        <label class="text-sm font-semibold text-gray-600 block mb-2">Categoria do campeonato</label>
        <select
          v-model="category"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-petro-primary"
        >
          <option value="universitario">Campeonato Universitário</option>
          <option value="ensino_medio">Campeonato Ensino Médio</option>
          <option value="exibicao">Batalha de Exibição</option>
        </select>
      </div>

      <div class="flex items-center justify-between">
        <label class="text-sm font-semibold text-gray-600">Som ativado</label>
        <button
          class="w-12 h-6 rounded-full transition relative"
          :class="soundEnabled ? 'bg-petro-primary' : 'bg-gray-200'"
          @click="soundEnabled = !soundEnabled"
        >
          <span
            class="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all"
            :class="soundEnabled ? 'left-6' : 'left-0.5'"
          ></span>
        </button>
      </div>

      <button
        class="bg-petro-primary text-white rounded-lg py-2.5 font-semibold hover:opacity-90 transition"
        @click="saveSettings"
      >
        {{ saved ? 'Guardado ✓' : 'Guardar alterações' }}
      </button>
    </div>
  </div>
</template>
