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
  <!-- AUMENTADO - max-w-xs fixo trocado por clamp() em vw, para a área
       da câmara crescer em tablets/ecrãs maiores. Textos também em clamp(). -->
  <div class="flex flex-col items-center gap-3">
    <p v-if="error" class="text-red-500 text-center text-[clamp(0.75rem,2.4vw,1rem)]">{{ error }}</p>
    <video
      ref="videoRef"
      class="w-full rounded-xl bg-black max-w-[clamp(16rem,80vw,26rem)]"
      muted
      playsinline
    ></video>
    <canvas ref="canvasRef" class="hidden"></canvas>
    <p class="text-gray-400 text-center text-[clamp(0.75rem,2.4vw,1rem)]">Aponta a câmara para o QR Code do moderador</p>
  </div>
</template>
