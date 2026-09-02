<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import * as sessoesApi from '../api/sessoes'
import * as treinosApi from '../api/treinos'
import * as exerciciosApi from '../api/exercicios'
import * as categoriasApi from '../api/categorias'
import type { Categoria, Exercicio, Sessao, Treino } from '../types/workout'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'
import { clampMaxValue, maxValueRule } from '../utils/numberField'

const props = defineProps<{ date: string; sessaoId: string }>()
const snackbar = useSnackbar()

const loading = ref(true)
const notFound = ref(false)
const sessao = ref<Sessao | null>(null)
const treino = ref<Treino | null>(null)
const exercicios = ref<Exercicio[]>([])
const categorias = ref<Categoria[]>([])

const draft = reactive<Record<string, { sets: string; reps: string; pesoKg: string }>>({})
const saving = ref<Record<string, boolean>>({})
const expandedIds = ref<Set<string>>(new Set())

const search = ref('')
const sortBy = ref<'ordem' | 'nome-asc' | 'nome-desc'>('ordem')
const sortOptions = [
  { title: 'Ordem', value: 'ordem' },
  { title: 'Nome A-Z', value: 'nome-asc' },
  { title: 'Nome Z-A', value: 'nome-desc' },
]
const view = ref<'list' | 'grid'>('list')

function toggleExpanded(categoriaId: string): void {
  const next = new Set(expandedIds.value)
  if (next.has(categoriaId)) next.delete(categoriaId)
  else next.add(categoriaId)
  expandedIds.value = next
}

function entryFor(exercicioId: string) {
  return sessao.value?.entries.find((entry) => entry.exercicioId === exercicioId)
}

function initDraft(): void {
  for (const exercicio of exercicios.value) {
    const entry = entryFor(exercicio._id)
    draft[exercicio._id] = {
      sets: String(entry?.sets ?? exercicio.sets ?? 0),
      reps: String(entry?.reps ?? exercicio.reps ?? 0),
      pesoKg: String(entry?.pesoKg ?? exercicio.pesoKg ?? 0),
    }
  }
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const sessaoData = await sessoesApi.getSessao(props.sessaoId)
    const [treinoData, exerciciosData, categoriasData] = await Promise.all([
      treinosApi.getTreino(sessaoData.treinoId),
      exerciciosApi.listExercicios(),
      categoriasApi.listCategorias(),
    ])
    sessao.value = sessaoData
    treino.value = treinoData
    exercicios.value = exerciciosData.filter((exercicio) => treinoData.exercicioIds.includes(exercicio._id))
    categorias.value = categoriasData
    expandedIds.value = new Set(categoriasData.map((c) => c._id))
    initDraft()
  } catch (error) {
    notFound.value = true
    snackbar.error(extractErrorMessage(error, 'Não foi possível carregar a sessão.'))
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
  if (sortBy.value === 'nome-asc') return [...list].sort((a, b) => a.nome.localeCompare(b.nome))
  if (sortBy.value === 'nome-desc') return [...list].sort((a, b) => b.nome.localeCompare(a.nome))
  return list
}

const grupos = computed(() =>
  categorias.value
    .map((categoria) => ({
      categoria,
      exercicios: sortExercicios(
        exercicios.value.filter((exercicio) => exercicio.categoriaId === categoria._id && matchesSearch(exercicio))
      ),
    }))
    .filter((grupo) => grupo.exercicios.length > 0)
)

const noResults = computed(() => !loading.value && !!search.value.trim() && !grupos.value.length)

