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
    class="min-h-screen flex flex-col items-center justify-center gap-6 text-white px-10"
    :class="transparent ? 'bg-petro-dark/85' : 'bg-petro-dark'"
  >
    <img :src="webtecLogo" alt="Webtec Solution" class="w-40 h-40 object-contain" />
    <div class="text-4xl font-black tracking-widest">WEBTEC SOLUTION</div>
    <p class="text-sm text-white/70 text-center max-w-md min-h-[3rem]">
      {{ displayedText }}<span class="animate-pulse">|</span>
    </p>
  </div>
</template>
