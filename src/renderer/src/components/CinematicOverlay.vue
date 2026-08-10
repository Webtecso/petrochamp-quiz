<script setup lang="ts"></script>

<template>
  <div class="absolute inset-0 pointer-events-none z-30 overflow-hidden">
    <div class="letterbox-bar letterbox-top"></div>
    <div class="letterbox-bar letterbox-bottom"></div>
    <div class="vignette"></div>
    <svg class="grain" xmlns="http://www.w3.org/2000/svg">
      <filter id="grainFilter">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grainFilter)" />
    </svg>
    <div class="lens-flare"></div>
  </div>
</template>

<style scoped>
.letterbox-bar {
  position: absolute;
  left: 0;
  right: 0;
  height: 8%;
  background: #000;
  animation: letterboxRetract 1.4s cubic-bezier(0.65, 0, 0.35, 1) both;
  animation-delay: 0.1s;
}
.letterbox-top {
  top: 0;
  transform-origin: top;
}
.letterbox-bottom {
  bottom: 0;
  transform-origin: bottom;
}
@keyframes letterboxRetract {
  0% { transform: scaleY(1); }
  60% { transform: scaleY(1); }
  100% { transform: scaleY(0); }
}
.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 45%, rgba(0, 0, 0, 0.55) 100%);
}
.grain {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.05;
  mix-blend-mode: overlay;
}
.lens-flare {
  position: absolute;
  top: 8%;
  right: 12%;
  width: 140px;
  height: 140px;
  border-radius: 9999px;
  background: radial-gradient(circle, rgba(255, 220, 150, 0.35) 0%, transparent 70%);
  animation: flarePulse 5s ease-in-out infinite;
}
@keyframes flarePulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.3); }
}
</style>
