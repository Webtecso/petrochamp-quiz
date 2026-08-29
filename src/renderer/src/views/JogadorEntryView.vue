<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { setBackendHost } from '../services/backendConfig'
import { connectSocket, getSocket } from '../services/socket'
import { useCampeonatoStore } from '../stores/campeonato'
import { useQuizContentStore } from '../stores/quizContent'
import LogoMark from '../components/LogoMark.vue'
import QrScanner from '../components/QrScanner.vue'

const router = useRouter()
const mode = ref<'nome' | 'menu' | 'qr' | 'manual'>('nome')

const playerName = ref('')
const manualAddress = ref('')
const manualCode = ref('')
const error = ref('')
const joining = ref(false)

interface JoinResult {
  success: boolean
  team?: 'A' | 'B'
  teamName?: string
  opponentName?: string
  error?: string
}

function confirmName(): void {
  if (!playerName.value.trim()) {
    error.value = 'Indica o teu nome.'
    return
  }
  error.value = ''
  mode.value = 'menu'
}

function attemptJoin(address: string, code: string): void {
  error.value = ''
  joining.value = true
  setBackendHost(address)
  connectSocket(true)

  getSocket().emit(
    'player:joinWithCode',
    { code: code.trim().toUpperCase(), playerName: playerName.value.trim() },
    (result: JoinResult) => {
      joining.value = false
      if (!result.success) {
        error.value = result.error || 'Código inválido.'
        return
      }
      useCampeonatoStore().listenToServer()
      useQuizContentStore().fetchQuestions()
      router.push({
        path: '/jogador/jogo',
        query: { team: result.team, teamName: result.teamName, opponentName: result.opponentName }
      })
    }
  )
}

function onScanned(value: string): void {
  const [address, code] = value.split('|')
  if (!address || !code) {
    error.value = 'QR Code inválido.'
    return
  }
  attemptJoin(address, code)
}

function submitManual(): void {
  if (!manualAddress.value.trim() || !manualCode.value.trim()) {
    error.value = 'Preenche o endereço e o código.'
    return
  }
  attemptJoin(manualAddress.value, manualCode.value)
}
</script>

