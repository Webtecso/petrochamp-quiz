<script setup lang="ts">
import { ref, onMounted } from 'vue'
import SplashScreen from './components/SplashScreen.vue'

const showSplash = ref(true)

onMounted(() => {
  setTimeout(() => {
    showSplash.value = false
  }, 2200)
})
</script>

<template>
  <SplashScreen v-if="showSplash" />
  <router-view v-else />
</template>
