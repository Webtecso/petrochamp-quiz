<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getBackendUrl } from '../services/backendConfig'
import { setAdminToken, checkAdminConfigured } from '../services/adminAuth'

const router = useRouter()
const isLocalAccess =
  typeof window === 'undefined' ||
  !window.location.protocol.startsWith('http') ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

const password = ref('')
const totpCode = ref('')
const errorMsg = ref('')
const loading = ref(false)

onMounted(async () => {
  const configured = await checkAdminConfigured().catch(() => true)
  if (!configured) {
    router.replace('/admin/setup')
  }
})

async function login(): Promise<void> {
  errorMsg.value = ''
  if (!password.value || totpCode.value.length !== 6) {
    errorMsg.value = 'Introduz a password e o código de 6 dígitos.'
    return
  }
  loading.value = true
  try {
    const res = await fetch(`${getBackendUrl()}/api/admin-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value, token: totpCode.value })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Falha no login.')
    setAdminToken(data.token)
    router.replace('/admin')
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Falha no login.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-petro-bg px-6">
    <div class="bg-white rounded-2xl shadow p-8 w-full max-w-sm">
      <h1 class="text-xl font-bold text-petro-primary mb-6">Login de Admin</h1>

      <p v-if="errorMsg" class="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">{{ errorMsg }}</p>

      <div class="flex flex-col gap-3">
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          class="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          @keyup.enter="login"
        />
        <input
          v-model="totpCode"
          type="text"
          inputmode="numeric"
          maxlength="6"
          placeholder="Código de 6 dígitos"
          class="border border-gray-200 rounded-lg px-3 py-2 text-sm text-center tracking-widest"
          @keyup.enter="login"
        />
        <button
          v-if="isLocalAccess"
          type="button"
          class="text-xs text-gray-400 underline self-start"
          @click="router.push('/moderador')"
        >
          ← Voltar ao Moderador
        </button>
        <button
          class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
          :disabled="loading"
          @click="login"
        >
          {{ loading ? 'A entrar...' : 'Entrar' }}
        </button>
      </div>
    </div>
  </div>
</template>
