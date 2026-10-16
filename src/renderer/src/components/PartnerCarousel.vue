<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { usePartnersStore } from '../stores/partners'

const partnersStore = usePartnersStore()

// 4s por parceiro (minimo 16s) - mesma formula usada no backend
const SECONDS_PER_PARTNER = 4
const loopSeconds = computed(() => Math.max(16, partnersStore.partners.length * SECONDS_PER_PARTNER))
// Ciclo infinito sem corte: a lista e repetida em 4 copias e a faixa anima de
// 0 a -25% (= exatamente uma copia). Cada copia termina com um espaco igual ao
// gap, por isso o fim de uma copia encaixa no inicio da seguinte sem salto,
// mesmo com poucos parceiros.
const LOOP_COPIES = 4
const loopedGroups = computed(() =>
  Array.from({ length: LOOP_COPIES }, (_, g) => ({ key: g, partners: partnersStore.partners }))
)

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
      <!-- CORRIGIDO - antes a faixa dava voltas infinitas (CSS
           'infinite'), e como a fase no backend dura mais que uma volta
           (para dar margem de seguranca), o carrossel completava o
           ultimo parceiro e saltava de volta ao inicio sem avisar -
           pareceu "cortar e reiniciar". Agora corre uma unica vez
           (animation-iteration-count: 1) e fica parado no fim, so saindo
           do ecra quando o backend mudar de fase. -->
      <div
        class="flex w-max items-center partner-track-loop"
        :style="{ animationDuration: loopSeconds + 's' }"
      >
        <div
          v-for="group in loopedGroups"
          :key="group.key"
          class="flex items-center gap-[clamp(2rem,4vw,5rem)] pr-[clamp(2rem,4vw,5rem)] shrink-0"
        >
          <div
            v-for="p in group.partners"
            :key="group.key + '-' + p.id"
            class="flex flex-col items-center gap-[clamp(0.75rem,1.5vh,1.5rem)] shrink-0"
          >
            <div class="bg-white rounded-2xl shadow flex items-center justify-center p-[clamp(0.6rem,1.2vw,1.25rem)] w-[clamp(12rem,26vw,36rem)] h-[clamp(12rem,26vw,36rem)]">
              <img :src="p.logoUrl" :alt="p.name" class="w-full h-full object-contain" />
            </div>
            <span class="text-[clamp(1rem,1.6vw,1.75rem)] text-gray-500 font-semibold">{{ p.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.partner-track-loop {
  animation: partnerScrollLoop linear infinite;
  will-change: transform;
}
@keyframes partnerScrollLoop {
  from { transform: translateX(0); }
  to { transform: translateX(-25%); }
}
</style>
