<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import * as treinosApi from '../api/treinos'
import type { Treino } from '../types/workout'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'

const router = useRouter()
const snackbar = useSnackbar()

const treinos = ref<Treino[]>([])
const loading = ref(true)
const createDialog = ref(false)
const novoNome = ref('')
const creating = ref(false)

const search = ref('')
const sortBy = ref<'nome-asc' | 'nome-desc' | 'recentes' | 'exercicios'>('nome-asc')
const sortOptions = [
  { title: 'Nome A-Z', value: 'nome-asc' },
  { title: 'Nome Z-A', value: 'nome-desc' },
  { title: 'Mais recentes', value: 'recentes' },
  { title: 'Mais exercícios', value: 'exercicios' },
]
const view = ref<'list' | 'grid'>('list')

async function load(): Promise<void> {
  loading.value = true
  try {
    treinos.value = await treinosApi.listTreinos()
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível carregar os treinos.'))
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  const list = treinos.value.filter((treino) => !term || treino.nome.toLowerCase().includes(term))

  return [...list].sort((a, b) => {
    if (sortBy.value === 'nome-asc') return a.nome.localeCompare(b.nome)
    if (sortBy.value === 'nome-desc') return b.nome.localeCompare(a.nome)
    if (sortBy.value === 'exercicios') return b.exercicioIds.length - a.exercicioIds.length
    return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
  })
})

