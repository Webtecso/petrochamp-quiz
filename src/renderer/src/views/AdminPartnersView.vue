<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePartnersStore } from '../stores/partners'
import { uploadImage } from '../services/upload'

const partnersStore = usePartnersStore()
onMounted(() => partnersStore.fetchPartners())

const form = ref({ name: '', logoUrl: '' })
const uploading = ref(false)

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    form.value.logoUrl = await uploadImage(file)
  } finally {
    uploading.value = false
  }
}

async function addPartner(): Promise<void> {
  if (!form.value.name.trim() || !form.value.logoUrl) return
  await partnersStore.addPartner({ name: form.value.name, logoUrl: form.value.logoUrl })
  form.value = { name: '', logoUrl: '' }
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-2xl mx-auto w-full">
    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">Parceiros do Campeonato</h2>
      <div class="flex flex-col gap-3">
        <input v-model="form.name" type="text" placeholder="Nome do parceiro" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
            <img v-if="form.logoUrl" :src="form.logoUrl" alt="Logo" class="w-full h-full object-contain" />
            <span v-else class="text-[10px] text-gray-400">Sem logo</span>
          </div>
          <label class="bg-petro-primary/10 text-petro-primary text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer">
            {{ uploading ? 'A enviar...' : 'Carregar Logo' }}
            <input type="file" accept="image/*" class="hidden" :disabled="uploading" @change="onFileSelected" />
          </label>
        </div>
        <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold self-end" @click="addPartner">
          Adicionar Parceiro
        </button>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h3 class="font-semibold text-sm text-gray-600 mb-3">Cadastrados ({{ partnersStore.partners.length }})</h3>
      <div v-for="p in partnersStore.partners" :key="p.id" class="flex items-center justify-between gap-3 border-b border-gray-50 py-2 last:border-0">
        <div class="flex items-center gap-3">
          <img :src="p.logoUrl" :alt="p.name" class="w-8 h-8 object-contain" />
          <span class="text-sm">{{ p.name }}</span>
        </div>
        <button class="text-xs text-red-400 underline" @click="partnersStore.deletePartner(p.id)">Remover</button>
      </div>
    </div>
  </div>
</template>
