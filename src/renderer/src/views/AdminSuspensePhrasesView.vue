<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSuspensePhrasesStore } from '../stores/suspensePhrases'

const store = useSuspensePhrasesStore()
const newPhrase = ref('')

onMounted(() => store.fetchPhrases())

async function addPhrase(): Promise<void> {
  if (!newPhrase.value.trim()) return
  await store.addPhrase(newPhrase.value.trim())
  newPhrase.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-2xl mx-auto w-full">
    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">Frases de Suspense</h2>
      <p class="text-xs text-gray-400 mb-4">
        Usadas na tela de Projeção enquanto se aguarda o início — o sistema escolhe uma aleatoriamente de cada vez.
      </p>
      <div class="flex gap-2 mb-4">
        <input
          v-model="newPhrase"
          type="text"
          placeholder="Ex: A competição está a ficar cada vez mais intensa..."
          class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          @keyup.enter="addPhrase"
        />
        <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold" @click="addPhrase">
          Adicionar
        </button>
      </div>
      <div v-if="!store.phrases.length" class="text-xs text-gray-400">Nenhuma frase cadastrada ainda.</div>
      <div v-for="p in store.phrases" :key="p.id" class="flex items-center justify-between gap-3 border-b border-gray-50 py-2 last:border-0">
        <span class="text-sm">{{ p.text }}</span>
        <button class="text-xs text-red-400 underline shrink-0" @click="store.deletePhrase(p.id)">Remover</button>
      </div>
    </div>
  </div>
</template>
