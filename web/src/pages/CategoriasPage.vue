<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import * as categoriasApi from '../api/categorias'
import * as exerciciosApi from '../api/exercicios'
import type { Categoria, Exercicio } from '../types/workout'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'

const snackbar = useSnackbar()

const categorias = ref<Categoria[]>([])
const exercicios = ref<Exercicio[]>([])
const loading = ref(true)
const search = ref('')
const sortBy = ref<'ordem' | 'nome-asc' | 'nome-desc' | 'exercicios'>('ordem')
const sortOptions = [
  { title: 'Ordem manual', value: 'ordem' },
  { title: 'Nome A-Z', value: 'nome-asc' },
  { title: 'Nome Z-A', value: 'nome-desc' },
  { title: 'Mais exercícios', value: 'exercicios' },
]
const view = ref<'list' | 'grid'>('list')

const ICON_COLOR = '#15b580'

async function load(): Promise<void> {
  loading.value = true
  try {
    const [categoriasData, exerciciosData] = await Promise.all([
      categoriasApi.listCategorias(),
      exerciciosApi.listExercicios(),
    ])
    categorias.value = categoriasData
    exercicios.value = exerciciosData
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível carregar as categorias.'))
  } finally {
    loading.value = false
  }
}

onMounted(load)

function countFor(categoriaId: string): number {
  return exercicios.value.filter((exercicio) => exercicio.categoriaId === categoriaId).length
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  const list = categorias.value.filter((categoria) => !term || categoria.nome.toLowerCase().includes(term))

  return [...list].sort((a, b) => {
    if (sortBy.value === 'nome-asc') return a.nome.localeCompare(b.nome)
    if (sortBy.value === 'nome-desc') return b.nome.localeCompare(a.nome)
    if (sortBy.value === 'exercicios') return countFor(b._id) - countFor(a._id)
    return (a.ordem ?? 0) - (b.ordem ?? 0)
  })
})

// Create / edit dialog
const dialogOpen = ref(false)
const editingId = ref<string | null>(null)
const form = reactive({ nome: '', descricao: '' })
const saving = ref(false)

function openCreate(): void {
  editingId.value = null
  form.nome = ''
  form.descricao = ''
  dialogOpen.value = true
}

function openEdit(categoria: Categoria): void {
  editingId.value = categoria._id
  form.nome = categoria.nome
  form.descricao = categoria.descricao ?? ''
  dialogOpen.value = true
}

async function submitForm(): Promise<void> {
  const nome = form.nome.trim()
  if (!nome) return

  saving.value = true
  try {
    const descricao = form.descricao.trim() || undefined
    if (editingId.value) {
      const updated = await categoriasApi.updateCategoria(editingId.value, { nome, descricao })
      const index = categorias.value.findIndex((item) => item._id === updated._id)
      if (index !== -1) categorias.value[index] = updated
    } else {
      const created = await categoriasApi.createCategoria({ nome, descricao })
      categorias.value.push(created)
    }
    dialogOpen.value = false
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível salvar a categoria.'))
  } finally {
    saving.value = false
  }
}

// Delete
const deleteTarget = ref<Categoria | null>(null)
const deleting = ref(false)

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await categoriasApi.deleteCategoria(deleteTarget.value._id)
    categorias.value = categorias.value.filter((item) => item._id !== deleteTarget.value!._id)
    deleteTarget.value = null
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível excluir a categoria.'))
  } finally {
    deleting.value = false
  }
}

</script>

