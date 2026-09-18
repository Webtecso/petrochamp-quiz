<!-- WebtecPresentation.vue -->
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
    class="min-h-screen flex flex-col items-center justify-center gap-[clamp(1rem,2.5vh,2.5rem)] text-white px-6"
    :class="transparent ? 'bg-petro-dark/85' : 'bg-petro-dark'"
  >
    <img
      :src="webtecLogo"
      alt="Webtec Solution"
      class="object-contain"
      style="width: clamp(45rem, 89vw, 90rem); height: clamp(45rem, 89vw, 99rem); max-height: 90vh;"
      />
      <!-- class="object-contain w-[clamp(28rem,55vw,72rem)] h-[clamp(28rem,55vw,72rem)] max-h-[70vh]" -->
    <div class="font-black tracking-widest text-[clamp(2.25rem,5.5vw,6rem)]">
      WEBTEC SOLUTION
    </div>
    <p class="text-[clamp(1.1rem,1.8vw,2rem)] text-white/70 text-center max-w-4xl min-h-[3rem]">
      {{ displayedText }}<span class="animate-pulse">|</span>
    </p>
  </div>
</template>