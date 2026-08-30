<script setup lang="ts">
import { ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings'
import { useCampeonatoStore } from '../stores/campeonato'
import { clearBackendHost } from '../services/serverConfig'
import { getBackendUrl } from '../services/backendConfig'

const settings = useSettingsStore()
const store = useCampeonatoStore()
const router = useRouter()
const isNative = Capacitor.isNativePlatform()

const category = ref<'universitario' | 'ensino_medio' | 'exibicao'>('universitario')
const soundEnabled = ref(true)
const saved = ref(false)

function saveSettings(): void {
  saved.value = true
  setTimeout(() => {
    saved.value = false
  }, 2000)
}

async function changeServer(): Promise<void> {
  const ok = confirm('Isto vai desligar-te do computador atual do Moderador. Continuar?')
  if (!ok) return
  await clearBackendHost()
  router.replace('/servidor')
}
</script>

<template>
  <div class="flex-1 px-10 py-8">
    <h1 class="text-2xl font-bold text-petro-primary mb-6 text-center">Configurações</h1>

    <div class="max-w-md mx-auto bg-white rounded-xl shadow p-6 flex flex-col gap-6">
      <div v-if="isNative" class="rounded-xl px-4 py-3 bg-petro-primary/5 border border-petro-primary/20 flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold text-gray-700">Servidor ligado</p>
          <p class="text-[11px] text-gray-600 break-all">{{ getBackendUrl() }}</p>
        </div>
        <button
          class="text-xs font-semibold text-petro-primary underline shrink-0"
          @click="changeServer"
        >
          Trocar
        </button>
      </div>

      <div class="rounded-xl px-4 py-3 text-xs font-semibold flex items-center gap-2"
        :class="{
          'bg-gray-50 text-gray-400': store.publicVotingStatus === 'idle',
          'bg-amber-50 text-amber-600': store.publicVotingStatus === 'starting',
          'bg-green-50 text-green-700': store.publicVotingStatus === 'online',
          'bg-red-50 text-red-600': store.publicVotingStatus === 'failed'
        }">
        <span class="w-2 h-2 rounded-full shrink-0"
          :class="{
            'bg-gray-300': store.publicVotingStatus === 'idle',
            'bg-amber-400 animate-pulse': store.publicVotingStatus === 'starting',
            'bg-green-500': store.publicVotingStatus === 'online',
            'bg-red-500': store.publicVotingStatus === 'failed'
          }"
        ></span>
        <span v-if="store.publicVotingStatus === 'idle'">Portal público de votação: inativo</span>
        <span v-else-if="store.publicVotingStatus === 'starting'">Portal público de votação: a estabelecer ligação...</span>
        <span v-else-if="store.publicVotingStatus === 'online'">Portal público de votação: online</span>
        <span v-else>Portal público de votação: falhou - verifica a ligação à internet</span>
      </div>

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
        <p class="text-xs text-gray-600 mt-1">Também disponível, com mais opções, no Painel do Administrador.</p>
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
