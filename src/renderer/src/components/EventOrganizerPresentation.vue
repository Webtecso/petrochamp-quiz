<!-- EventOrganizerPresentation.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { playTypewriterTick } from '../services/sound'
import organizerLogo from '../assets/organizer-logo.png'

defineProps<{ transparent?: boolean }>()

const ORGANIZER_NAME = '(.I9) PONTO INOVE'
const ORGANIZER_TAGLINE = 'Empresa responsável pela realização deste evento.'

const displayedText = ref('')
const logoVisible = ref(false)
let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  requestAnimationFrame(() => {
    logoVisible.value = true
  })

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
    class="organizer-stage"
    :class="transparent ? 'bg-petro-dark/85' : 'bg-petro-dark'"
  >
    <div class="organizer-glow organizer-glow-a"></div>
    <div class="organizer-glow organizer-glow-b"></div>

    <div class="organizer-grid">
      <div class="organizer-logo-cell">
        <div class="organizer-logo-ring" :class="{ 'is-visible': logoVisible }">
          <img :src="organizerLogo" :alt="ORGANIZER_NAME" class="organizer-logo-img" />
        </div>
      </div>

      <div class="organizer-text-cell">
        <div class="organizer-eyebrow">Realização do Evento</div>
        <h1 class="organizer-title">{{ ORGANIZER_NAME }}</h1>
        <p class="organizer-tagline">
          {{ displayedText }}<span class="organizer-cursor">|</span>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.organizer-stage {
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: clamp(1.5rem, 4vw, 4rem);
  color: white;
}

.organizer-glow {
  position: absolute;
  border-radius: 9999px;
  filter: blur(80px);
  pointer-events: none;
  opacity: 0.35;
}
.organizer-glow-a {
  width: 45vw;
  height: 45vw;
  background: radial-gradient(circle, #f59e0b 0%, transparent 70%);
  top: -12%;
  right: -8%;
}
.organizer-glow-b {
  width: 40vw;
  height: 40vw;
  background: radial-gradient(circle, #ef4444 0%, transparent 70%);
  bottom: -18%;
  left: -8%;
}

.organizer-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr;
  justify-items: center;
  text-align: center;
  gap: clamp(1.5rem, 4vh, 3rem);
  width: 100%;
  max-width: 90rem;
}

@media (min-width: 1024px) {
  .organizer-grid {
    grid-template-columns: minmax(20rem, 32vw) 1fr;
    justify-items: start;
    text-align: left;
    gap: clamp(2rem, 5vw, 5rem);
  }
}

.organizer-logo-cell {
  display: grid;
  place-items: center;
  width: 100%;
}

.organizer-logo-ring {
  width: clamp(16rem, 30vw, 32rem);
  aspect-ratio: 1 / 1;
  border-radius: 9999px;
  /* background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), rgba(255,255,255,0.02)); */
  display: grid;
  background: white;
  place-items: center;
  border: 2px solid rgba(245, 158, 11, 0.4);
  opacity: 0;
  transform: scale(0.85);
  transition: opacity 0.7s ease-out, transform 0.7s ease-out, box-shadow 1.2s ease-out;
  box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4);
}

.organizer-logo-ring.is-visible {
  opacity: 1;
  transform: scale(1);
  box-shadow: 0 0 0 16px rgba(245, 158, 11, 0.1);
}

.organizer-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.organizer-text-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.5rem, 1.2vh, 1rem);
  max-width: 48rem;
}

@media (min-width: 1024px) {
  .organizer-text-cell {
    align-items: flex-start;
  }
}

.organizer-eyebrow {
  font-size: clamp(0.75rem, 1vw, 1rem);
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: #f59e0b;
  font-weight: 700;
}

.organizer-title {
  font-weight: 900;
  letter-spacing: 0.02em;
  line-height: 1.1;
  font-size: clamp(1.8rem, 4.5vw, 4.5rem);
}

.organizer-tagline {
  font-size: clamp(1.05rem, 1.6vw, 1.85rem);
  color: rgba(255, 255, 255, 0.72);
  min-height: 3rem;
}

.organizer-cursor {
  animation: organizerBlink 1s steps(1) infinite;
}

@keyframes organizerBlink {
  50% { opacity: 0; }
}
</style>