function formatDate(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

async function createTreino(): Promise<void> {
  const nome = novoNome.value.trim()
  if (!nome) return

  creating.value = true
  try {
    const treino = await treinosApi.createTreino({ nome })
    router.push(`/treinos/${treino._id}`)
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível criar o treino.'))
    creating.value = false
  }
}

const cloningId = ref<string | null>(null)
async function cloneTreino(treino: Treino): Promise<void> {
  cloningId.value = treino._id
  try {
    const clone = await treinosApi.cloneTreino(treino._id)
    router.push(`/treinos/${clone._id}`)
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível clonar o treino.'))
  } finally {
    cloningId.value = null
  }
}

const deleteTarget = ref<Treino | null>(null)
const deleting = ref(false)
async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await treinosApi.deleteTreino(deleteTarget.value._id)
    treinos.value = treinos.value.filter((item) => item._id !== deleteTarget.value!._id)
    deleteTarget.value = null
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível excluir o treino.'))
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Treinos" subtitle="Organize e acompanhe seus treinos.">
      <template #actions>
        <VBtn color="primary" size="small" prepend-icon="mdi-plus" @click="createDialog = true">Novo treino</VBtn>
      </template>
    </PageHeader>

    <VCard class="mb-4">
      <VCardText class="d-flex flex-wrap align-center ga-3">
        <VTextField
          v-model="search"
          placeholder="Buscar treinos..."
          prepend-inner-icon="mdi-magnify"
          hide-details
          density="compact"
          maxlength="50"
          class="flex-grow-1"
          style="min-width: 220px"
        />
        <VSelect
          v-model="sortBy"
          :items="sortOptions"
          prepend-inner-icon="mdi-sort"
          hide-details
          density="compact"
          style="max-width: 220px"
        />
        <VBtnToggle v-model="view" color="primary" mandatory>
          <VBtn value="list" icon="mdi-view-list-outline" />
          <VBtn value="grid" icon="mdi-view-grid-outline" />
        </VBtnToggle>
      </VCardText>
    </VCard>

    <div v-if="loading" class="text-center py-10">
      <VProgressCircular indeterminate />
    </div>

    <VCard v-else-if="!filtered.length">
      <VCardText class="empty-state py-12">
        <div class="empty-state__icon"><VIcon icon="mdi-clipboard-plus-outline" size="34" color="primary" /></div>
        <p class="text-h6 font-weight-bold mt-4">
          {{ search ? 'Nenhum treino encontrado' : 'Crie seu primeiro treino' }}
        </p>
        <p class="text-body-2 text-medium-emphasis mt-1">
          {{
            search
              ? `Nenhum treino corresponde a "${search}".`
              : 'Comece adicionando um novo treino para organizar seus exercícios.'
          }}
        </p>
        <VBtn v-if="!search" color="primary" class="mt-4" prepend-icon="mdi-plus" @click="createDialog = true">
          Novo treino
        </VBtn>
      </VCardText>
    </VCard>

    <div v-else-if="view === 'list'">
      <VCard v-for="treino in filtered" :key="treino._id" class="mb-3 treino-row">
        <VCardText class="d-flex align-center ga-4 flex-wrap">
          <RouterLink :to="`/treinos/${treino._id}`" class="treino-icon">
            <VIcon icon="mdi-clipboard-list-outline" size="24" color="primary" />
          </RouterLink>

          <RouterLink :to="`/treinos/${treino._id}`" class="treino-info">
            <p class="font-weight-bold">{{ treino.nome }}</p>
            <p class="text-body-2 text-medium-emphasis">{{ treino.exercicioIds.length }} exercício(s)</p>
          </RouterLink>

          <VSpacer />

          <div class="treino-stat">
            <div>
              <p class="treino-stat__value treino-stat__value--lg">{{ treino.exercicioIds.length }}</p>
              <p class="treino-stat__label treino-stat__label--lg">Exercícios</p>
            </div>
          </div>

          <div class="treino-stat">
            <div>
              <p class="treino-stat__value">Criado em</p>
              <p class="treino-stat__label">{{ formatDate(treino.createdAt) }}</p>
            </div>
          </div>

          <VMenu>
            <template #activator="{ props: menuProps }">
              <VBtn icon="mdi-dots-vertical" variant="text" size="small" v-bind="menuProps" />
            </template>
            <VList density="compact">
              <VListItem :to="`/treinos/${treino._id}`" prepend-icon="mdi-pencil-outline" title="Editar" />
              <VListItem
                prepend-icon="mdi-file-pdf-box"
                title="Baixar PDF"
                :to="`/treinos/${treino._id}/imprimir`"
                target="_blank"
              />
              <VListItem
                prepend-icon="mdi-content-copy"
                title="Clonar"
                :disabled="cloningId === treino._id"
                @click="cloneTreino(treino)"
              />
              <VListItem
                prepend-icon="mdi-trash-can-outline"
                title="Excluir"
                class="text-error"
                @click="deleteTarget = treino"
              />
            </VList>
          </VMenu>
        </VCardText>
      </VCard>
    </div>

    <div v-else class="treino-grid">
      <VCard v-for="treino in filtered" :key="treino._id" class="treino-card">
        <VCardText>
          <div class="d-flex align-center justify-space-between mb-3">
            <RouterLink :to="`/treinos/${treino._id}`" class="treino-icon">
              <VIcon icon="mdi-clipboard-list-outline" size="24" color="primary" />
            </RouterLink>
            <VMenu>
              <template #activator="{ props: menuProps }">
                <VBtn icon="mdi-dots-vertical" variant="text" size="small" v-bind="menuProps" />
              </template>
              <VList density="compact">
                <VListItem :to="`/treinos/${treino._id}`" prepend-icon="mdi-pencil-outline" title="Editar" />
                <VListItem
                  prepend-icon="mdi-file-pdf-box"
                  title="Baixar PDF"
                  :to="`/treinos/${treino._id}/imprimir`"
                  target="_blank"
                />
                <VListItem
                  prepend-icon="mdi-content-copy"
                  title="Clonar"
                  :disabled="cloningId === treino._id"
                  @click="cloneTreino(treino)"
                />
                <VListItem
                  prepend-icon="mdi-trash-can-outline"
                  title="Excluir"
                  class="text-error"
                  @click="deleteTarget = treino"
                />
              </VList>
            </VMenu>
          </div>

          <RouterLink :to="`/treinos/${treino._id}`" class="treino-info">
            <p class="font-weight-bold treino-card__nome">{{ treino.nome }}</p>
          </RouterLink>

          <VChip size="small" variant="tonal" color="primary" class="mt-2">
            {{ treino.exercicioIds.length }} exercício{{ treino.exercicioIds.length === 1 ? '' : 's' }}
          </VChip>

          <p class="text-caption text-medium-emphasis mt-2 mb-0">Criado em {{ formatDate(treino.createdAt) }}</p>
        </VCardText>
      </VCard>
    </div>

    <VDialog v-model="createDialog" max-width="400">
      <VCard>
        <VCardTitle>Novo treino</VCardTitle>
        <VCardText>
          <VForm @submit.prevent="createTreino">
            <VTextField v-model="novoNome" label="Nome" maxlength="50" autofocus />
          </VForm>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="createDialog = false">Cancelar</VBtn>
          <VBtn color="primary" :loading="creating" :disabled="!novoNome.trim()" @click="createTreino">Criar</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog :model-value="!!deleteTarget" max-width="400" @update:model-value="deleteTarget = null">
      <VCard v-if="deleteTarget">
        <VCardTitle>Excluir treino</VCardTitle>
        <VCardText>
          Tem certeza que deseja excluir "{{ deleteTarget.nome }}"? Isso também remove as sessões do calendário
          vinculadas a ele.
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="deleteTarget = null">Cancelar</VBtn>
          <VBtn color="error" :loading="deleting" @click="confirmDelete">Excluir</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.treino-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.treino-info {
  color: inherit;
  text-decoration: none;
  min-width: 0;
}

.treino-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 100px;
}

.treino-stat__value {
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.2;
}

.treino-stat__label {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.treino-stat__value--lg {
  font-size: 1.1rem;
}

.treino-stat__label--lg {
  font-size: 0.9rem;
}

.treino-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.treino-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.treino-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.treino-card__nome {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.empty-state__icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
