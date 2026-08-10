<script setup lang="ts"></script>

<template>
  <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div class="absolute inset-0 sky-glow"></div>

    <div class="absolute bottom-0 inset-x-0 flex items-end justify-between px-4 opacity-25 skyline-drift">
      <div class="flex items-end gap-2">
        <div class="w-3 h-24 bg-white rounded-t-sm refinery-tower" style="animation-delay: 0s"></div>
        <div class="w-3 h-32 bg-white rounded-t-sm refinery-tower" style="animation-delay: 0.4s"></div>
        <div class="w-3 h-20 bg-white rounded-t-sm refinery-tower" style="animation-delay: 0.8s"></div>
      </div>
      <div class="flex items-end gap-2">
        <div class="w-3 h-28 bg-white rounded-t-sm refinery-tower" style="animation-delay: 0.2s"></div>
        <div class="w-3 h-16 bg-white rounded-t-sm refinery-tower" style="animation-delay: 0.6s"></div>
      </div>
    </div>

    <div class="absolute bottom-6 left-10 opacity-30 pumpjack">
      <svg width="70" height="60" viewBox="0 0 70 60" fill="none">
        <rect x="10" y="50" width="50" height="4" fill="white" />
        <rect x="30" y="14" width="4" height="36" fill="white" />
        <g class="pumpjack-arm">
          <rect x="14" y="10" width="34" height="4" fill="white" />
          <circle cx="46" cy="12" r="4" fill="white" />
          <line x1="18" y1="12" x2="18" y2="30" stroke="white" stroke-width="3" />
        </g>
      </svg>
    </div>

    <div class="absolute top-10 right-16 flare-flame">
      <div class="w-2 h-16 bg-white/30 mx-auto"></div>
      <div class="w-6 h-6 -mt-2 mx-auto rounded-full bg-orange-400 flare-glow"></div>
    </div>

    <div class="absolute bottom-0 left-1/2 -translate-x-1/2 opacity-10">
      <div class="w-1 h-40 bg-white mx-auto"></div>
      <div class="w-24 h-1 bg-white -mt-1"></div>
    </div>

    <div class="absolute bottom-12 inset-x-0 mx-20 h-1.5 rounded-full overflow-hidden opacity-25">
      <div class="oil-flow"></div>
    </div>

    <span
      v-for="n in 16"
      :key="'p-' + n"
      class="particle"
      :class="n % 3 === 0 ? 'particle-far' : ''"
      :style="{ left: (n * 6.2) % 100 + '%', animationDelay: n * 0.5 + 's', animationDuration: 5 + (n % 4) + 's' }"
    ></span>
  </div>
</template>

<style scoped>
.sky-glow {
  background: radial-gradient(ellipse at 50% 120%, rgba(122, 26, 46, 0.35) 0%, transparent 60%);
}
.skyline-drift {
  animation: skylineDrift 40s ease-in-out infinite;
}
@keyframes skylineDrift {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-1.5%); }
}
.refinery-tower {
  animation: towerGlow 3s ease-in-out infinite;
}
@keyframes towerGlow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.pumpjack-arm {
  transform-origin: 30px 12px;
  animation: pumpjackRock 2.6s ease-in-out infinite;
}
@keyframes pumpjackRock {
  0%, 100% { transform: rotate(-8deg); }
  50% { transform: rotate(8deg); }
}
.flare-flame {
  animation: flareFlicker 1.8s ease-in-out infinite;
}
.flare-glow {
  box-shadow: 0 0 12px 4px rgba(251, 146, 60, 0.6);
}
@keyframes flareFlicker {
  0%, 100% { transform: scale(1) translateY(0); opacity: 0.8; }
  50% { transform: scale(1.15) translateY(-2px); opacity: 1; }
}
.oil-flow {
  height: 100%;
  background: repeating-linear-gradient(90deg, rgba(250, 204, 21, 0.6) 0 10px, transparent 10px 24px);
  animation: oilFlowMove 1.6s linear infinite;
}
@keyframes oilFlowMove {
  from { transform: translateX(0); }
  to { transform: translateX(24px); }
}
.particle {
  position: absolute;
  bottom: -10px;
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background: rgba(255, 210, 120, 0.6);
  animation-name: particleRise;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.particle-far {
  width: 2px;
  height: 2px;
  filter: blur(1px);
  opacity: 0.4;
}
@keyframes particleRise {
  0% { transform: translateY(0); opacity: 0; }
  10% { opacity: 0.7; }
  90% { opacity: 0.3; }
  100% { transform: translateY(-420px); opacity: 0; }
}
</style>
