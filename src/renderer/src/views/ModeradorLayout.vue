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
// esteja no fluxo (Nova Partida, Jogo, Ranking, etc.) — cumpre o pedido
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
    ? 'Há uma batalha em curso. Reiniciar agora apaga essa batalha e todos os dados desta edição do campeonato — usa isto só se ficaste preso sem conseguir terminar a rodada. Continuar?'
    : 'Tem certeza que deseja reiniciar este campeonato? Vais poder escolher o campeonato novamente e todos os dados desta edição serão apagados.'
  const ok = confirm(message)
  if (ok) {
    store.abandonChampionship()
    router.push('/moderador/modo')
  }
}

// NOVO — este layout é o pai persistente de toda a área /moderador/*,
// por isso é o sítio certo para garantir que, assim que o moderador
// entra nesta secção da app, tentamos reidratar a sessão a partir do
// código guardado em localStorage (ver stores/moderator.ts). Isto cobre
// o caso de um restart completo da app (Electron reiniciado, F5, etc.)
// em que a store nasce do zero mas o backend continua vivo — sem isto,
// o socket ficava ligado sem nunca reenviar 'moderator:register', e o
// backend bloqueava silenciosamente qualquer ação restrita por área
// (ex: Avançar Apresentação) mesmo sendo o moderador Principal, até
// alguém voltar a passar manualmente pelo ecrã de login.
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
        <!-- Botão sempre disponível (mesmo com batalha em curso, já que
             não navega para lado nenhum, só abre um modal por cima) para
             o moderador partilhar rapidamente o link/QR do portal remoto
             dos jurados com quem precisar de entrar. -->
        <button
          class="px-3 py-1 rounded-lg text-xs bg-petro-gold/20 text-petro-gold hover:bg-petro-gold/30 transition font-semibold"
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
          ⚙ Admin
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
          🔒 Batalha em curso — navegação bloqueada (Reiniciar continua disponível)
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
