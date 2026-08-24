<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import * as refeicoesApi from '../api/refeicoes'
import type { Refeicao } from '../types/workout'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'

const router = useRouter()
const snackbar = useSnackbar()

const refeicoes = ref<Refeicao[]>([])
const loading = ref(true)
const createDialog = ref(false)
const novoNome = ref('')
const creating = ref(false)

const search = ref('')
const sortBy = ref<'nome-asc' | 'nome-desc' | 'itens' | 'dias'>('nome-asc')
const sortOptions = [
  { title: 'Nome A-Z', value: 'nome-asc' },
  { title: 'Nome Z-A', value: 'nome-desc' },
  { title: 'Mais itens', value: 'itens' },
  { title: 'Mais dias vinculados', value: 'dias' },
]
const view = ref<'list' | 'grid'>('list')

async function load(): Promise<void> {
  loading.value = true
  try {
    refeicoes.value = await refeicoesApi.listRefeicoes()
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível carregar as refeições.'))
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  const list = refeicoes.value.filter((refeicao) => !term || refeicao.nome.toLowerCase().includes(term))

  return [...list].sort((a, b) => {
    if (sortBy.value === 'nome-asc') return a.nome.localeCompare(b.nome)
    if (sortBy.value === 'nome-desc') return b.nome.localeCompare(a.nome)
    if (sortBy.value === 'itens') return countItens(b) - countItens(a)
    return b.dates.length - a.dates.length
  })
})

async function createRefeicao(): Promise<void> {
  const nome = novoNome.value.trim()
  if (!nome) return

  creating.value = true
  try {
    const refeicao = await refeicoesApi.createRefeicao({ nome })
    router.push(`/alimentacao/${refeicao._id}`)
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível criar a refeição.'))
    creating.value = false
  }
}

function countItens(refeicao: Refeicao): number {
  return refeicao.blocos.reduce((total, bloco) => total + bloco.itens.length, 0)
}

function formatDates(refeicao: Refeicao): string {
  if (!refeicao.dates.length) return 'Sem data'
  if (refeicao.dates.length === 1) {
    const [y, m, d] = refeicao.dates[0].split('-')
    return `${d}/${m}/${y}`
  }
  return `${refeicao.dates.length} dias`
}

const deleteTarget = ref<Refeicao | null>(null)
const deleting = ref(false)

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await refeicoesApi.deleteRefeicao(deleteTarget.value._id)
    refeicoes.value = refeicoes.value.filter((item) => item._id !== deleteTarget.value!._id)
    deleteTarget.value = null
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível excluir a refeição.'))
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Alimentação" subtitle="Organize planos de refeição e vincule aos dias do calendário.">
      <template #actions>
        <VBtn color="primary" size="small" prepend-icon="mdi-plus" @click="createDialog = true">
          Nova refeição
        </VBtn>
      </template>
    </PageHeader>

    <VCard class="mb-4">
      <VCardText class="d-flex flex-wrap align-center ga-3">
        <VTextField
          v-model="search"
          placeholder="Buscar refeições..."
          prepend-inner-icon="mdi-magnify"
          hide-details
          density="compact"
          maxlength="120"
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
        <div class="empty-state__icon"><VIcon icon="mdi-food-apple-outline" size="34" color="primary" /></div>
        <p class="text-h6 font-weight-bold mt-4">
          {{ search ? 'Nenhuma refeição encontrada' : 'Crie sua primeira refeição' }}
        </p>
        <p class="text-body-2 text-medium-emphasis mt-1">
          {{
            search
              ? `Nenhuma refeição corresponde a "${search}".`
              : 'Comece adicionando uma refeição para organizar sua alimentação.'
          }}
        </p>
        <VBtn v-if="!search" color="primary" class="mt-4" prepend-icon="mdi-plus" @click="createDialog = true">
          Nova refeição
        </VBtn>
      </VCardText>
    </VCard>

    <div v-else-if="view === 'list'">
      <VCard v-for="refeicao in filtered" :key="refeicao._id" class="mb-3 refeicao-row">
        <VCardText class="d-flex align-center ga-4 flex-wrap">
          <RouterLink :to="`/alimentacao/${refeicao._id}`" class="refeicao-icon">
            <VIcon icon="mdi-food-apple-outline" size="24" color="primary" />
          </RouterLink>

          <RouterLink :to="`/alimentacao/${refeicao._id}`" class="refeicao-info">
            <p class="font-weight-bold">{{ refeicao.nome }}</p>
            <p class="text-body-2 text-medium-emphasis">{{ countItens(refeicao) }} item(ns)</p>
          </RouterLink>

          <VSpacer />

          <div class="refeicao-stat">
            <div>
              <p class="refeicao-stat__value">Dias</p>
              <p class="refeicao-stat__label">{{ formatDates(refeicao) }}</p>
            </div>
          </div>

          <VBtn icon="mdi-pencil-outline" variant="text" size="small" :to="`/alimentacao/${refeicao._id}`" />
          <VBtn icon="mdi-trash-can-outline" variant="text" size="small" color="error" @click="deleteTarget = refeicao" />
        </VCardText>
      </VCard>
    </div>

    <div v-else class="refeicao-grid">
      <VCard v-for="refeicao in filtered" :key="refeicao._id" class="refeicao-card">
        <VCardText>
          <div class="d-flex align-center justify-space-between mb-3">
            <RouterLink :to="`/alimentacao/${refeicao._id}`" class="refeicao-icon">
              <VIcon icon="mdi-food-apple-outline" size="24" color="primary" />
            </RouterLink>
            <div>
              <VBtn icon="mdi-pencil-outline" variant="text" size="small" :to="`/alimentacao/${refeicao._id}`" />
              <VBtn icon="mdi-trash-can-outline" variant="text" size="small" color="error" @click="deleteTarget = refeicao" />
            </div>
          </div>

          <RouterLink :to="`/alimentacao/${refeicao._id}`" class="refeicao-info">
            <p class="font-weight-bold">{{ refeicao.nome }}</p>
            <p class="text-body-2 text-medium-emphasis mb-3">{{ countItens(refeicao) }} item(ns)</p>
          </RouterLink>

          <div class="text-caption text-medium-emphasis">{{ formatDates(refeicao) }}</div>
        </VCardText>
      </VCard>
    </div>

    <VDialog v-model="createDialog" max-width="420">
      <VCard>
        <VCardTitle>Nova refeição</VCardTitle>
        <VCardText>
          <VForm @submit.prevent="createRefeicao">
            <VTextField v-model="novoNome" label="Nome" maxlength="120" autofocus />
          </VForm>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="createDialog = false">Cancelar</VBtn>
          <VBtn color="primary" :loading="creating" :disabled="!novoNome.trim()" @click="createRefeicao">
            Criar
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog :model-value="!!deleteTarget" max-width="400" @update:model-value="deleteTarget = null">
      <VCard v-if="deleteTarget">
        <VCardTitle>Excluir refeição</VCardTitle>
        <VCardText>Tem certeza que deseja excluir "{{ deleteTarget.nome }}"?</VCardText>
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
.refeicao-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.refeicao-info {
  color: inherit;
  text-decoration: none;
  min-width: 0;
}

.refeicao-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 80px;
}

.refeicao-stat__value {
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.2;
}

.refeicao-stat__label {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.refeicao-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
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
