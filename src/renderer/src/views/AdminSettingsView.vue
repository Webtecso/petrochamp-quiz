<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { getBackendUrl } from '../services/backendConfig'

const settings = useSettingsStore()

const isSyncing = ref(false)
const syncMessage = ref<string | null>(null)
const syncError = ref(false)

async function triggerSync() {
  if (isSyncing.value) return
  isSyncing.value = true
  syncMessage.value = null
  syncError.value = false

  try {
    // CORRIGIDO - o caminho relativo '/api/sync/run' ia sempre para a
    // origem da própria app (localhost:5173 no Vite dev), que não tem essa
    // rota. Precisa de apontar explicitamente para o backend Local
    // (localhost:4000 em dev, ou a mesma origem em produção/túnel).
    const res = await fetch(`${getBackendUrl()}/api/sync/run`, { method: 'POST' })
    const data = await res.json()

    if (res.ok && data.ran) {
      const pushedCount = Object.values(data.pushed ?? {}).reduce((a: number, b: unknown) => a + Number(b), 0)
      const pulledCount = Object.values(data.pulled ?? {}).reduce((a: number, b: unknown) => a + Number(b), 0)
      syncMessage.value = `Sincronização concluída - ${pushedCount} enviado(s), ${pulledCount} recebido(s).`
    } else if (res.ok && !data.ran) {
      syncError.value = true
      syncMessage.value = data.reason || 'Sincronização não correu (provavelmente sem Internet).'
    } else {
      syncError.value = true
      syncMessage.value = data.error || 'Falha ao sincronizar com a Cloud.'
    }
  } catch (err) {
    syncError.value = true
    syncMessage.value = 'Erro ao comunicar com o servidor.'
  } finally {
    isSyncing.value = false
  }
}

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
          <label class="text-sm font-semibold text-gray-600 block">Desempate automático (3.º/4.º lugar)</label>
          <p class="text-xs text-gray-400">Se duas ou mais equipas terminarem empatadas na classificação final, cria automaticamente um desempate antes de fixar o pódio.</p>
        </div>
        <button
          class="w-12 h-6 rounded-full transition relative shrink-0"
          :class="settings.tiebreakAutoEnabled ? 'bg-petro-primary' : 'bg-gray-200'"
          @click="settings.setTiebreakConfig(!settings.tiebreakAutoEnabled, settings.tiebreakMethod)"
        >
          <span
            class="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all"
            :class="settings.tiebreakAutoEnabled ? 'left-6' : 'left-0.5'"
          ></span>
        </button>
      </div>

      <div v-if="settings.tiebreakAutoEnabled">
        <label class="text-sm font-semibold text-gray-600 block mb-2">Método de desempate</label>
        <select
          :value="settings.tiebreakMethod"
          class="w-full border border-gray-200 rounded-lg px-3 py-2"
          @change="settings.setTiebreakConfig(settings.tiebreakAutoEnabled, ($event.target as HTMLSelectElement).value)"
        >
          <option value="quiz">Quiz de desempate</option>
          <option value="battle">Batalha</option>
          <option value="analytic">Perguntas analíticas</option>
        </select>
        <p class="text-xs text-gray-400 mt-1">
          Define como as equipas empatadas disputam a posição final.
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

      <!-- Sincronização com a Cloud -->
      <div class="border-t border-gray-100 pt-5 flex flex-col gap-3">
        <div>
          <label class="text-sm font-semibold text-gray-600 block">Sincronização com a Cloud</label>
          <p class="text-xs text-gray-400">
            Dispare manualmente a sincronização de dados (perguntas, equipas e estado) com a plataforma Cloud.
          </p>
        </div>
        <button
          @click="triggerSync"
          :disabled="isSyncing"
          class="w-full py-2.5 px-4 bg-petro-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 active:scale-[0.99] disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          <svg
            v-if="isSyncing"
            class="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span>{{ isSyncing ? 'A sincronizar...' : 'Sincronizar Agora' }}</span>
        </button>
        <p
          v-if="syncMessage"
          class="text-xs font-medium text-center"
          :class="syncError ? 'text-red-500' : 'text-green-600'"
        >
          {{ syncMessage }}
        </p>
      </div>

      <p class="text-xs text-gray-400">
        Alterações aqui aplicam-se à próxima partida/pergunta iniciada - não afetam uma pergunta já em curso.
      </p>
    </div>
  </div>
</template>
