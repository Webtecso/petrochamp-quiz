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
  <div class="min-h-screen bg-petro-bg flex flex-col items-center justify-center px-6 gap-6">
    <LogoMark size="lg" />

    <div v-if="mode === 'nome'" class="w-full max-w-sm bg-white rounded-2xl shadow p-6 flex flex-col gap-4">
      <label class="text-xs font-semibold text-gray-500">O teu nome</label>
      <input
        v-model="playerName"
        type="text"
        placeholder="Ex: Ana"
        class="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:border-petro-primary"
        @keyup.enter="confirmName"
      />
      <p v-if="error" class="text-red-500 text-xs text-center">{{ error }}</p>
      <button class="bg-petro-primary text-white rounded-lg py-3 font-semibold" @click="confirmName">Continuar</button>
    </div>

    <div v-else-if="mode === 'menu'" class="w-full max-w-sm flex flex-col gap-4">
      <p class="text-sm text-gray-400 text-center">Como queres entrar na partida?</p>
      <button class="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-2" @click="mode = 'qr'">
        <div class="text-3xl">📷</div>
        <div class="font-semibold">Ler QR Code</div>
      </button>
      <button class="bg-white rounded-2xl shadow p-6 flex flex-col items-center gap-2" @click="mode = 'manual'">
        <div class="text-3xl">⌨️</div>
        <div class="font-semibold">Inserir Código Manualmente</div>
      </button>
    </div>

    <div v-else-if="mode === 'qr'" class="w-full max-w-sm flex flex-col gap-4 items-center">
      <QrScanner @scanned="onScanned" />
      <p v-if="error" class="text-red-500 text-xs text-center">{{ error }}</p>
      <p v-if="joining" class="text-xs text-gray-400">A ligar...</p>
      <button class="text-xs text-gray-400 underline" @click="mode = 'menu'">← Voltar</button>
    </div>

    <div v-else class="w-full max-w-sm bg-white rounded-2xl shadow p-6 flex flex-col gap-4">
      <div>
        <label class="text-xs font-semibold text-gray-500 block mb-1">Endereço (IP:porta)</label>
        <input
          v-model="manualAddress"
          type="text"
          placeholder="192.168.1.42:4000"
          class="w-full border border-gray-200 rounded-lg px-4 py-3 text-center focus:outline-none focus:border-petro-primary"
        />
      </div>
      <div>
        <label class="text-xs font-semibold text-gray-500 block mb-1">Código da Equipa</label>
        <input
          v-model="manualCode"
          type="text"
          placeholder="A7X9K2"
          class="w-full border border-gray-200 rounded-lg px-4 py-3 text-center tracking-widest font-semibold uppercase focus:outline-none focus:border-petro-primary"
        />
      </div>
      <p v-if="error" class="text-red-500 text-xs text-center">{{ error }}</p>
      <button class="bg-petro-primary text-white rounded-lg py-3 font-semibold" :disabled="joining" @click="submitManual">
        {{ joining ? 'A ligar...' : 'Entrar na Partida' }}
      </button>
      <button class="text-xs text-gray-400 underline" @click="mode = 'menu'">← Voltar</button>
    </div>
  </div>
</template>
