<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getBackendUrl } from '../services/backendConfig'
import { checkAdminConfigured } from '../services/adminAuth'
import adminBg from '../assets/projecao-bg.jpg'

const router = useRouter()
const isLocalAccess =
  typeof window === 'undefined' ||
  !window.location.protocol.startsWith('http') ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

const step = ref<'password' | 'qrcode' | 'confirm'>('password')
const password = ref('')
const confirmPassword = ref('')
const qrDataUrl = ref('')
const secret = ref('')
const totpCode = ref('')
const errorMsg = ref('')
const loading = ref(false)

onMounted(async () => {
  const configured = await checkAdminConfigured().catch(() => false)
  if (configured) {
    router.replace('/admin/login')
  }
})

async function submitPassword(): Promise<void> {
  errorMsg.value = ''
  if (password.value.length < 8) {
    errorMsg.value = 'A password tem de ter pelo menos 8 caracteres.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMsg.value = 'As passwords não coincidem.'
    return
  }
  loading.value = true
  try {
    const res = await fetch(`${getBackendUrl()}/api/admin-auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Falha ao configurar.')
    qrDataUrl.value = data.qrDataUrl
    secret.value = data.secret
    step.value = 'qrcode'
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Falha ao configurar.'
  } finally {
    loading.value = false
  }
}

async function confirmTotp(): Promise<void> {
  errorMsg.value = ''
  if (totpCode.value.length !== 6) {
    errorMsg.value = 'Introduz o código de 6 dígitos da app autenticadora.'
    return
  }
  loading.value = true
  try {
    const res = await fetch(`${getBackendUrl()}/api/admin-auth/confirm-totp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: totpCode.value })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Código inválido.')
    router.replace('/admin/login')
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Código inválido.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-petro-bg px-6 relative">
    <!-- NOVO - fundo do Admin (a mesma imagem usada na Projeção). Esta view
    fica fora do AdminLayout (é acedida antes do login), por isso precisa
    do seu próprio fundo. -->
    <div
      class="fixed inset-0 -z-10 bg-cover bg-center"
      :style="{ backgroundImage: `url(${adminBg})` }"
    ></div>

    <div class="bg-white rounded-2xl shadow p-8 w-full max-w-md relative z-10">
      <h1 class="text-xl font-bold text-petro-primary mb-1">Configuração inicial do Admin</h1>
      <p class="text-sm text-gray-500 mb-6">
        Esta configuração só corre uma vez. Define uma password forte e associa uma app autenticadora (Google Authenticator, Authy, etc.).
      </p>

      <p v-if="errorMsg" class="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">{{ errorMsg }}</p>

      <div v-if="step === 'password'" class="flex flex-col gap-3">
        <input
          v-model="password"
          type="password"
          placeholder="Password (mín. 8 caracteres)"
          class="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          @keyup.enter="submitPassword"
        />
        <input
          v-model="confirmPassword"
          type="password"
          placeholder="Confirmar password"
          class="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          @keyup.enter="submitPassword"
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
          @click="submitPassword"
        >
          {{ loading ? 'A configurar...' : 'Continuar' }}
        </button>
      </div>

      <div v-else-if="step === 'qrcode'" class="flex flex-col items-center gap-4">
        <p class="text-sm text-gray-600 text-center">
          Digitaliza este código com a tua app autenticadora.
        </p>
        <img :src="qrDataUrl" alt="QR Code TOTP" class="w-48 h-48" />
        <p class="text-[10px] text-gray-400 text-center break-all">
          Ou introduz manualmente: <span class="font-mono">{{ secret }}</span>
        </p>
        <button
          class="text-xs text-petro-primary underline"
          @click="step = 'confirm'"
        >
          Já digitalizei - continuar
        </button>
      </div>

      <div v-else-if="step === 'confirm'" class="flex flex-col gap-3">
        <p class="text-sm text-gray-600 mb-1">Introduz o código de 6 dígitos gerado pela app:</p>
        <input
          v-model="totpCode"
          type="text"
          inputmode="numeric"
          maxlength="6"
          placeholder="000000"
          class="border border-gray-200 rounded-lg px-3 py-2 text-sm text-center text-lg tracking-widest"
          @keyup.enter="confirmTotp"
        />
        <button
          class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40"
          :disabled="loading"
          @click="confirmTotp"
        >
          {{ loading ? 'A confirmar...' : 'Ativar e concluir' }}
        </button>
      </div>
    </div>
  </div>
</template>