async function salvarEntry(exercicioId: string): Promise<void> {
  const values = draft[exercicioId]
  if (!values) return

  saving.value[exercicioId] = true
  try {
    const { sessao: updated } = await sessoesApi.upsertSessaoEntry({
      sessaoId: props.sessaoId,
      exercicioId,
      sets: Number(values.sets) || 0,
      reps: Number(values.reps) || 0,
      pesoKg: Number(values.pesoKg) || 0,
    })
    sessao.value = updated
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível salvar o registro.'))
  } finally {
    saving.value[exercicioId] = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="treino?.nome ?? 'Sessão'" :back="`/calendario/${date}`" />

    <div v-if="loading" class="text-center py-10">
      <VProgressCircular indeterminate />
    </div>

    <VCard v-else-if="notFound">
      <VCardText class="text-center py-10">
        <p class="text-medium-emphasis text-body-2 mb-4">Esta sessão foi removida.</p>
        <VBtn color="primary" :to="`/calendario/${date}`">Voltar para o dia</VBtn>
      </VCardText>
    </VCard>

    <template v-else>
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

      <VCard v-if="noResults">
        <VCardText class="text-medium-emphasis text-body-2">
          Nenhum exercício encontrado para "{{ search }}".
        </VCardText>
      </VCard>

      <VCard v-for="grupo in grupos" :key="grupo.categoria._id" class="mb-3 grupo-card">
        <button type="button" class="grupo-header" @click="toggleExpanded(grupo.categoria._id)">
          <span class="grupo-header__icon"><VIcon icon="mdi-arm-flex-outline" size="16" color="white" /></span>
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
          <div v-if="expandedIds.has(grupo.categoria._id)">
            <p v-if="grupo.categoria.descricao" class="text-hint px-5 mb-3">{{ grupo.categoria.descricao }}</p>

            <VList v-if="view === 'list'">
              <VListItem
                v-for="exercicio in grupo.exercicios"
                :key="exercicio._id"
                :to="`/calendario/${date}/${sessaoId}/${exercicio._id}`"
                class="sessao-exercicio-row"
              >
                <template #prepend>
                  <VAvatar rounded="lg" size="100" class="mx-2">
                    <VImg v-if="exercicio.capa" :src="exercicio.capa.url" cover />
                    <VIcon v-else icon="mdi-dumbbell" size="36" />
                  </VAvatar>
                </template>

                <VListItemTitle class="font-weight-medium">{{ exercicio.nome }}</VListItemTitle>

                <template #append>
                  <div class="d-flex align-end ga-3" @click.stop.prevent>
                    <div class="sessao-field">
                      <label class="sessao-field__label">Sets</label>
                      <VTextField
                        v-model="draft[exercicio._id].sets"
                        type="number"
                        density="compact"
                        hide-details="auto"
                        :rules="[maxValueRule(50)]"
                        @blur="draft[exercicio._id].sets = clampMaxValue(draft[exercicio._id].sets, 50)"
                      />
                    </div>
                    <div class="sessao-field">
                      <label class="sessao-field__label">Reps</label>
                      <VTextField
                        v-model="draft[exercicio._id].reps"
                        type="number"
                        density="compact"
                        hide-details="auto"
                        :rules="[maxValueRule(500)]"
                        @blur="draft[exercicio._id].reps = clampMaxValue(draft[exercicio._id].reps, 500)"
                      />
                    </div>
                    <div class="sessao-field">
                      <label class="sessao-field__label">Kg</label>
                      <VTextField
                        v-model="draft[exercicio._id].pesoKg"
                        type="number"
                        density="compact"
                        hide-details="auto"
                        :rules="[maxValueRule(1000)]"
                        @blur="draft[exercicio._id].pesoKg = clampMaxValue(draft[exercicio._id].pesoKg, 1000)"
                      />
                    </div>
                    <VBtn
                      icon="mdi-content-save-outline"
                      variant="tonal"
                      color="primary"
                      size="small"
                      :loading="saving[exercicio._id]"
                      @click="salvarEntry(exercicio._id)"
                    />
                  </div>
                  <VIcon icon="mdi-chevron-right" class="ml-3 mt-4" color="rgba(var(--v-theme-on-surface), 0.4)" />
                </template>
              </VListItem>
            </VList>

            <div v-else class="sessao-grid pa-4">
              <VCard v-for="exercicio in grupo.exercicios" :key="exercicio._id" variant="outlined" class="sessao-card">
                <RouterLink :to="`/calendario/${date}/${sessaoId}/${exercicio._id}`" class="sessao-card__link">
                  <VImg v-if="exercicio.capa" :src="exercicio.capa.url" aspect-ratio="1" cover class="sessao-card__img" />
                  <div v-else class="sessao-card__placeholder">
                    <VIcon icon="mdi-dumbbell" size="34" />
                  </div>
                </RouterLink>
                <VCardText class="sessao-card__body">
                  <RouterLink :to="`/calendario/${date}/${sessaoId}/${exercicio._id}`" class="sessao-card__link">
                    <p class="font-weight-medium sessao-card__nome">{{ exercicio.nome }}</p>
                  </RouterLink>

                  <div class="d-flex ga-2 mt-3" @click.stop.prevent>
                    <div class="sessao-field">
                      <label class="sessao-field__label">Sets</label>
                      <VTextField
                        v-model="draft[exercicio._id].sets"
                        type="number"
                        density="compact"
                        hide-details="auto"
                        :rules="[maxValueRule(50)]"
                        @blur="draft[exercicio._id].sets = clampMaxValue(draft[exercicio._id].sets, 50)"
                      />
                    </div>
                    <div class="sessao-field">
                      <label class="sessao-field__label">Reps</label>
                      <VTextField
                        v-model="draft[exercicio._id].reps"
                        type="number"
                        density="compact"
                        hide-details="auto"
                        :rules="[maxValueRule(500)]"
                        @blur="draft[exercicio._id].reps = clampMaxValue(draft[exercicio._id].reps, 500)"
                      />
                    </div>
                    <div class="sessao-field">
                      <label class="sessao-field__label">Kg</label>
                      <VTextField
                        v-model="draft[exercicio._id].pesoKg"
                        type="number"
                        density="compact"
                        hide-details="auto"
                        :rules="[maxValueRule(1000)]"
                        @blur="draft[exercicio._id].pesoKg = clampMaxValue(draft[exercicio._id].pesoKg, 1000)"
                      />
                    </div>
                  </div>

                  <VBtn
                    block
                    variant="tonal"
                    color="primary"
                    size="small"
                    class="mt-3"
                    prepend-icon="mdi-content-save-outline"
                    :loading="saving[exercicio._id]"
                    @click.stop.prevent="salvarEntry(exercicio._id)"
                  >
                    Salvar
                  </VBtn>
                </VCardText>
              </VCard>
            </div>
          </div>
        </VExpandTransition>
      </VCard>

      <VCard v-if="!grupos.length && !search.trim()">
        <VCardText class="text-medium-emphasis text-body-2">Este treino ainda não tem exercícios vinculados.</VCardText>
      </VCard>
    </template>
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
  background: rgb(var(--v-theme-primary));
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

.sessao-exercicio-row {
  padding-top: 12px;
  padding-bottom: 12px;
}

.sessao-field {
  width: 76px;
}

.sessao-field__label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.55);
  margin-bottom: 4px;
  text-align: center;
}

.sessao-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.sessao-card {
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.sessao-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.sessao-card__link {
  display: block;
  color: inherit;
  text-decoration: none;
}

.sessao-card__img {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.sessao-card__placeholder {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgba(var(--v-theme-primary), 0.55);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.sessao-card__body {
  padding: 12px 14px;
}

.sessao-card__nome {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sessao-grid .sessao-field {
  width: auto;
  flex: 1 1 0;
}
</style>
