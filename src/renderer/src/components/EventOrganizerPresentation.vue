<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { playTypewriterTick } from '../services/sound'
import organizerLogo from '../assets/organizer-logo.png'

defineProps<{ transparent?: boolean }>()

const ORGANIZER_NAME = '(.I9) PONTO INOVE'
const ORGANIZER_TAGLINE = 'Empresa responsável pela realização deste evento.'

const displayedText = ref('')
let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  let i = 0
  interval = setInterval(() => {
    if (i < ORGANIZER_TAGLINE.length) {
      displayedText.value += ORGANIZER_TAGLINE[i]
      if (ORGANIZER_TAGLINE[i] !== ' ') playTypewriterTick()
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
    <img :src="organizerLogo" :alt="ORGANIZER_NAME" class="object-contain w-[clamp(11rem,20vw,24rem)] h-[clamp(11rem,20vw,24rem)]" />
    <!-- AUMENTADO — text-4xl fixo trocado por clamp() em vw. -->
    <div class="font-black tracking-widest text-[clamp(2rem,5vw,5.5rem)]">{{ ORGANIZER_NAME }}</div>
    <p class="text-[clamp(1rem,1.6vw,1.75rem)] text-white/70 text-center max-w-3xl min-h-[3rem]">
      {{ displayedText }}<span class="animate-pulse">|</span>
    </p>
  </div>
</template>
