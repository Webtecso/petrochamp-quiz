<script setup lang="ts">
import { computed } from 'vue'
import { Capacitor } from '@capacitor/core'
import { useRouter, useRoute } from 'vue-router'
import LogoMark from '../components/LogoMark.vue'
import { useModeStore } from '../stores/mode'
import { useCampeonatoStore } from '../stores/campeonato'

const modeStore = useModeStore()
const store = useCampeonatoStore()
const router = useRouter()
const route = useRoute()
const isTabletOrPhone = Capacitor.isNativePlatform()

const battleInProgress = computed(() => !!store.teamA && !!store.teamB)

function isActive(path: string): boolean {
  return route.path.startsWith(path)
}

function go(path: string): void {
  if (battleInProgress.value && !isActive(path)) return
  router.push(path)
}

function confirmReset(): void {
  const message = battleInProgress.value
    ? 'Há uma batalha em curso. Reiniciar agora apaga essa batalha e todos os dados desta edição do campeonato — usa isto só se ficaste preso sem conseguir terminar a rodada. Continuar?'
    : 'Tem certeza que deseja reiniciar este campeonato? Todos os dados desta edição serão apagados.'
  const ok = confirm(message)
  if (ok) {
    store.resetChampionship()
    router.push('/moderador/equipas')
  }
}
</script>

<template>
  <div class="min-h-screen bg-petro-bg flex flex-col">
    <nav class="flex items-center justify-between gap-3 bg-petro-dark px-6 py-3 flex-wrap">
      <LogoMark size="sm" />
      <div class="flex items-center gap-2 flex-wrap">
        <button
          v-if="isTabletOrPhone"
          class="px-3 py-2 rounded-lg text-xs bg-white/10 text-white/80 hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
          :disabled="battleInProgress"
          @click="go('/inicio')"
        >
          🏠 Início
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm transition disabled:opacity-30 disabled:cursor-not-allowed"
          :class="isActive('/moderador/campeonato') || isActive('/moderador/equipas') ? 'bg-petro-primary text-white' : 'text-white/70 hover:text-white'"
          :disabled="battleInProgress && !isActive('/moderador/equipas')"
          @click="go('/moderador/campeonato')"
        >
          Nova Partida
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm transition disabled:opacity-30 disabled:cursor-not-allowed"
          :class="isActive('/moderador/ranking') ? 'bg-petro-primary text-white' : 'text-white/70 hover:text-white'"
          :disabled="battleInProgress"
          @click="go('/moderador/ranking')"
        >
          Ranking
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm transition disabled:opacity-30 disabled:cursor-not-allowed"
          :class="isActive('/moderador/podio') ? 'bg-petro-primary text-white' : 'text-white/70 hover:text-white'"
          :disabled="battleInProgress"
          @click="go('/moderador/podio')"
        >
          Pódio
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm transition"
          :class="isActive('/moderador/jurados') ? 'bg-petro-primary text-white' : 'text-white/70 hover:text-white'"
          @click="go('/moderador/jurados')"
        >
          Jurados
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm transition"
          :class="isActive('/moderador/apresentacao') ? 'bg-petro-primary text-white' : 'text-white/70 hover:text-white'"
          @click="go('/moderador/apresentacao')"
        >
          Apresentação
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm transition disabled:opacity-30 disabled:cursor-not-allowed"
          :class="isActive('/moderador/configuracoes') ? 'bg-petro-primary text-white' : 'text-white/70 hover:text-white'"
          :disabled="battleInProgress"
          @click="go('/moderador/configuracoes')"
        >
          Configurações
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
          :disabled="battleInProgress"
          @click="go('/admin')"
        >
          ⚙ Admin
        </button>
        <!-- CORRIGIDO: já não fica bloqueado durante uma batalha — é
             precisamente a saída de emergência para quando algo prende o
             moderador numa rodada que não consegue terminar. O confirm()
             já protege contra cliques acidentais. -->
        <button
          class="px-3 py-2 rounded-lg text-xs bg-red-500/20 text-red-200 hover:bg-red-500/30 transition"
          @click="confirmReset"
        >
          ⟲ Reiniciar Campeonato
        </button>
        <span v-if="battleInProgress" class="text-[11px] text-amber-300 font-semibold px-2">
          🔒 Batalha em curso — navegação bloqueada (Reiniciar continua disponível)
        </span>
      </div>
    </nav>

    <router-view />
  </div>
</template>
