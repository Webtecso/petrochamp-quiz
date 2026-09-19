<!-- WebtecPresentation.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { playTypewriterTick } from '../services/sound'
import webtecLogo from '../assets/webtec-logo.png'

defineProps<{ transparent?: boolean }>()

const fullText = 'Empresa responsável pelo desenvolvimento da plataforma.'
const displayedText = ref('')
const logoVisible = ref(false)
let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  requestAnimationFrame(() => {
    logoVisible.value = true
  })

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
    class="webtec-stage"
    :class="transparent ? 'bg-petro-dark/85' : 'bg-petro-dark'"
  >
    <div class="webtec-glow webtec-glow-a"></div>
    <div class="webtec-glow webtec-glow-b"></div>

    <div class="webtec-grid">
      <div class="webtec-logo-cell">
        <div class="webtec-logo-ring" :class="{ 'is-visible': logoVisible }">
          <img :src="webtecLogo" alt="Webtec Solution" class="webtec-logo-img" />
        </div>
      </div>

      <div class="webtec-text-cell">
        <div class="webtec-eyebrow">Tecnologia &amp; Desenvolvimento</div>
        <h1 class="webtec-title">WEBTEC<span class="webtec-title-accent">SOLUTION</span></h1>
        <p class="webtec-tagline">
          {{ displayedText }}<span class="webtec-cursor">|</span>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.webtec-stage {
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: clamp(1.5rem, 4vw, 4rem);
  color: white;
}

.webtec-glow {
  position: absolute;
  border-radius: 9999px;
  filter: blur(80px);
  pointer-events: none;
  opacity: 0.35;
}
.webtec-glow-a {
  width: 45vw;
  height: 45vw;
  background: radial-gradient(circle, #d4af37 0%, transparent 70%);
  top: -10%;
  left: -10%;
}
.webtec-glow-b {
  width: 40vw;
  height: 40vw;
  background: radial-gradient(circle, #16a34a 0%, transparent 70%);
  bottom: -15%;
  right: -10%;
}

.webtec-grid {
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
  .webtec-grid {
    grid-template-columns: minmax(26rem, 44vw) 1fr;
    justify-items: start;
    text-align: left;
    gap: clamp(2rem, 5vw, 5rem);
  }
}

.webtec-logo-cell {
  display: grid;
  place-items: center;
  width: 100%;
}

.webtec-logo-ring {
  width: clamp(20rem, 42vw, 42rem);
  aspect-ratio: 1 / 1;
  border-radius: 2rem;
  background: white;
  display: grid;
  place-items: center;
  box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.5);
  opacity: 0;
  transform: scale(0.85);
  transition: opacity 0.7s ease-out, transform 0.7s ease-out, box-shadow 1.2s ease-out;
}

.webtec-logo-ring.is-visible {
  opacity: 1;
  transform: scale(1);
  box-shadow: 0 0 0 14px rgba(212, 175, 55, 0.12);
}

.webtec-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.webtec-text-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(0.5rem, 1.2vh, 1rem);
  max-width: 48rem;
}

@media (min-width: 1024px) {
  .webtec-text-cell {
    align-items: flex-start;
  }
}

.webtec-eyebrow {
  font-size: clamp(0.75rem, 1vw, 1rem);
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: #d4af37;
  font-weight: 700;
}

.webtec-title {
  font-weight: 900;
  letter-spacing: 0.05em;
  line-height: 1.05;
  font-size: clamp(2rem, 5vw, 5.5rem);
  display: flex;
  flex-direction: column;
}

.webtec-title-accent {
  color: #d4af37;
}

.webtec-tagline {
  font-size: clamp(1.05rem, 1.6vw, 1.85rem);
  color: rgba(255, 255, 255, 0.72);
  min-height: 3rem;
}

.webtec-cursor {
  animation: webtecBlink 1s steps(1) infinite;
}

@keyframes webtecBlink {
  50% { opacity: 0; }
}
</style>