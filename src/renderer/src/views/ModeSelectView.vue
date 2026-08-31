<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useModeStore, type DeviceMode } from '../stores/mode'
import { connectSocket } from '../services/socket'
import { useCampeonatoStore } from '../stores/campeonato'
import { useTeamsStore } from '../stores/teams'
import { useQuizContentStore } from '../stores/quizContent'
import { useSettingsStore } from '../stores/settings'
import { usePhasesStore } from '../stores/phases'
import { useJuradosStore } from '../stores/jurados'
import { useModeratorStore } from '../stores/moderator'
import LogoRed from '@renderer/components/LogoRed.vue'

const router = useRouter()
const modeStore = useModeStore()

function choose(mode: DeviceMode): void {
  modeStore.setDeviceMode(mode)

  connectSocket()
  const campeonatoStore = useCampeonatoStore()
  campeonatoStore.listenToServer()
  useJuradosStore().listenToServer()
  useTeamsStore().fetchTeams()
  useQuizContentStore().fetchQuestions(campeonatoStore.championship ?? undefined)
  useQuizContentStore().fetchEvaluationItems(campeonatoStore.championship ?? undefined)
  useSettingsStore().fetchSettings()
  usePhasesStore().fetchPhases()

  const moderatorStore = useModeratorStore()
  router.push(moderatorStore.isLoggedIn ? '/moderador/campeonato' : '/moderador/login')
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center gap-10 px-10 py-12">
    <LogoRed size="lg" />
    <div class="text-center">
      <h1 class="text-2xl font-bold text-petro-primary">Como as equipas vão responder hoje?</h1>
      <p class="text-sm text-gray-600 mt-1">Rede local do evento - sem necessidade de internet</p>
    </div>

    <div class="grid grid-cols-2 gap-6 w-full max-w-2xl">
      <button
        class="bg-white rounded-2xl shadow p-8 flex flex-col items-center gap-3 border-2 border-transparent hover:border-petro-primary hover:scale-[1.02] transition text-center"
        @click="choose('com-dispositivos')"
      >
        <div class="text-4xl">📱</div>
        <div class="font-semibold text-lg">Com Dispositivos das Equipas</div>
        <p class="text-xs text-gray-600">
          Cada equipa responde no seu próprio telemóvel/tablet, ligado ao Wi-Fi do evento.
        </p>
      </button>

      <button
        class="bg-white rounded-2xl shadow p-8 flex flex-col items-center gap-3 border-2 border-transparent hover:border-petro-primary hover:scale-[1.02] transition text-center"
        @click="choose('sem-dispositivos')"
      >
        <div class="text-4xl">🎤</div>
        <div class="font-semibold text-lg">Sem Dispositivos</div>
        <p class="text-xs text-gray-600">
          Equipas respondem em voz alta; o moderador confirma quem acertou no painel.
        </p>
      </button>
    </div>

    <p class="text-xs text-gray-300">Jurados e Admin ficam sempre disponíveis, em qualquer opção.</p>
  </div>
</template>
