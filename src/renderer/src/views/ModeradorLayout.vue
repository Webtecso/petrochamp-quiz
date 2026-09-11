<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Capacitor } from '@capacitor/core'
import { useRouter, useRoute } from 'vue-router'
import LogoMark from '../components/LogoMark.vue'
import JurorsPortalBanner from '../components/JurorsPortalBanner.vue'
import { useCampeonatoStore } from '../stores/campeonato'
import { useModeratorStore } from '../stores/moderator'

const store = useCampeonatoStore()
const moderatorStore = useModeratorStore()
const router = useRouter()
const route = useRoute()
const isTabletOrPhone = Capacitor.isNativePlatform()

const battleInProgress = computed(() => !!store.teamA && !!store.teamB)

// Modal com o link/QR do portal de jurados, acessível a partir de um
// botão sempre visível no nav, independentemente de onde o moderador
// esteja no fluxo (Nova Partida, Jogo, Ranking, etc.) - cumpre o pedido
// de estar "sempre em destaque assim que a app abrir", já que este layout
// envolve praticamente todo o percurso do Moderador.
const showPortalModal = ref(false)

function isActive(path: string): boolean {
  return route.path.startsWith(path)
}

function go(path: string): void {
  if (battleInProgress.value && !isActive(path)) return
  router.push(path)
}

function confirmReset(): void {
  const message = battleInProgress.value
    ? 'Há uma batalha em curso. Reiniciar agora apaga essa batalha e todos os dados desta edição do campeonato - usa isto só se ficaste preso sem conseguir terminar a rodada. Continuar?'
    : 'Tem certeza que deseja reiniciar este campeonato? Vais poder escolher o campeonato novamente e todos os dados desta edição serão apagados.'
  const ok = confirm(message)
  if (ok) {
    store.abandonChampionship()
    router.push('/moderador/modo')
  }
}

onMounted(() => {
  moderatorStore.initFromStorage()
})
</script>

<template>
  <div class="min-h-screen bg-petro-bg flex flex-col">
    <nav class="flex items-center justify-between gap-3 bg-petro-dark px-6 py-1.5 flex-wrap">
      <LogoMark size="sm" />
      <div class="flex items-center gap-2 flex-wrap">
        <button
          v-if="isTabletOrPhone"
          class="px-3 py-1 rounded-lg text-xs bg-white/10 text-white/80 hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
          :disabled="battleInProgress"
          @click="go('/inicio')"
        >
          🏠 Início
        </button>
        <button
          class="px-4 py-1 rounded-lg text-sm transition disabled:opacity-30 disabled:cursor-not-allowed"
          :class="isActive('/moderador/modo') || isActive('/moderador/campeonato') || isActive('/moderador/equipas') ? 'bg-petro-primary text-white' : 'text-white/70 hover:text-white'"
          :disabled="!!store.championship"
          @click="go('/moderador/modo')"
        >
          Nova Partida
        </button>
        <button
          class="px-4 py-1 rounded-lg text-sm transition disabled:opacity-30 disabled:cursor-not-allowed"
          :class="isActive('/moderador/ranking') ? 'bg-petro-primary text-white' : 'text-white/70 hover:text-white'"
          :disabled="battleInProgress"
          @click="go('/moderador/ranking')"
        >
          Ranking
        </button>
        <button
          class="px-4 py-1 rounded-lg text-sm transition disabled:opacity-30 disabled:cursor-not-allowed"
          :class="isActive('/moderador/podio') ? 'bg-petro-primary text-white' : 'text-white/70 hover:text-white'"
          :disabled="battleInProgress"
          @click="go('/moderador/podio')"
        >
          Pódio
        </button>
        <button
          class="px-4 py-1 rounded-lg text-sm transition"
          :class="isActive('/moderador/jurados') ? 'bg-petro-primary text-white' : 'text-white/70 hover:text-white'"
          @click="go('/moderador/jurados')"
        >
          Jurados
        </button>
        <button
          class="px-3 py-1 rounded-lg text-xs bg-amber-400 text-petro-dark hover:bg-petro-gold/30 transition font-semibold"
          @click="showPortalModal = true"
        >
          📡 Portal Jurados
        </button>
        <button
          class="px-4 py-1 rounded-lg text-sm transition disabled:opacity-30 disabled:cursor-not-allowed"
          :class="isActive('/moderador/configuracoes') ? 'bg-petro-primary text-white' : 'text-white/70 hover:text-white'"
          :disabled="battleInProgress"
          @click="go('/moderador/configuracoes')"
        >
          Configurações
        </button>
        <button
          class="px-4 py-1 rounded-lg text-sm bg-white/10 text-white hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
          :disabled="battleInProgress"
          @click="go('/admin')"
        >
          Admin
        </button>
        <span v-if="moderatorStore.isLoggedIn" class="text-[11px] text-white/70 px-2 flex items-center gap-1">
          👤 {{ moderatorStore.session?.name }}
          <span
            class="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase"
            :class="moderatorStore.isPrincipal ? 'bg-amber-400 text-petro-dark' : 'bg-white/20 text-white'"
          >
            {{ moderatorStore.isPrincipal ? 'Principal' : 'Secundário' }}
          </span>
        </span>
        <button
          v-if="!moderatorStore.isLoggedIn || moderatorStore.isPrincipal"
          class="px-3 py-1 rounded-lg text-xs bg-red-500/20 text-red-200 hover:bg-red-500/30 transition"
          @click="confirmReset"
        >
          ⟲ Reiniciar Campeonato
        </button>
        <span v-if="battleInProgress" class="text-[11px] text-amber-300 font-semibold px-2">
          🔒 Batalha em curso - navegação bloqueada (Reiniciar continua disponível)
        </span>
      </div>
    </nav>

    <router-view />

    <!-- Modal do portal de jurados, acessível a qualquer momento a
         partir do botão "📡 Portal Jurados" no nav acima. -->
    <div
      v-if="showPortalModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
      @click.self="showPortalModal = false"
    >
      <div class="w-full max-w-sm relative">
        <button
          class="absolute -top-3 -right-3 bg-white rounded-full w-8 h-8 shadow flex items-center justify-center text-gray-500 hover:text-gray-800"
          @click="showPortalModal = false"
        >
          ✕
        </button>
        <JurorsPortalBanner />
      </div>
    </div>
  </div>
</template>
