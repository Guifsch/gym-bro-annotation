<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
const sortBy = ref<'ordem' | 'nome-asc' | 'nome-desc'>('ordem')
const sortOptions = [
  { title: 'Ordem manual', value: 'ordem' },
  { title: 'Nome A-Z', value: 'nome-asc' },
  { title: 'Nome Z-A', value: 'nome-desc' },
]
const view = ref<'list' | 'grid'>('list')
const canReorder = computed(() => sortBy.value === 'ordem')
const expandedIds = ref<Set<string>>(new Set())
const deleteTarget = ref<Exercicio | null>(null)
const deleting = ref(false)

const draggedId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)
const dragHandleId = ref<string | null>(null)

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
    expandedIds.value = new Set(categoriasData.map((c) => c._id))
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível carregar os exercícios.'))
  } finally {
    loading.value = false
  }
}

onMounted(load)

function matchesSearch(exercicio: Exercicio): boolean {
  const term = search.value.trim().toLowerCase()
  if (!term) return true
  return exercicio.nome.toLowerCase().includes(term)
}

function sortExercicios(list: Exercicio[]): Exercicio[] {
  return [...list].sort((a, b) => {
    if (sortBy.value === 'nome-asc') return a.nome.localeCompare(b.nome)
    if (sortBy.value === 'nome-desc') return b.nome.localeCompare(a.nome)
    return (a.ordem ?? 0) - (b.ordem ?? 0)
  })
}

const grupos = computed(() =>
  categorias.value
    .map((categoria) => ({
      categoria,
      color: ICON_COLOR,
      exercicios: sortExercicios(
        exercicios.value.filter((exercicio) => exercicio.categoriaId === categoria._id && matchesSearch(exercicio))
      ),
    }))
    .filter((grupo) => grupo.exercicios.length > 0)
)

const semCategoria = computed(() => {
  const categoriaIds = new Set(categorias.value.map((c) => c._id))
  return exercicios.value.filter((exercicio) => !categoriaIds.has(exercicio.categoriaId) && matchesSearch(exercicio))
})

const noResults = computed(
  () => !loading.value && !!search.value.trim() && !grupos.value.length && !semCategoria.value.length
)

function toggleExpanded(categoriaId: string): void {
  const next = new Set(expandedIds.value)
  if (next.has(categoriaId)) next.delete(categoriaId)
  else next.add(categoriaId)
  expandedIds.value = next
}

interface SubstitutoRef {
  id: string
  nome: string
}

const substitutosDisplayById = computed(() => {
  const map = new Map<string, Map<string, SubstitutoRef>>()
  const nomeDe = (id: string) => exercicios.value.find((e) => e._id === id)?.nome

  function add(ownerId: string, ref: SubstitutoRef): void {
    if (!map.has(ownerId)) map.set(ownerId, new Map())
    map.get(ownerId)!.set(ref.id, ref)
  }

  for (const exercicio of exercicios.value) {
    for (const subId of exercicio.substitutoIds) {
      const subNome = nomeDe(subId)
      if (subNome) add(exercicio._id, { id: subId, nome: subNome })
      add(subId, { id: exercicio._id, nome: exercicio.nome })
    }
  }
  return map
})

function substitutosDe(id: string): SubstitutoRef[] {
  return [...(substitutosDisplayById.value.get(id)?.values() ?? [])]
}

function onDragStart(exercicio: Exercicio, event: DragEvent): void {
  draggedId.value = exercicio._id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', exercicio._id)
  }
}

function onDragEnd(): void {
  draggedId.value = null
  dragOverId.value = null
  dragHandleId.value = null
}

function onDrop(target: Exercicio, groupExercicios: Exercicio[]): void {
  const sourceId = draggedId.value
  dragOverId.value = null
  draggedId.value = null
  if (!sourceId || sourceId === target._id) return

  const dragged = exercicios.value.find((e) => e._id === sourceId)
  if (!dragged) return

  const others = groupExercicios.filter((e) => e._id !== sourceId)
  const targetIndex = others.findIndex((e) => e._id === target._id)
  const prev = others[targetIndex - 1]
  const next = others[targetIndex]

  let newOrdem: number
  if (prev && next) newOrdem = ((prev.ordem ?? 0) + (next.ordem ?? 0)) / 2
  else if (!prev && next) newOrdem = (next.ordem ?? 0) - 1
  else if (prev && !next) newOrdem = (prev.ordem ?? 0) + 1
  else newOrdem = Date.now()

  dragged.ordem = newOrdem

  exerciciosApi.reorderExercicio(sourceId, newOrdem).catch((error) => {
    snackbar.error(extractErrorMessage(error, 'Não foi possível reordenar o exercício.'))
  })
}

