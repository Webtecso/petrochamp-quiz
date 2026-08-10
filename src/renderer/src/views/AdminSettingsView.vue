<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
const settings = useSettingsStore()
onMounted(() => {
  settings.fetchSettings()
})
</script>
<template>
  <div class="flex flex-col gap-6 max-w-md mx-auto w-full">
    <div class="bg-white rounded-2xl shadow p-6 flex flex-col gap-5">
      <h2 class="font-semibold text-petro-primary">Configurações Gerais</h2>
      <div>
        <label class="text-sm font-semibold text-gray-600 block mb-2">Tempo por pergunta (segundos)</label>
        <input
          type="number"
          min="5"
          max="120"
          :value="settings.questionTimeSeconds"
          class="w-full border border-gray-200 rounded-lg px-3 py-2"
          @change="settings.setQuestionTime(Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-600 block mb-2">Número máximo de jurados</label>
        <input
          type="number"
          min="1"
          max="10"
          :value="settings.maxJurors"
          class="w-full border border-gray-200 rounded-lg px-3 py-2"
          @change="settings.setMaxJurors(Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-600 block mb-2">Duração dos parceiros no ecrã (segundos)</label>
        <input
          type="number"
          min="5"
          max="600"
          :value="settings.partnersDurationSeconds"
          class="w-full border border-gray-200 rounded-lg px-3 py-2"
          @change="settings.setPartnersDuration(Number(($event.target as HTMLInputElement).value))"
        />
        <p class="text-xs text-gray-400 mt-1">
          Tempo que os parceiros ficam visíveis na Projeção antes de avançar para a tela de suspense da próxima fase.
        </p>
      </div>
      <div class="flex items-center justify-between">
        <div>
          <label class="text-sm font-semibold text-gray-600 block">Mostrar pontuação na Projeção</label>
          <p class="text-xs text-gray-400">O moderador continua a ver sempre a pontuação, mesmo desativado aqui.</p>
        </div>
        <button
          class="w-12 h-6 rounded-full transition relative shrink-0"
          :class="settings.showScoreOnProjection ? 'bg-petro-primary' : 'bg-gray-200'"
          @click="settings.setShowScoreOnProjection(!settings.showScoreOnProjection)"
        >
          <span
            class="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all"
            :class="settings.showScoreOnProjection ? 'left-6' : 'left-0.5'"
          ></span>
        </button>
      </div>
      <p class="text-xs text-gray-400">
        Alterações aqui aplicam-se à próxima partida/pergunta iniciada — não afetam uma pergunta já em curso.
      </p>
    </div>
  </div>
</template>
