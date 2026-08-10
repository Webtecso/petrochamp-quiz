<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMatchHistoryStore } from '../stores/matchHistory'
import { useChampionshipHistoryStore, type ChampionshipHistoryEntry } from '../stores/championshipHistory'

const historyStore = useMatchHistoryStore()
const championshipHistoryStore = useChampionshipHistoryStore()
const filterChampionship = ref<string>('')
const expandedId = ref<number | null>(null)

onMounted(() => {
  historyStore.fetchHistory()
  championshipHistoryStore.fetchHistory()
})

async function applyFilter(): Promise<void> {
  await historyStore.fetchHistory({ championship: filterChampionship.value || undefined })
  await championshipHistoryStore.fetchHistory({ championship: filterChampionship.value || undefined })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-PT')
}

const championshipLabels: Record<string, string> = {
  universitario: 'Universitário',
  ensino_medio: 'Ensino Médio',
  exibicao: 'Exibição'
}

function toggleExpand(id: number): void {
  expandedId.value = expandedId.value === id ? null : id
}

function parseRanking(entry: ChampionshipHistoryEntry): { name: string; score: number }[] {
  try {
    return (JSON.parse(entry.finalRankingJson) as { name: string; score: number }[]).sort((a, b) => b.score - a.score)
  } catch {
    return []
  }
}

async function deleteChampionship(entry: ChampionshipHistoryEntry): Promise<void> {
  const ok = confirm(
    `Apagar o histórico de "${entry.editionName}" (${championshipLabels[entry.championship]})? Esta ação não pode ser desfeita.`
  )
  if (!ok) return
  await championshipHistoryStore.deleteEntry(entry.id)
}

async function deleteMatch(entry: { id: number; teamAName: string; teamBName: string }): Promise<void> {
  const ok = confirm(`Apagar a partida "${entry.teamAName} vs ${entry.teamBName}" do histórico?`)
  if (!ok) return
  await historyStore.deleteEntry(entry.id)
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-4xl mx-auto w-full">
    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">Histórico de Campeonatos</h2>

      <div v-if="!championshipHistoryStore.entries.length" class="text-xs text-gray-400">
        Nenhum campeonato finalizado ainda.
      </div>

      <div v-for="entry in championshipHistoryStore.entries" :key="entry.id" class="border border-gray-100 rounded-xl p-4 mb-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span class="text-xs font-semibold text-petro-primary uppercase">
              {{ championshipLabels[entry.championship] }} · {{ entry.editionName }}
            </span>
            <div class="text-sm mt-1">
              🏆 <span class="font-bold">{{ entry.championTeamName ?? 'Sem campeão registado' }}</span>
            </div>
          </div>
          <div class="text-right text-xs text-gray-400">
            <div>{{ formatDate(entry.endedAt) }}</div>
            <div>{{ entry.totalMatches }} batalhas</div>
          </div>
        </div>
        <div class="flex items-center gap-3 mt-2">
          <button class="text-xs text-petro-primary underline" @click="toggleExpand(entry.id)">
            {{ expandedId === entry.id ? 'Ocultar ranking final' : 'Ver ranking final' }}
          </button>
          <button class="text-xs text-red-400 underline" @click="deleteChampionship(entry)">
            🗑 Apagar campeonato
          </button>
        </div>
        <div v-if="expandedId === entry.id" class="mt-3 flex flex-col gap-1">
          <div
            v-for="(r, i) in parseRanking(entry)"
            :key="r.name + i"
            class="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-1.5"
          >
            <span>{{ i + 1 }}º {{ r.name }}</span>
            <span class="font-bold text-petro-primary">{{ r.score }} pts</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">Histórico de Partidas</h2>
      <div class="flex items-center gap-2 mb-4">
        <select v-model="filterChampionship" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" @change="applyFilter">
          <option value="">Todos os campeonatos</option>
          <option value="universitario">Universitário</option>
          <option value="ensino_medio">Ensino Médio</option>
          <option value="exibicao">Exibição</option>
        </select>
      </div>

      <div v-if="!historyStore.entries.length" class="text-xs text-gray-400">Nenhuma partida registada ainda.</div>

      <div v-for="entry in historyStore.entries" :key="entry.id" class="border border-gray-100 rounded-xl p-4 mb-3">
        <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
          <span class="text-xs font-semibold text-petro-primary uppercase">
            {{ championshipLabels[entry.championship] }}
            <span v-if="entry.editionName"> · {{ entry.editionName }}</span>
            · {{ entry.phaseLabel }}
          </span>
          <span class="text-xs text-gray-400">{{ formatDate(entry.endedAt) }} · {{ formatDuration(entry.durationSeconds) }}</span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span :class="entry.winnerName === entry.teamAName ? 'font-bold text-petro-primary' : ''">
            {{ entry.teamAName }} — {{ entry.teamAScore }}
          </span>
          <span class="text-gray-300 text-xs">vs</span>
          <span :class="entry.winnerName === entry.teamBName ? 'font-bold text-petro-primary' : ''">
            {{ entry.teamBName }} — {{ entry.teamBScore }}
          </span>
        </div>
        <div class="flex items-center justify-between mt-1">
          <div class="text-[11px] text-gray-400 flex items-center gap-2">
            <span v-if="entry.winnerName">Vencedor: {{ entry.winnerName }}</span>
            <span v-if="entry.wasTiebreak" class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Desempate</span>
          </div>
          <button class="text-[11px] text-red-400 underline" @click="deleteMatch(entry)">🗑 Apagar partida</button>
        </div>
      </div>
    </div>
  </div>
</template>
