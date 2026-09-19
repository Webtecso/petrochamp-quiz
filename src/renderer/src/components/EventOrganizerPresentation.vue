<!-- EventOrganizerPresentation.vue -->
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
    class="min-h-screen flex flex-col items-center justify-center gap-[clamp(1rem,2.5vh,2.5rem)] text-white px-6"
    :class="transparent ? 'bg-petro-dark/85' : 'bg-petro-dark'"
  >
    <img
      :src="organizerLogo"
      :alt="ORGANIZER_NAME"
      class="object-contain"
      style="width: clamp(16rem, 55vmin, 40rem); height: clamp(16rem, 55vmin, 40rem); max-height: 55vh;"
    />
    <div class="font-black tracking-widest text-[clamp(2.25rem,5.5vw,6rem)]">
      {{ ORGANIZER_NAME }}
    </div>
    <p class="text-[clamp(1.1rem,1.8vw,2rem)] text-white/70 text-center max-w-4xl min-h-[3rem]">
      {{ displayedText }}<span class="animate-pulse">|</span>
    </p>
  </div>
</template>
