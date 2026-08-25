<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import LogoMark from '../components/LogoMark.vue'
import { saveBackendHost } from '../services/serverConfig'
import { getBackendUrl } from '../services/backendConfig'
import { initApp } from '../services/appInit'

const router = useRouter()
const hostInput = ref('')
const testing = ref(false)
const errorMsg = ref('')

async function testAndSave(): Promise<void> {
  const trimmed = hostInput.value.trim()
  if (!trimmed) {
    errorMsg.value = 'Introduz o IP (e porta, se diferente de 4000) do computador do Moderador.'
    return
  }
  errorMsg.value = ''
  testing.value = true
  try {
    await saveBackendHost(trimmed)
    const res = await fetch(`${getBackendUrl()}/health`, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error('Resposta inválida do servidor.')
    // Liga o socket E inicializa as stores/listeners — sem isto, a
    // primeira ligação a um PC ficava com o socket aberto mas nenhuma
    // store reativa a ouvir 'state:sync', deixando o Moderador "preso"
    // até reiniciar a app manualmente.
    initApp(true)
    router.replace('/inicio')
  } catch {
    errorMsg.value = 'Não consegui ligar a esse endereço. Confirma que estás na mesma rede Wi-Fi que o computador do Moderador, e que o IP está correto.'
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-petro-bg flex flex-col items-center justify-center gap-8 px-8 py-12">
    <LogoMark size="lg" />
    <div class="text-center">
      <h1 class="text-2xl font-bold text-petro-primary">Ligar ao computador do Moderador</h1>
      <p class="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
        Introduz o IP mostrado no computador que está a correr o Petrochamp (ex.: 192.168.1.10)
      </p>
    </div>

    <div class="w-full max-w-sm flex flex-col gap-3">
      <input
        v-model="hostInput"
        type="text"
        placeholder="192.168.1.10 ou 192.168.1.10:4000"
        class="border border-gray-200 rounded-xl px-4 py-3 text-center text-lg font-semibold"
        @keyup.enter="testAndSave"
      />
      <button
        class="bg-petro-primary text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50"
        :disabled="testing"
        @click="testAndSave"
      >
        {{ testing ? 'A ligar...' : 'Ligar' }}
      </button>
      <p v-if="errorMsg" class="text-xs text-red-500 text-center">{{ errorMsg }}</p>
    </div>
  </div>
</template>
