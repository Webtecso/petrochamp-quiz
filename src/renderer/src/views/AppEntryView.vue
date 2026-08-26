<script setup lang="ts">
import { useRouter } from 'vue-router'
import LogoMark from '../components/LogoMark.vue'
import JurorsPortalBanner from '../components/JurorsPortalBanner.vue'

const router = useRouter()
</script>

<template>
  <div class="min-h-screen bg-petro-bg flex flex-col items-center justify-center gap-10 px-8 py-12">
    <LogoMark size="lg" />
    <div class="text-center">
      <h1 class="text-2xl font-bold text-petro-primary">Como vais usar este aparelho?</h1>
      <p class="text-sm text-gray-400 mt-1">Escolhe o teu papel nesta sessão</p>
    </div>

    <div class="grid grid-cols-2 gap-4 w-full max-w-sm">
      <button
        class="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-2 border-2 border-transparent hover:border-petro-primary transition text-center col-span-2"
        @click="router.push('/moderador')"
      >
        <div class="text-3xl">🎛️</div>
        <div class="font-semibold">Moderador</div>
        <p class="text-[11px] text-gray-400">Painel completo — campeonato, equipas, pontuação, pódio</p>
      </button>

      <button
        class="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-2 border-2 border-transparent hover:border-petro-primary transition text-center col-span-2"
        @click="router.push('/jogador')"
      >
        <div class="text-3xl">🎮</div>
        <div class="font-semibold">Jogador</div>
        <p class="text-[11px] text-gray-400">Entrar numa partida com código</p>
      </button>

      <button
        class="bg-white/60 rounded-xl shadow-sm p-4 flex flex-col items-center gap-1 text-center"
        @click="router.push('/moderador/jurados')"
      >
        <div class="text-xl">⚖️</div>
        <div class="text-xs font-semibold">Jurados</div>
      </button>

      <button
        class="bg-white/60 rounded-xl shadow-sm p-4 flex flex-col items-center gap-1 text-center"
        @click="router.push('/admin')"
      >
        <div class="text-xl">⚙️</div>
        <div class="text-xs font-semibold">Admin</div>
      </button>
    </div>

    <!-- NOVO — portal remoto dos jurados sempre em destaque neste ecrã
         de entrada, com link + QR code gerados a partir do IP da rede
         local detetado dinamicamente pelo backend (services/networkInfo.ts).
         Não depende de internet nem de configuração manual por máquina. -->
    <div class="w-full max-w-sm">
      <JurorsPortalBanner />
    </div>
  </div>
</template>
