<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCampeonatoStore } from '../stores/campeonato'
import { playSelectSound, playCorrectSound, playWrongSound } from '../services/sound'
import LogoMark from '../components/LogoMark.vue'
import TimerRing from '../components/TimerRing.vue'

const route = useRoute()
const myTeam = computed(() => (route.query.team as 'A' | 'B') || 'A')
const teamName = computed(() => (route.query.teamName as string) || 'A tua equipa')
const opponentName = computed(() => (route.query.opponentName as string) || 'Equipa Adversária')

const store = useCampeonatoStore()

const myQuestion = computed(() => (myTeam.value === 'A' ? store.teamAQuestion : store.teamBQuestion))
const myAnswer = computed(() => (myTeam.value === 'A' ? store.teamAAnswer : store.teamBAnswer))
const opponentAnswer = computed(() => (myTeam.value === 'A' ? store.teamBAnswer : store.teamAAnswer))
const myCorrect = computed(() => (myTeam.value === 'A' ? store.teamACorrect : store.teamBCorrect))

const flashLabel = ref<string | null>(null)

function selectOption(label: string): void {
  if (!myQuestion.value || myAnswer.value) return
  flashLabel.value = label
  playSelectSound()
  setTimeout(() => {
    store.submitPlayerAnswer(myTeam.value, label)
    flashLabel.value = null
  }, 350)
}

watch(myCorrect, (value) => {
  if (value === true) playCorrectSound()
  else if (value === false) playWrongSound()
})

function optionClass(label: string): string {
  if (myAnswer.value === label && myCorrect.value === true) return 'bg-green-500 text-white border-green-500'
  if (myAnswer.value === label && myCorrect.value === false) return 'bg-red-500 text-white border-red-500'
  if (
    myCorrect.value === false &&
    myQuestion.value &&
    myQuestion.value.options.findIndex((o) => o.label === label) === myQuestion.value.correctIndex
  ) {
    return 'bg-green-500 text-white border-green-500'
  }
  if (flashLabel.value === label) return 'scale-95 bg-yellow-100 border-yellow-300'
  if (myAnswer.value && myAnswer.value !== label) return 'border-gray-100 text-gray-300'
  return 'border-gray-200 active:border-petro-primary'
}
</script>

