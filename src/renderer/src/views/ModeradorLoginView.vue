<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { connectSocket } from '../services/socket'
import { useModeratorStore } from '../stores/moderator'
import LogoRed from '@renderer/components/LogoRed.vue'

const router = useRouter()
const moderatorStore = useModeratorStore()
const code = ref('')
const error = ref('')
const loading = ref(false)

async function submit(): Promise<void> {
  if (!code.value.trim()) {
    error.value = 'Introduz o teu código de moderador.'
    return
  }
  error.value = ''
  loading.value = true
  connectSocket()
  const result = await moderatorStore.register(code.value.trim())
  loading.value = false
  if (!result.success) {
    error.value = result.error || 'Código inválido.'
    return
  }
  router.push('/moderador/campeonato')
}

</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center gap-8 px-10 py-12">
    <LogoRed size="lg" />
    <div class="text-center">
      <h1 class="text-2xl font-bold text-petro-primary">Entrar como Moderador</h1>
      <p class="text-sm text-gray-600 mt-1">Introduz o código dado pelo Administrador</p>
    </div>

    <div class="w-full max-w-sm bg-white rounded-2xl shadow p-6 flex flex-col gap-4">
      <input
        v-model="code"
        type="text"
        placeholder="Código de 4 dígitos"
        inputmode="numeric"
        maxlength="4"
        class="w-full border border-gray-200 rounded-lg px-4 py-3 text-center text-lg tracking-widest font-semibold focus:outline-none focus:border-petro-primary"
        @keyup.enter="submit"
      />
      <p v-if="error" class="text-red-500 text-xs text-center">{{ error }}</p>
      <button
        class="bg-petro-primary text-white rounded-lg py-3 font-semibold disabled:opacity-50"
        :disabled="loading"
        @click="submit"
      >
        {{ loading ? 'A entrar...' : 'Entrar' }}
      </button>
    </div>
  </div>
</template>