async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await exerciciosApi.deleteExercicio(deleteTarget.value._id)
    exercicios.value = exercicios.value.filter((item) => item._id !== deleteTarget.value!._id)
    deleteTarget.value = null
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível excluir o exercício.'))
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Exercícios" subtitle="Gerencie seus exercícios por grupo muscular.">
      <template #actions>
        <VBtn color="primary" size="small" prepend-icon="mdi-plus" to="/exercicios/novo">Novo exercício</VBtn>
      </template>
    </PageHeader>

    <VCard class="mb-4">
      <VCardText class="d-flex flex-wrap align-center ga-3">
        <VTextField
          v-model="search"
          placeholder="Buscar exercício..."
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

    <template v-else>
      <VCard v-if="!exercicios.length">
        <VCardText class="text-medium-emphasis text-body-2">Nenhum exercício cadastrado ainda.</VCardText>
      </VCard>
      <VCard v-else-if="noResults">
        <VCardText class="text-medium-emphasis text-body-2">
          Nenhum exercício encontrado para "{{ search }}".
        </VCardText>
      </VCard>

      <VCard v-for="grupo in grupos" :key="grupo.categoria._id" class="mb-3 grupo-card">
        <button type="button" class="grupo-header" @click="toggleExpanded(grupo.categoria._id)">
          <span class="grupo-header__icon" :style="{ background: grupo.color }">
            <VIcon icon="mdi-dumbbell" size="16" color="white" />
          </span>
          <span class="grupo-header__nome">{{ grupo.categoria.nome }}</span>
          <VChip size="x-small" variant="tonal" class="ml-2">
            {{ grupo.exercicios.length }} exercício{{ grupo.exercicios.length === 1 ? '' : 's' }}
          </VChip>
          <VSpacer />
          <VIcon
            icon="mdi-chevron-down"
            class="grupo-header__chevron"
            :class="{ 'grupo-header__chevron--open': expandedIds.has(grupo.categoria._id) }"
          />
        </button>

        <VExpandTransition>
          <VList v-if="expandedIds.has(grupo.categoria._id) && view === 'list'">
            <VListItem
              v-for="exercicio in grupo.exercicios"
              :key="exercicio._id"
              class="exercicio-row"
              :class="{ 'exercicio-row--over': dragOverId === exercicio._id }"
              :draggable="canReorder && dragHandleId === exercicio._id"
              @dragstart="onDragStart(exercicio, $event)"
              @dragend="onDragEnd"
              @dragover.prevent
              @dragenter.prevent="dragOverId = exercicio._id"
              @drop.prevent="onDrop(exercicio, grupo.exercicios)"
            >
              <template #prepend>
                <VIcon
                  icon="mdi-drag-vertical"
                  class="drag-handle"
                  :class="{ 'drag-handle--disabled': !canReorder }"
                  size="30"
                  @mousedown="canReorder && (dragHandleId = exercicio._id)"
                  @mouseup="dragHandleId = null"
                />
                <VAvatar rounded="lg" size="100" class="mx-2">
                  <VImg v-if="exercicio.capa" :src="exercicio.capa.url" cover />
                  <VIcon v-else icon="mdi-dumbbell" size="36" />
                </VAvatar>
              </template>

              <RouterLink :to="`/exercicios/${exercicio._id}`" class="exercicio-row__link">
                <VListItemTitle class="font-weight-medium">{{ exercicio.nome }}</VListItemTitle>
                <VListItemSubtitle>{{ exercicio.sets }}x{{ exercicio.reps }} · {{ exercicio.pesoKg }}kg</VListItemSubtitle>
              </RouterLink>

              <div v-if="substitutosDe(exercicio._id).length" class="substitutos-row" draggable="false">
                <VIcon icon="mdi-swap-horizontal-bold" size="16" color="warning" />
                <span class="substitutos-row__label">Substitutos:</span>
                <VChip
                  v-for="sub in substitutosDe(exercicio._id)"
                  :key="sub.id"
                  size="small"
                  color="warning"
                  variant="tonal"
                  class="substitutos-row__chip"
                  :to="`/exercicios/${sub.id}`"
                  link
                >
                  {{ sub.nome }}
                </VChip>
              </div>

              <template #append>
                <VChip variant="tonal" class="mr-2 exercicio-stat-chip">{{ exercicio.sets }} séries</VChip>
                <VChip variant="tonal" class="mr-2 exercicio-stat-chip">{{ exercicio.reps }} reps</VChip>
                <VChip
                  variant="tonal"
                  class="mr-3 exercicio-stat-chip"
                  :style="{ color: grupo.color }"
                >
                  {{ exercicio.pesoKg }} kg
                </VChip>
                <VBtn icon="mdi-pencil-outline" variant="text" size="small" :to="`/exercicios/${exercicio._id}`" />
                <VBtn
                  icon="mdi-trash-can-outline"
                  variant="text"
                  size="small"
                  color="error"
                  @click="deleteTarget = exercicio"
                />
              </template>
            </VListItem>
          </VList>
          <div v-else-if="expandedIds.has(grupo.categoria._id)" class="exercicio-grid pa-4">
            <VCard v-for="exercicio in grupo.exercicios" :key="exercicio._id" variant="outlined" class="exercicio-card">
              <RouterLink :to="`/exercicios/${exercicio._id}`" class="exercicio-card__link">
                <VImg v-if="exercicio.capa" :src="exercicio.capa.url" aspect-ratio="1" cover />
                <div v-else class="exercicio-card__placeholder">
                  <VIcon icon="mdi-dumbbell" size="32" />
                </div>
              </RouterLink>
              <VCardText>
                <RouterLink :to="`/exercicios/${exercicio._id}`" class="exercicio-card__link">
                  <p class="font-weight-medium">{{ exercicio.nome }}</p>
                  <p class="text-body-2 text-medium-emphasis mb-3">
                    {{ exercicio.sets }}x{{ exercicio.reps }} · {{ exercicio.pesoKg }}kg
                  </p>
                </RouterLink>
                <div class="d-flex justify-space-between">
                  <VBtn icon="mdi-pencil-outline" variant="text" size="small" :to="`/exercicios/${exercicio._id}`" />
                  <VBtn
                    icon="mdi-trash-can-outline"
                    variant="text"
                    size="small"
                    color="error"
                    @click="deleteTarget = exercicio"
                  />
                </div>
              </VCardText>
            </VCard>
          </div>
        </VExpandTransition>
      </VCard>

      <VCard v-if="semCategoria.length" class="mb-3">
        <VCardTitle>Sem categoria</VCardTitle>
        <VList>
          <VListItem v-for="exercicio in semCategoria" :key="exercicio._id" :to="`/exercicios/${exercicio._id}`">
            <VListItemTitle>{{ exercicio.nome }}</VListItemTitle>
          </VListItem>
        </VList>
      </VCard>
    </template>

    <VDialog :model-value="!!deleteTarget" max-width="400" @update:model-value="deleteTarget = null">
      <VCard v-if="deleteTarget">
        <VCardTitle>Excluir exercício</VCardTitle>
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
.grupo-card {
  overflow: hidden;
}

.grupo-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.grupo-header__icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.grupo-header__nome {
  font-weight: 700;
  font-size: 0.95rem;
}

.grupo-header__chevron {
  transition: transform 0.2s ease;
}

.grupo-header__chevron--open {
  transform: rotate(180deg);
}

.exercicio-stat-chip :deep(.v-chip__content) {
  font-size: 1rem;
}

.substitutos-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.substitutos-row__label {
  font-size: 0.9rem;
  font-weight: 700;
  color: rgb(var(--v-theme-warning));
}

.substitutos-row__chip :deep(.v-chip__content) {
  font-size: 0.85rem;
}

.exercicio-row {
  cursor: grab;
  padding-top: 12px;
  padding-bottom: 12px;
  gap: 10px;
}

.exercicio-row:active {
  cursor: grabbing;
}

.exercicio-row--over {
  box-shadow: inset 0 2px 0 rgb(var(--v-theme-primary));
}

.drag-handle {
  cursor: grab;
  color: rgba(var(--v-theme-on-surface), 0.35);
}

.exercicio-row__link {
  color: inherit;
  text-decoration: none;
  display: block;
  min-width: 0;
}
</style>
