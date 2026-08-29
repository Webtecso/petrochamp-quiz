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
    class="min-h-screen flex flex-col items-center justify-center gap-[clamp(1.5rem,3vh,3rem)] px-10 overflow-hidden"
    :class="transparent ? 'bg-petro-bg/85' : 'bg-petro-bg'"
  >
    <!-- AUMENTADO - text-3xl fixo trocado por clamp() em vw, para o
         título escalar com o tamanho real do ecrã (TV grande vs monitor
         pequeno) em vez de ficar sempre do mesmo tamanho físico. -->
    <div class="text-petro-primary font-bold text-[clamp(1.8rem,4vw,4rem)]">PETROCHAMP</div>
    <p class="text-[clamp(0.9rem,1.4vw,1.5rem)] text-gray-500 text-center max-w-3xl">
      Estas são as empresas que tornaram possível a realização deste campeonato.
    </p>
    <div v-if="!partnersStore.partners.length" class="text-[clamp(0.75rem,1vw,1rem)] text-gray-400">
      Nenhum parceiro cadastrado ainda.
    </div>
    <!-- AUMENTADO - max-w-4xl trocado por max-w-[90vw], para o carrossel
         ocupar quase toda a largura do ecrã em vez de ficar limitado a
         uma faixa central estreita. -->
    <div v-else class="w-full max-w-[90vw] overflow-hidden">
      <div class="flex gap-[clamp(2rem,4vw,5rem)] items-center partner-track">
        <div
          v-for="p in [...partnersStore.partners, ...partnersStore.partners]"
          :key="p.id + '-' + Math.random()"
          class="flex flex-col items-center gap-[clamp(0.75rem,1.5vh,1.5rem)] shrink-0"
        >
          <!-- AUMENTADO - w-28 h-28 (112px fixos) trocado por clamp() em
               vw/vh, para o logo crescer bastante em ecrãs grandes. -->
          <div class="bg-white rounded-2xl shadow flex items-center justify-center p-[clamp(0.6rem,1.2vw,1.25rem)] w-[clamp(12rem,26vw,36rem)] h-[clamp(12rem,26vw,36rem)]">
            <img :src="p.logoUrl" :alt="p.name" class="w-full h-full object-contain" />
          </div>
          <span class="text-[clamp(1rem,1.6vw,1.75rem)] text-gray-500 font-semibold">{{ p.name }}</span>
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
