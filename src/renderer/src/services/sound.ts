let audioCtx: AudioContext | null = null

function getContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

function beep(frequency: number, duration: number, type: OscillatorType = 'sine'): void {
  try {
    const ctx = getContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + duration)
  } catch {
    // ambiente sem suporte a áudio, ignora silenciosamente
  }
}

export function playSelectSound(): void {
  beep(600, 0.08, 'square')
}

export function playCorrectSound(): void {
  beep(523.25, 0.12)
  setTimeout(() => beep(783.99, 0.18), 120)
}

export function playWrongSound(): void {
  beep(220, 0.25, 'sawtooth')
}

export function playTypewriterTick(): void {
  beep(1400 + Math.random() * 200, 0.02, 'square')
}
