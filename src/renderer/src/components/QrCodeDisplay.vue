<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import QRCode from 'qrcode'

const props = defineProps<{ value: string }>()
const canvasRef = ref<HTMLCanvasElement | null>(null)

async function render(): Promise<void> {
  if (!canvasRef.value) return
  await QRCode.toCanvas(canvasRef.value, props.value, { width: 180, margin: 1 })
}

onMounted(render)
watch(() => props.value, render)
</script>

<template>
  <canvas ref="canvasRef" class="rounded-lg"></canvas>
</template>
