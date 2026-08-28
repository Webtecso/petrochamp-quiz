<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { playTypewriterTick } from '../services/sound'
import webtecLogo from '../assets/webtec-logo.png'

defineProps<{ transparent?: boolean }>()

const fullText = 'Empresa responsável pelo desenvolvimento da plataforma.'
const displayedText = ref('')
let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  let i = 0
  interval = setInterval(() => {
    if (i < fullText.length) {
      displayedText.value += fullText[i]
      if (fullText[i] !== ' ') playTypewriterTick()
      i++
    } else if (interval) {
      clearInterval(interval)
    }
  }, 45)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<template>
  <div
    class="min-h-screen flex flex-col items-center justify-center gap-[clamp(1.5rem,3vh,3rem)] text-white px-10"
    :class="transparent ? 'bg-petro-dark/85' : 'bg-petro-dark'"
  >
    <!-- AUMENTADO — w-40 h-40 (160px fixos) trocado por clamp() em vw/vh. -->
    <img :src="webtecLogo" alt="Webtec Solution" class="object-contain w-[clamp(11rem,20vw,24rem)] h-[clamp(11rem,20vw,24rem)]" />
    <!-- AUMENTADO — text-4xl fixo trocado por clamp() em vw. -->
    <div class="font-black tracking-widest text-[clamp(2rem,5vw,5.5rem)]">WEBTEC SOLUTION</div>
    <p class="text-[clamp(1rem,1.6vw,1.75rem)] text-white/70 text-center max-w-3xl min-h-[3rem]">
      {{ displayedText }}<span class="animate-pulse">|</span>
    </p>
  </div>
</template>
