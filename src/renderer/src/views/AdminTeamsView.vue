<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTeamsStore } from '../stores/teams'
import { uploadImage } from '../services/upload'
import type { ChampionshipType } from '../stores/campeonato'

const teamsStore = useTeamsStore()

onMounted(() => {
  teamsStore.fetchTeams()
})

const editingId = ref<string | null>(null)
const form = ref({
  name: '',
  institution: '',
  category: 'universitario' as ChampionshipType,
  logoUrl: '',
  group: '',
  bracketPosition: null as number | null
})
const uploading = ref(false)
const uploadError = ref('')

function resetForm(): void {
  editingId.value = null
  form.value = { name: '', institution: '', category: 'universitario', logoUrl: '', group: '', bracketPosition: null }
  uploadError.value = ''
}

function editTeam(id: string): void {
  const t = teamsStore.teamById(id)
  if (!t) return
  editingId.value = id
  form.value = {
    name: t.name,
    institution: t.institution,
    category: t.category,
    logoUrl: t.logoUrl ?? '',
    group: (t as unknown as { group?: string }).group ?? '',
    bracketPosition: (t as unknown as { bracketPosition?: number }).bracketPosition ?? null
  }
}

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  uploadError.value = ''
  try {
    form.value.logoUrl = await uploadImage(file)
  } catch {
    uploadError.value = 'Falha ao enviar a imagem. Tenta novamente.'
  } finally {
    uploading.value = false
  }
}

function removeLogo(): void {
  form.value.logoUrl = ''
}

async function saveTeam(): Promise<void> {
  if (!form.value.name.trim()) return
  const payload = {
    name: form.value.name,
    institution: form.value.institution,
    category: form.value.category,
    logoUrl: form.value.logoUrl || undefined,
    group: form.value.group || undefined,
    bracketPosition: form.value.bracketPosition
  }
  if (editingId.value) {
    await teamsStore.updateTeam(editingId.value, payload)
  } else {
    await teamsStore.addTeam(payload)
  }
  resetForm()
}

async function removeTeam(id: string): Promise<void> {
  await teamsStore.deleteTeam(id)
  if (editingId.value === id) resetForm()
}

const categoryLabels: Record<ChampionshipType, string> = {
  universitario: 'Universitário',
  ensino_medio: 'Ensino Médio',
  exibicao: 'Exibição'
}
</script>

<template>
  <div class="flex flex-col gap-6 max-w-3xl mx-auto w-full">
    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-semibold text-petro-primary mb-4">{{ editingId ? 'Editar Equipa' : 'Nova Equipa' }}</h2>
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
          <input v-model="form.name" type="text" placeholder="Nome da equipa" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input v-model="form.institution" type="text" placeholder="Instituição" class="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
        <select v-model="form.category" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="universitario">Universitário</option>
          <option value="ensino_medio">Ensino Médio</option>
          <option value="exibicao">Exibição</option>
        </select>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs text-gray-500 block mb-1">Grupo do Chaveamento (opcional)</label>
            <input v-model="form.group" type="text" placeholder="Ex: Grupo A" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Posição no Grupo (opcional)</label>
            <input v-model.number="form.bracketPosition" type="number" min="1" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200">
            <img v-if="form.logoUrl" :src="form.logoUrl" alt="Logo" class="w-full h-full object-cover" />
            <span v-else class="text-xs text-gray-400">Sem logo</span>
          </div>
          <div class="flex flex-col gap-1">
            <label class="bg-petro-primary/10 text-petro-primary text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer text-center">
              {{ uploading ? 'A enviar...' : 'Carregar Imagem' }}
              <input type="file" accept="image/*" class="hidden" :disabled="uploading" @change="onFileSelected" />
            </label>
            <button v-if="form.logoUrl" class="text-xs text-red-400 underline" @click="removeLogo">Remover logo</button>
          </div>
        </div>
        <p v-if="uploadError" class="text-xs text-red-500">{{ uploadError }}</p>

        <div class="flex gap-2 justify-end">
          <button v-if="editingId" class="text-sm text-gray-400 underline" @click="resetForm">Cancelar</button>
          <button class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold" :disabled="uploading" @click="saveTeam">
            {{ editingId ? 'Guardar Alterações' : 'Adicionar Equipa' }}
          </button>
        </div>
      </div>
    </div>

    <div v-for="cat in (['universitario', 'ensino_medio', 'exibicao'] as const)" :key="cat" class="bg-white rounded-2xl shadow p-6">
      <h3 class="font-semibold text-sm text-gray-600 mb-3">{{ categoryLabels[cat] }}</h3>
      <div v-if="!teamsStore.teamsForCategory(cat).length" class="text-xs text-gray-400">Nenhuma equipa cadastrada.</div>
      <div
        v-for="t in teamsStore.teamsForCategory(cat)"
        :key="t.id"
        class="flex items-center justify-between gap-3 border-b border-gray-50 py-2 last:border-0"
      >
        <div class="flex items-center gap-3 flex-1 truncate">
          <img v-if="t.logoUrl" :src="t.logoUrl" :alt="t.name" class="w-8 h-8 rounded-full object-cover" />
          <div v-else class="w-8 h-8 rounded-full bg-petro-primary/10 text-petro-primary text-xs font-bold flex items-center justify-center">
            {{ t.name.slice(0, 2).toUpperCase() }}
          </div>
          <span class="text-sm">
            {{ t.name }} <span class="text-gray-400">· {{ t.institution }}</span>
            <span v-if="(t as unknown as { group?: string }).group" class="text-petro-primary text-xs">
              · {{ (t as unknown as { group?: string }).group }}
            </span>
          </span>
        </div>
        <div class="flex gap-2 shrink-0">
          <button class="text-xs text-petro-primary underline" @click="editTeam(t.id)">Editar</button>
          <button class="text-xs text-red-400 underline" @click="removeTeam(t.id)">Remover</button>
        </div>
      </div>
    </div>
  </div>
</template>