<template>
  <!-- AUMENTADO - px-6 gap-6 fixos trocados por clamp() em vw/vh. -->
  <div class="min-h-screen bg-petro-bg flex flex-col items-center justify-center px-[clamp(1.2rem,5vw,3rem)] gap-[clamp(1.2rem,3vh,2.5rem)]">
    <LogoMark size="lg" />

    <!-- AUMENTADO - max-w-sm, p-6, gap-4, text-xs e px-4 py-3 fixos
         trocados por clamp(), para o cartão crescer em tablets sem
         ficar minúsculo em telemóveis pequenos. -->
    <div
      v-if="mode === 'nome'"
      class="w-full bg-white rounded-2xl shadow flex flex-col max-w-[clamp(20rem,90vw,28rem)] p-[clamp(1.2rem,4vw,2rem)] gap-[clamp(0.75rem,2vh,1.25rem)]"
    >
      <label class="font-semibold text-gray-500 text-[clamp(0.7rem,2.2vw,0.95rem)]">O teu nome</label>
      <input
        v-model="playerName"
        type="text"
        placeholder="Ex: Ana"
        class="w-full border border-gray-200 rounded-lg focus:outline-none focus:border-petro-primary px-[clamp(0.9rem,2.8vw,1.3rem)] py-[clamp(0.7rem,2vh,1rem)] text-[clamp(0.9rem,2.6vw,1.15rem)]"
        @keyup.enter="confirmName"
      />
      <p v-if="error" class="text-red-500 text-center text-[clamp(0.7rem,2.2vw,0.95rem)]">{{ error }}</p>
      <button
        class="bg-petro-primary text-white rounded-lg font-semibold py-[clamp(0.7rem,2vh,1rem)] text-[clamp(0.95rem,2.8vw,1.2rem)]"
        @click="confirmName"
      >
        Continuar
      </button>
    </div>

    <div v-else-if="mode === 'menu'" class="w-full flex flex-col max-w-[clamp(20rem,90vw,28rem)] gap-[clamp(0.75rem,2vh,1.25rem)]">
      <p class="text-gray-400 text-center text-[clamp(0.85rem,2.6vw,1.1rem)]">Como queres entrar na partida?</p>
      <!-- AUMENTADO - p-6, gap-2, text-3xl (emoji) e font-semibold sem
           tamanho fixo, agora todos em clamp(). -->
      <button
        class="bg-white rounded-2xl shadow flex flex-col items-center gap-2 p-[clamp(1.2rem,4vw,2rem)]"
        @click="mode = 'qr'"
      >
        <div class="text-[clamp(2rem,7vw,3.5rem)]">📷</div>
        <div class="font-semibold text-[clamp(0.95rem,2.8vw,1.25rem)]">Ler QR Code</div>
      </button>
      <button
        class="bg-white rounded-2xl shadow flex flex-col items-center gap-2 p-[clamp(1.2rem,4vw,2rem)]"
        @click="mode = 'manual'"
      >
        <div class="text-[clamp(2rem,7vw,3.5rem)]">⌨️</div>
        <div class="font-semibold text-[clamp(0.95rem,2.8vw,1.25rem)]">Inserir Código Manualmente</div>
      </button>
    </div>

    <div v-else-if="mode === 'qr'" class="w-full flex flex-col items-center max-w-[clamp(20rem,90vw,28rem)] gap-[clamp(0.75rem,2vh,1.25rem)]">
      <QrScanner @scanned="onScanned" />
      <p v-if="error" class="text-red-500 text-center text-[clamp(0.7rem,2.2vw,0.95rem)]">{{ error }}</p>
      <p v-if="joining" class="text-gray-400 text-[clamp(0.7rem,2.2vw,0.95rem)]">A ligar...</p>
      <button class="text-gray-400 underline text-[clamp(0.7rem,2.2vw,0.95rem)]" @click="mode = 'menu'">← Voltar</button>
    </div>

    <div
      v-else
      class="w-full bg-white rounded-2xl shadow flex flex-col max-w-[clamp(20rem,90vw,28rem)] p-[clamp(1.2rem,4vw,2rem)] gap-[clamp(0.75rem,2vh,1.25rem)]"
    >
      <div>
        <label class="font-semibold text-gray-500 block mb-1 text-[clamp(0.7rem,2.2vw,0.95rem)]">Endereço (IP:porta)</label>
        <input
          v-model="manualAddress"
          type="text"
          placeholder="192.168.1.42:4000"
          class="w-full border border-gray-200 rounded-lg text-center focus:outline-none focus:border-petro-primary px-[clamp(0.9rem,2.8vw,1.3rem)] py-[clamp(0.7rem,2vh,1rem)] text-[clamp(0.9rem,2.6vw,1.15rem)]"
        />
      </div>
      <div>
        <label class="font-semibold text-gray-500 block mb-1 text-[clamp(0.7rem,2.2vw,0.95rem)]">Código da Equipa</label>
        <input
          v-model="manualCode"
          type="text"
          placeholder="A7X9K2"
          class="w-full border border-gray-200 rounded-lg text-center tracking-widest font-semibold uppercase focus:outline-none focus:border-petro-primary px-[clamp(0.9rem,2.8vw,1.3rem)] py-[clamp(0.7rem,2vh,1rem)] text-[clamp(0.9rem,2.6vw,1.15rem)]"
        />
      </div>
      <p v-if="error" class="text-red-500 text-center text-[clamp(0.7rem,2.2vw,0.95rem)]">{{ error }}</p>
      <button
        class="bg-petro-primary text-white rounded-lg font-semibold py-[clamp(0.7rem,2vh,1rem)] text-[clamp(0.95rem,2.8vw,1.2rem)]"
        :disabled="joining"
        @click="submitManual"
      >
        {{ joining ? 'A ligar...' : 'Entrar na Partida' }}
      </button>
      <button class="text-gray-400 underline text-[clamp(0.7rem,2.2vw,0.95rem)]" @click="mode = 'menu'">← Voltar</button>
    </div>
  </div>
</template>
