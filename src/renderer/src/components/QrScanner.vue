<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import jsQR from 'jsqr'

const emit = defineEmits<{ scanned: [value: string] }>()

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const error = ref('')
let stream: MediaStream | null = null
let rafHandle: number | null = null
let stopped = false

async function start(): Promise<void> {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play()
    }
    tick()
  } catch {
    error.value = 'Não foi possível aceder à câmara. Verifica as permissões.'
  }
}

function tick(): void {
  if (stopped) return
  const video = videoRef.value
  const canvas = canvasRef.value
  if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        emit('scanned', code.data)
        return
      }
    }
  }
  rafHandle = requestAnimationFrame(tick)
}

onMounted(start)
onUnmounted(() => {
  stopped = true
  if (rafHandle) cancelAnimationFrame(rafHandle)
  stream?.getTracks().forEach((t) => t.stop())
})
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <p v-if="error" class="text-red-500 text-xs text-center">{{ error }}</p>
    <video ref="videoRef" class="w-full max-w-xs rounded-xl bg-black" muted playsinline></video>
    <canvas ref="canvasRef" class="hidden"></canvas>
    <p class="text-xs text-gray-400 text-center">Aponta a câmara para o QR Code do moderador</p>
  </div>
</template>