<template>
  <!-- AUMENTADO — px-4 py-6 gap-4 fixos trocados por clamp() em vw/vh,
       para o padding/gap gerais da tela acompanharem o tamanho real
       do dispositivo (telemóvel pequeno vs tablet grande). -->
  <div class="min-h-screen bg-petro-bg flex flex-col px-[clamp(1rem,4vw,2.5rem)] py-[clamp(1.2rem,3vh,2.5rem)] gap-[clamp(0.75rem,2vh,1.5rem)]">
    <div class="flex justify-center">
      <LogoMark size="sm" />
    </div>

    <!-- AUMENTADO — text-xs fixo trocado por clamp(). -->
    <header class="flex items-center justify-between text-[clamp(0.7rem,2.2vw,0.95rem)] text-gray-400">
      <span>{{ teamName }} <span class="text-gray-300">vs {{ opponentName }}</span></span>
      <span class="flex items-center gap-1">
        <span class="w-2 h-2 rounded-full bg-green-500"></span> Online
      </span>
    </header>

    <div v-if="!myQuestion" class="flex-1 flex flex-col items-center justify-center gap-3 text-center">
      <!-- AUMENTADO — text-sm fixo trocado por clamp(). -->
      <p class="text-[clamp(0.85rem,2.6vw,1.15rem)] text-gray-400">A aguardar o moderador iniciar a pergunta...</p>
    </div>

    <template v-else>
      <div class="flex items-center justify-center">
        <TimerRing :seconds="store.timeLeft" />
      </div>

      <!-- AUMENTADO — text-xs, px-3 py-1 e o texto de espera (text-[11px])
           fixos trocados por clamp(). -->
      <div class="text-center flex flex-col items-center gap-1">
        <span
          v-if="!myAnswer"
          class="bg-petro-primary/10 text-petro-primary font-semibold rounded-full text-[clamp(0.7rem,2.2vw,0.95rem)] px-[clamp(0.7rem,2vw,1.1rem)] py-[clamp(0.25rem,0.8vh,0.5rem)]"
        >
          Responde já
        </span>
        <template v-else>
          <span
            class="font-semibold rounded-full text-[clamp(0.7rem,2.2vw,0.95rem)] px-[clamp(0.7rem,2vw,1.1rem)] py-[clamp(0.25rem,0.8vh,0.5rem)]"
            :class="myCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'"
          >
            {{ myCorrect ? 'Acertaste! ✓' : 'Não foi desta vez ✕' }}
          </span>
          <span v-if="!opponentAnswer" class="text-[clamp(0.65rem,2vw,0.85rem)] text-gray-400">
            Aguardando resposta de {{ opponentName }}...
          </span>
        </template>
      </div>

      <!-- AUMENTADO — max-h-40 fixo trocado por clamp() em vh, para a
           imagem crescer em tablets/ecrãs maiores. -->
      <img
        v-if="myQuestion.imageUrl"
        :src="myQuestion.imageUrl"
        alt="Imagem da pergunta"
        class="w-full max-h-[clamp(10rem,28vh,20rem)] object-cover rounded-xl"
      />

      <!-- AUMENTADO — text-base fixo trocado por clamp(). -->
      <h2 class="text-[clamp(1.05rem,3.4vw,1.6rem)] font-semibold text-center">{{ myQuestion.text }}</h2>

      <!-- AUMENTADO — gap-3, px-4 py-3 e o círculo da letra (w-7 h-7,
           text-xs) fixos trocados por clamp(). -->
      <div class="flex flex-col gap-[clamp(0.6rem,1.8vh,1rem)]">
        <button
          v-for="opt in myQuestion.options"
          :key="opt.label"
          class="flex items-center gap-3 border rounded-xl text-left transition-all duration-200 px-[clamp(1rem,3vw,1.5rem)] py-[clamp(0.7rem,2vh,1.1rem)] text-[clamp(0.95rem,2.8vw,1.3rem)]"
          :class="optionClass(opt.label)"
          :disabled="!!myAnswer"
          @click="selectOption(opt.label)"
        >
          <span class="rounded-full flex items-center justify-center font-bold shrink-0 bg-petro-primary/10 text-petro-primary w-[clamp(1.75rem,5.5vw,2.5rem)] h-[clamp(1.75rem,5.5vw,2.5rem)] text-[clamp(0.75rem,2.2vw,1rem)]">
            {{ opt.label }}
          </span>
          {{ opt.text }}
        </button>
      </div>
    </template>

    <!-- AUMENTADO — text-xs e o placar (font-bold, sem tamanho definido
         antes, herdava o base) trocados por clamp(). -->
    <div class="mt-auto pt-4 flex items-center justify-center gap-[clamp(1.2rem,5vw,2.5rem)] text-center">
      <div>
        <div class="text-[clamp(0.7rem,2.2vw,0.95rem)] text-gray-400">{{ teamName }}</div>
        <div class="font-bold text-petro-primary text-[clamp(1.1rem,3.4vw,1.7rem)]">{{ myTeam === 'A' ? store.teamAScore : store.teamBScore }}</div>
      </div>
      <div class="text-gray-300 text-[clamp(0.7rem,2.2vw,0.95rem)]">VS</div>
      <div>
        <div class="text-[clamp(0.7rem,2.2vw,0.95rem)] text-gray-400">{{ opponentName }}</div>
        <div class="font-bold text-gray-400 text-[clamp(1.1rem,3.4vw,1.7rem)]">{{ myTeam === 'A' ? store.teamBScore : store.teamAScore }}</div>
      </div>
    </div>
  </div>
</template>
