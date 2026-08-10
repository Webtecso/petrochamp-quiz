<script setup lang="ts">
import { onMounted } from 'vue'
import { usePartnersStore } from '../stores/partners'

const partnersStore = usePartnersStore()
onMounted(() => {
  partnersStore.fetchPartners()
})

defineProps<{ transparent?: boolean }>()
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center gap-10 px-10 overflow-hidden"
    :class="transparent ? 'bg-petro-bg/85' : 'bg-petro-bg'"
  >
    <div class="text-petro-primary font-bold text-3xl">PETROCHAMP</div>
    <p class="text-sm text-gray-500 text-center max-w-lg">
      Estas são as empresas que tornaram possível a realização deste campeonato.
    </p>
    <div v-if="!partnersStore.partners.length" class="text-xs text-gray-400">
      Nenhum parceiro cadastrado ainda.
    </div>
    <div v-else class="w-full max-w-4xl overflow-hidden">
      <div class="flex gap-12 items-center partner-track">
        <div
          v-for="p in [...partnersStore.partners, ...partnersStore.partners]"
          :key="p.id + '-' + Math.random()"
          class="flex flex-col items-center gap-2 shrink-0"
        >
          <div class="w-28 h-28 bg-white rounded-2xl shadow flex items-center justify-center p-4">
            <img :src="p.logoUrl" :alt="p.name" class="max-w-full max-h-full object-contain" />
          </div>
          <span class="text-xs text-gray-500 font-semibold">{{ p.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.partner-track {
  animation: partnerScroll 16s linear infinite;
}
@keyframes partnerScroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
</style>
