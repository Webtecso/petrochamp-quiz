<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCampeonatoStore } from '../stores/campeonato'
import { getLocalNetworkIp } from '../services/localNetwork'
import QrCodeDisplay from '../components/QrCodeDisplay.vue'
import TeamAvatar from '../components/TeamAvatar.vue'

const router = useRouter()
const store = useCampeonatoStore()

if (!store.teamA || !store.teamB) {
  router.replace('/moderador/campeonato')
}

const localAddress = computed(() => `${getLocalNetworkIp()}:4000`)

function qrValueFor(code: string): string {
  return `${localAddress.value}|${code}`
}

function startMatch(): void {
  router.push('/moderador/jogo')
}
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center gap-8 px-10 py-10">
    <h1 class="text-2xl font-bold text-petro-primary">Sala de Espera</h1>
    <p class="text-sm text-gray-400 text-center max-w-md">
      Cada equipa lê o seu QR Code (ou insere o código manualmente) na app do telemóvel, opção "Jogador".
      Rede: <b>{{ localAddress }}</b>
    </p>

    <div class="grid grid-cols-2 gap-8 w-full max-w-2xl">
      <div class="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-3">
        <TeamAvatar :name="store.teamA?.name ?? ''" :logo-url="store.teamA?.logoUrl ?? undefined" size="lg" />
        <div class="font-semibold">{{ store.teamA?.name }}</div>
        <QrCodeDisplay v-if="store.matchCodes.teamACode" :value="qrValueFor(store.matchCodes.teamACode)" />
        <div class="text-xs text-gray-400">Código manual</div>
        <div class="text-xl font-mono font-bold tracking-widest text-petro-primary">
          {{ store.matchCodes.teamACode ?? '------' }}
        </div>
        <span
          class="text-xs font-semibold px-3 py-1 rounded-full"
          :class="store.matchCodes.teamAConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'"
        >
          {{ store.matchCodes.teamAConnected ? 'Ligado ✓' : 'Aguardando ligação...' }}
        </span>
      </div>

      <div class="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-3">
        <TeamAvatar :name="store.teamB?.name ?? ''" :logo-url="store.teamB?.logoUrl ?? undefined" size="lg" />
        <div class="font-semibold">{{ store.teamB?.name }}</div>
        <QrCodeDisplay v-if="store.matchCodes.teamBCode" :value="qrValueFor(store.matchCodes.teamBCode)" />
        <div class="text-xs text-gray-400">Código manual</div>
        <div class="text-xl font-mono font-bold tracking-widest text-petro-primary">
          {{ store.matchCodes.teamBCode ?? '------' }}
        </div>
        <span
          class="text-xs font-semibold px-3 py-1 rounded-full"
          :class="store.matchCodes.teamBConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'"
        >
          {{ store.matchCodes.teamBConnected ? 'Ligado ✓' : 'Aguardando ligação...' }}
        </span>
      </div>
    </div>

    <button class="bg-petro-primary text-white rounded-lg px-6 py-3 font-semibold" @click="startMatch">
      Iniciar Partida →
    </button>
    <p class="text-xs text-gray-300">Podes iniciar mesmo sem as duas equipas ligadas, se preferires.</p>
  </div>
</template>
