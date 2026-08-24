<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '../components/PageHeader.vue'
import * as treinosApi from '../api/treinos'
import * as categoriasApi from '../api/categorias'
import * as exerciciosApi from '../api/exercicios'
import type { Categoria, Exercicio, Treino } from '../types/workout'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'

const props = defineProps<{ id: string }>()
const router = useRouter()
const snackbar = useSnackbar()

const treino = ref<Treino | null>(null)
const categorias = ref<Categoria[]>([])
const exercicios = ref<Exercicio[]>([])
const loading = ref(true)

const nome = ref('')
const savingNome = ref(false)
const cloning = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)
const togglingId = ref<string | null>(null)

const grupos = computed(() =>
  categorias.value
    .map((categoria) => ({
      categoria,
      exercicios: exercicios.value.filter((exercicio) => exercicio.categoriaId === categoria._id),
    }))
    .filter((grupo) => grupo.exercicios.length > 0)
)

async function load(): Promise<void> {
  loading.value = true
  try {
    const [treinoData, categoriasData, exerciciosData] = await Promise.all([
      treinosApi.getTreino(props.id),
      categoriasApi.listCategorias(),
      exerciciosApi.listExercicios(),
    ])
    treino.value = treinoData
    nome.value = treinoData.nome
    categorias.value = categoriasData
    exercicios.value = exerciciosData
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível carregar o treino.'))
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function saveNome(): Promise<void> {
  if (!treino.value || !nome.value.trim()) return
  savingNome.value = true
  try {
    treino.value = await treinosApi.updateTreino(treino.value._id, { nome: nome.value.trim() })
    snackbar.success('Nome atualizado.')
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível salvar o nome.'))
  } finally {
    savingNome.value = false
  }
}

function isLinked(exercicioId: string): boolean {
  return treino.value?.exercicioIds.includes(exercicioId) ?? false
}

async function toggleExercicio(exercicioId: string): Promise<void> {
  if (!treino.value) return
  const current = treino.value.exercicioIds
  const next = current.includes(exercicioId)
    ? current.filter((id) => id !== exercicioId)
    : [...current, exercicioId]

  togglingId.value = exercicioId
  try {
    treino.value = await treinosApi.updateTreino(treino.value._id, { exercicioIds: next })
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível atualizar os exercícios do treino.'))
  } finally {
    togglingId.value = null
  }
}

async function cloneTreino(): Promise<void> {
  if (!treino.value) return
  cloning.value = true
  try {
    const clone = await treinosApi.cloneTreino(treino.value._id)
    router.push(`/treinos/${clone._id}`)
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível clonar o treino.'))
  } finally {
    cloning.value = false
  }
}

async function excluirTreino(): Promise<void> {
  if (!treino.value) return
  deleting.value = true
  try {
    await treinosApi.deleteTreino(treino.value._id)
    router.push('/treinos')
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível excluir o treino.'))
    deleting.value = false
  }
}
</script>

<template>
  <div v-if="loading" class="text-center py-10">
    <VProgressCircular indeterminate />
  </div>

  <div v-else-if="treino">
    <PageHeader title="Editar treino" back="/treinos">
      <template #actions>
        <VBtn variant="outlined" prepend-icon="mdi-content-copy" :loading="cloning" @click="cloneTreino">
          Clonar
        </VBtn>
        <VBtn variant="outlined" color="error" prepend-icon="mdi-trash-can-outline" @click="confirmDelete = true">
          Excluir
        </VBtn>
      </template>
    </PageHeader>

    <VCard class="mb-4">
      <VCardText>
        <VForm class="d-flex align-end ga-3" @submit.prevent="saveNome">
          <VTextField v-model="nome" label="Nome do treino" maxlength="50" hide-details class="field-w-lg" />
          <VBtn color="primary" type="submit" :loading="savingNome">Salvar</VBtn>
        </VForm>
      </VCardText>
    </VCard>

    <VCard>
      <VCardTitle class="d-flex align-center justify-space-between">
        Exercícios vinculados
        <VChip size="small" variant="tonal" color="primary">{{ treino.exercicioIds.length }}</VChip>
      </VCardTitle>
      <p class="text-hint px-6 mt-n2 mb-3">Selecione os exercícios que fazem parte deste treino.</p>
      <VCardText v-if="!grupos.length" class="text-medium-emphasis text-body-2">
        Nenhum exercício cadastrado ainda.
      </VCardText>
      <VCardText v-else>
        <div v-for="grupo in grupos" :key="grupo.categoria._id" class="mb-4">
          <p class="grupo-nome">{{ grupo.categoria.nome }}</p>
          <div
            v-for="exercicio in grupo.exercicios"
            :key="exercicio._id"
            class="exercicio-toggle-row"
            :class="{ 'exercicio-toggle-row--active': isLinked(exercicio._id) }"
            @click="toggleExercicio(exercicio._id)"
          >
            <VCheckboxBtn
              :model-value="isLinked(exercicio._id)"
              :loading="togglingId === exercicio._id"
              color="primary"
              readonly
            />
            <span class="exercicio-toggle-row__nome">{{ exercicio.nome }}</span>
            <VSpacer />
            <VIcon icon="mdi-chevron-right" size="18" class="exercicio-toggle-row__chevron" />
          </div>
        </div>
      </VCardText>
    </VCard>

    <VDialog v-model="confirmDelete" max-width="400">
      <VCard>
        <VCardTitle>Excluir treino</VCardTitle>
        <VCardText>
          Isso também remove todas as sessões do calendário vinculadas a este treino. Deseja continuar?
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="confirmDelete = false">Cancelar</VBtn>
          <VBtn color="error" :loading="deleting" @click="excluirTreino">Excluir</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
.grupo-nome {
  font-weight: 700;
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.exercicio-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 10px;
  padding: 4px 12px;
  margin-bottom: 6px;
  cursor: pointer;
}

.exercicio-toggle-row:hover {
  border-color: rgba(var(--v-theme-primary), 0.4);
}

.exercicio-toggle-row--active {
  border-color: rgba(var(--v-theme-primary), 0.4);
  background: rgba(var(--v-theme-primary), 0.06);
}

.exercicio-toggle-row__nome {
  font-size: 0.92rem;
}

.exercicio-toggle-row--active .exercicio-toggle-row__nome {
  color: rgb(var(--v-theme-primary));
  font-weight: 600;
}

.exercicio-toggle-row__chevron {
  color: rgba(var(--v-theme-on-surface), 0.35);
}
</style>