<template>
  <div>
    <PageHeader title="Categorias" subtitle="Organize e gerencie as categorias de exercícios do seu app.">
      <template #actions>
        <VBtn color="primary" size="small" prepend-icon="mdi-plus" @click="openCreate">Nova categoria</VBtn>
      </template>
    </PageHeader>

    <VCard class="mb-4">
      <VCardText class="d-flex flex-wrap align-center ga-3">
        <VTextField
          v-model="search"
          placeholder="Buscar categoria..."
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
        <div class="empty-state__icon"><VIcon icon="mdi-arm-flex-outline" size="34" color="primary" /></div>
        <p class="text-h6 font-weight-bold mt-4">
          {{ search ? 'Nenhuma categoria encontrada' : 'Crie sua primeira categoria' }}
        </p>
        <p class="text-body-2 text-medium-emphasis mt-1">
          {{
            search
              ? `Nenhuma categoria corresponde a "${search}".`
              : 'Comece adicionando uma categoria para organizar seus exercícios.'
          }}
        </p>
        <VBtn v-if="!search" color="primary" class="mt-4" prepend-icon="mdi-plus" @click="openCreate">
          Nova categoria
        </VBtn>
      </VCardText>
    </VCard>

    <VCard v-else-if="view === 'list'">
      <VList lines="two">
        <VListItem v-for="categoria in filtered" :key="categoria._id">
          <template #prepend>
            <div class="categoria-icon mr-3" :style="{ background: `${ICON_COLOR}26` }">
              <VIcon icon="mdi-arm-flex-outline" size="20" :color="ICON_COLOR" />
            </div>
          </template>

          <VListItemTitle class="font-weight-bold">{{ categoria.nome }}</VListItemTitle>
          <VListItemSubtitle v-if="categoria.descricao">{{ categoria.descricao }}</VListItemSubtitle>

          <template #append>
            <VChip size="small" variant="tonal" class="mr-3">
              {{ countFor(categoria._id) }} exercício{{ countFor(categoria._id) === 1 ? '' : 's' }}
            </VChip>
            <VBtn icon="mdi-pencil-outline" variant="text" size="small" @click="openEdit(categoria)" />
            <VBtn icon="mdi-trash-can-outline" variant="text" size="small" color="error" @click="deleteTarget = categoria" />
          </template>
        </VListItem>
      </VList>
    </VCard>

    <div v-else class="categoria-grid">
      <VCard v-for="categoria in filtered" :key="categoria._id" class="categoria-card">
        <VCardText>
          <div class="d-flex align-center justify-space-between mb-3">
            <div class="categoria-icon" :style="{ background: `${ICON_COLOR}26` }">
              <VIcon icon="mdi-arm-flex-outline" size="20" :color="ICON_COLOR" />
            </div>
            <div>
              <VBtn icon="mdi-pencil-outline" variant="text" size="small" @click="openEdit(categoria)" />
              <VBtn icon="mdi-trash-can-outline" variant="text" size="small" color="error" @click="deleteTarget = categoria" />
            </div>
          </div>

          <p class="font-weight-bold">{{ categoria.nome }}</p>
          <p v-if="categoria.descricao" class="text-body-2 text-medium-emphasis mb-3">{{ categoria.descricao }}</p>

          <VChip size="small" variant="tonal">
            {{ countFor(categoria._id) }} exercício{{ countFor(categoria._id) === 1 ? '' : 's' }}
          </VChip>
        </VCardText>
      </VCard>
    </div>

    <VDialog v-model="dialogOpen" max-width="440">
      <VCard>
        <VCardTitle>{{ editingId ? 'Editar categoria' : 'Nova categoria' }}</VCardTitle>
        <VCardText>
          <VForm class="d-flex flex-column ga-4" @submit.prevent="submitForm">
            <VTextField v-model="form.nome" label="Nome" maxlength="120" autofocus />
            <VTextarea v-model="form.descricao" label="Descrição (opcional)" maxlength="200" counter rows="2" auto-grow />
          </VForm>
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="dialogOpen = false">Cancelar</VBtn>
          <VBtn color="primary" :loading="saving" :disabled="!form.nome.trim()" @click="submitForm">
            {{ editingId ? 'Salvar' : 'Criar' }}
          </VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog :model-value="!!deleteTarget" max-width="400" @update:model-value="deleteTarget = null">
      <VCard v-if="deleteTarget">
        <VCardTitle>Excluir categoria</VCardTitle>
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
.categoria-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.categoria-grid {
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
