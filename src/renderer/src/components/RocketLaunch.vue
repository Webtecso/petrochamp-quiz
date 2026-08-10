<script setup lang="ts"></script>

<template>
  <div class="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none rocket-wrapper">
    <div class="text-5xl rocket-icon">🚀</div>
    <div class="rocket-trail"></div>
  </div>
</template>

<style scoped>
.rocket-wrapper {
  animation: rocketLaunch 2.6s cubic-bezier(0.35, 0, 0.25, 1) both;
}
.rocket-icon {
  display: inline-block;
  transform: rotate(-45deg);
}
.rocket-trail {
  width: 6px;
  height: 60px;
  margin: 0 auto;
  background: linear-gradient(to top, rgba(250, 204, 21, 0.6), transparent);
  border-radius: 9999px;
}
@keyframes rocketLaunch {
  0% { transform: translate(-50%, 0); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translate(-50%, -600px); opacity: 0; }
}
</style>
