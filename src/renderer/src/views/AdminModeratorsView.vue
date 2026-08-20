<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { adminFetch } from '../services/adminAuth'

interface Moderator {
  id: string
  name: string
  code: string
  role: 'principal' | 'secundario'
  areas: string[]
}

const AREA_LABELS: Record<string, string> = {
  quiz: 'Quiz',
  apresentacao: 'Apresentação',
  jurados: 'Jurados',
  repescagem: 'Repescagem'
}
const AREA_KEYS = Object.keys(AREA_LABELS)

const moderators = ref<Moderator[]>([])
const newName = ref('')
const newRole = ref<'principal' | 'secundario'>('secundario')
const newAreas = ref<string[]>([])
const errorMsg = ref('')

const showAreaPicker = computed(() => newRole.value === 'secundario')

function toggleNewArea(area: string): void {
  const idx = newAreas.value.indexOf(area)
  if (idx >= 0) newAreas.value.splice(idx, 1)
  else newAreas.value.push(area)
}

async function loadModerators(): Promise<void> {
  try {
    const res = await adminFetch('/api/moderators')
    if (res.ok) {
      moderators.value = await res.json()
    }
  } catch (e) {
    console.error('Erro ao carregar moderadores:', e)
  }
}

onMounted(loadModerators)

async function addModerator(): Promise<void> {
  if (!newName.value.trim()) return
  errorMsg.value = ''
  try {
    const res = await adminFetch('/api/moderators', {
      method: 'POST',
      body: JSON.stringify({ name: newName.value.trim(), role: newRole.value, areas: newAreas.value })
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Erro ao criar moderador.')
    }
    newName.value = ''
    newRole.value = 'secundario'
    newAreas.value = []
    await loadModerators()
  } catch (e) {
    errorMsg.value = e instanceof Error && e.message ? e.message : 'Falha ao criar moderador.'
  }
}

async function removeModerator(id: string): Promise<void> {
  const ok = confirm('Remover este moderador? O código dele deixa de funcionar.')
  if (!ok) return

  try {
    const res = await adminFetch(`/api/moderators/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await loadModerators()
    }
  } catch (e) {
    console.error('Erro ao remover moderador:', e)
  }
}

// NOVO — editar áreas de um moderador secundário já existente, inline.
async function toggleExistingArea(m: Moderator, area: string): Promise<void> {
  if (m.role !== 'secundario') return
  const nextAreas = m.areas.includes(area) ? m.areas.filter((a) => a !== area) : [...m.areas, area]
  try {
    const res = await adminFetch(`/api/moderators/${m.id}`, {
      method: 'PUT',
      body: JSON.stringify({ name: m.name, role: m.role, areas: nextAreas })
    })
    if (res.ok) {
      await loadModerators()
    }
  } catch (e) {
    console.error('Erro ao atualizar áreas:', e)
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-2xl mx-auto w-full">
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
      Só pode existir um Moderador Principal por vez. Ele tem controlo total (iniciar/reiniciar campeonato,
      finalizar, votação de repescagem, pódio). Os Secundários só controlam as áreas atribuídas abaixo.
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">Novo Moderador</h2>
      <div class="flex gap-2 mb-3">
        <input
          v-model="newName"
          type="text"
          placeholder="Nome do moderador"
          class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          @keyup.enter="addModerator"
        />
        <select v-model="newRole" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="secundario">Secundário</option>
          <option value="principal">Principal</option>
        </select>
        <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold" @click="addModerator">
          Adicionar
        </button>
      </div>

      <div v-if="showAreaPicker" class="flex flex-wrap gap-2 mb-3">
        <label
          v-for="area in AREA_KEYS"
          :key="area"
          class="flex items-center gap-1.5 text-xs border rounded-full px-3 py-1.5 cursor-pointer select-none"
          :class="newAreas.includes(area) ? 'bg-petro-primary text-white border-petro-primary' : 'border-gray-200 text-gray-600'"
        >
          <input
            type="checkbox"
            class="hidden"
            :checked="newAreas.includes(area)"
            @change="toggleNewArea(area)"
          />
          {{ AREA_LABELS[area] }}
        </label>
      </div>

      <p v-if="errorMsg" class="text-xs text-red-500">{{ errorMsg }}</p>
    </div>

    <div class="bg-white rounded-2xl shadow p-6">
      <h3 class="font-semibold text-sm text-gray-600 mb-3">Moderadores Cadastrados</h3>
      <div v-if="!moderators.length" class="text-xs text-gray-400">Nenhum moderador cadastrado ainda.</div>
      <div v-for="m in moderators" :key="m.id" class="flex flex-col gap-2 border-b border-gray-50 py-3 last:border-0">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm">
            {{ m.name }}
            <span class="font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs ml-2">{{ m.code }}</span>
            <span
              class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
              :class="m.role === 'principal' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'"
            >
              {{ m.role === 'principal' ? 'Principal' : 'Secundário' }}
            </span>
          </div>
          <button class="text-xs text-red-400 underline" @click="removeModerator(m.id)">Remover</button>
        </div>

        <div v-if="m.role === 'secundario'" class="flex flex-wrap gap-1.5">
          <button
            v-for="area in AREA_KEYS"
            :key="area"
            class="text-[11px] border rounded-full px-2.5 py-1 transition"
            :class="m.areas.includes(area) ? 'bg-petro-primary/10 text-petro-primary border-petro-primary/40' : 'border-gray-200 text-gray-400'"
            @click="toggleExistingArea(m, area)"
          >
            {{ AREA_LABELS[area] }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
