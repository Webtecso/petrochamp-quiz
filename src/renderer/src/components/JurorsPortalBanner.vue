<script setup lang="ts">
import { ref, onMounted } from 'vue'
import QRCode from 'qrcode'
import { getBackendUrl } from '../services/backendConfig'

const portalUrl = ref<string | null>(null)
const qrDataUrl = ref<string | null>(null)
const loading = ref(true)
const errorMsg = ref('')
const copied = ref(false)

async function load(): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`${getBackendUrl()}/api/network-info`)
    const data = await res.json()
    if (!data.portalUrl) {
      errorMsg.value = 'Não foi possível detetar o IP da rede local. Confirma que o Wi-Fi/Ethernet está ligado.'
      portalUrl.value = null
      qrDataUrl.value = null
      return
    }
    portalUrl.value = data.portalUrl
    qrDataUrl.value = await QRCode.toDataURL(data.portalUrl, { width: 180, margin: 1 })
  } catch {
    errorMsg.value = 'Falha ao ligar ao backend local.'
  } finally {
    loading.value = false
  }
}

async function copyLink(): Promise<void> {
  if (!portalUrl.value) return
  await navigator.clipboard.writeText(portalUrl.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

onMounted(load)

defineExpose({ refresh: load })
</script>

<template>
  <div class="bg-white rounded-2xl shadow p-5 flex flex-col items-center gap-3 text-center">
    <div class="flex items-center gap-2">
      <span class="text-xl">⚖️</span>
      <h3 class="font-semibold text-petro-primary text-sm">Portal Remoto dos Jurados</h3>
    </div>
    <p class="text-[11px] text-gray-400 -mt-1">
      Os jurados acedem por este link no telemóvel, desde que estejam na mesma rede Wi-Fi/Ethernet.
    </p>

    <div v-if="loading" class="text-xs text-gray-400 py-4">A detetar rede local...</div>

    <div v-else-if="errorMsg" class="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      {{ errorMsg }}
      <button class="block underline mt-1 mx-auto" @click="load">Tentar novamente</button>
    </div>

    <template v-else-if="portalUrl && qrDataUrl">
      <img :src="qrDataUrl" alt="QR code do portal de jurados" class="rounded-lg border border-gray-100" />
      <div class="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono text-gray-600 max-w-full overflow-x-auto">
        {{ portalUrl }}
      </div>
      <button
        class="text-xs bg-petro-primary text-white rounded-lg px-4 py-1.5 font-semibold"
        @click="copyLink"
      >
        {{ copied ? '✓ Copiado' : 'Copiar link' }}
      </button>
    </template>
  </div>
</template>
