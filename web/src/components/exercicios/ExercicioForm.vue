<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import * as exerciciosApi from '../../api/exercicios'
import * as sessoesApi from '../../api/sessoes'
import type { Categoria, Exercicio, SessaoEntry } from '../../types/workout'
import { useSnackbar } from '../../composables/useSnackbar'
import { extractErrorMessage } from '../../utils/errors'
import { clampMaxValue, maxValueRule } from '../../utils/numberField'
import SubstitutoPicker from './SubstitutoPicker.vue'
import VideoPreview from './VideoPreview.vue'
import HistoricoDialog from './HistoricoDialog.vue'

const props = defineProps<{
  mode: 'create' | 'edit'
  exercicio?: Exercicio | null
  categorias: Categoria[]
  exercicios: Exercicio[]
  sessaoContext?: { sessaoId: string; entry?: SessaoEntry | null } | null
}>()

const emit = defineEmits<{
  created: [Exercicio]
  updated: [Exercicio]
  deleted: []
}>()

const snackbar = useSnackbar()

const form = reactive({
  nome: '',
  descricao: '',
  cargaMaximaKg: '',
  sets: '',
  reps: '',
  pesoKg: '',
  categoriaId: '',
  substitutoIds: [] as string[],
})

const videoUrls = ref<string[]>([])
const novoVideoUrl = ref('')
const percentuaisOpen = ref<number | undefined>(undefined)

function hydrate(): void {
  const exercicio = props.exercicio
  const entry = props.sessaoContext?.entry

  form.nome = exercicio?.nome ?? ''
  form.descricao = exercicio?.descricao ?? ''
  form.cargaMaximaKg = exercicio?.cargaMaximaKg != null ? String(exercicio.cargaMaximaKg) : ''
  percentuaisOpen.value = exercicio?.cargaMaximaKg ? 0 : undefined
  form.sets = String(entry?.sets ?? exercicio?.sets ?? 0)
  form.reps = String(entry?.reps ?? exercicio?.reps ?? 0)
  form.pesoKg = String(entry?.pesoKg ?? exercicio?.pesoKg ?? 0)
  form.categoriaId = exercicio?.categoriaId ?? ''
  form.substitutoIds = exercicio?.substitutoIds ?? []
  videoUrls.value = exercicio?.videoUrls ?? []
}

watch(() => [props.exercicio, props.sessaoContext], hydrate, { immediate: true })

const saving = ref(false)
const cloning = ref(false)
const deleting = ref(false)
const confirmDelete = ref(false)
const historicoOpen = ref(false)

const stagedCapa = ref<File | null>(null)
const stagedCapaPreview = ref<string | null>(null)
const stagedImagens = ref<File[]>([])
const uploadingCapa = ref(false)
const uploadingImagem = ref(false)

const capaUrl = computed(() => stagedCapaPreview.value ?? props.exercicio?.capa?.url ?? null)

const previewUrl = ref<string | null>(null)
function openPreview(url: string): void {
  previewUrl.value = url
}

function removeStagedImagem(index: number): void {
  stagedImagens.value.splice(index, 1)
}

function objectUrl(file: File): string {
  return URL.createObjectURL(file)
}
const cargaMaximaNumero = computed(() => Number(form.cargaMaximaKg) || 0)

const percentuais = [
  { pct: 100, label: '1 rep' },
  { pct: 95, label: '2 reps' },
  { pct: 90, label: '4 reps' },
  { pct: 85, label: '6 reps' },
  { pct: 80, label: '8 reps' },
  { pct: 75, label: '10 reps' },
  { pct: 70, label: '12 reps' },
]

function buildPayload(): exerciciosApi.ExercicioParams {
  return {
    nome: form.nome.trim(),
    descricao: form.descricao.trim() || undefined,
    categoriaId: form.categoriaId,
    sets: Number(form.sets) || 0,
    reps: Number(form.reps) || 0,
    pesoKg: Number(form.pesoKg) || 0,
    cargaMaximaKg: form.cargaMaximaKg ? Number(form.cargaMaximaKg) : undefined,
    videoUrls: videoUrls.value,
    substitutoIds: form.substitutoIds,
  }
}

async function uploadStagedMedia(exercicioId: string): Promise<Exercicio> {
  let latest = props.exercicio!
  try {
    if (stagedCapa.value) {
      latest = await exerciciosApi.uploadExercicioCapa(exercicioId, stagedCapa.value)
    }
    for (const file of stagedImagens.value) {
      latest = await exerciciosApi.uploadExercicioImagem(exercicioId, file)
    }
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Exercício criado, mas houve um problema ao enviar as fotos.'))
  }
  return latest
}

async function submit(): Promise<void> {
  if (!form.nome.trim() || !form.categoriaId) {
    snackbar.error('Preencha nome e categoria antes de salvar.')
    return
  }

  saving.value = true
  try {
    if (props.mode === 'create') {
      let created = await exerciciosApi.createExercicio(buildPayload())
      if (stagedCapa.value || stagedImagens.value.length) {
        created = await uploadStagedMedia(created._id)
      }
      emit('created', created)
    } else if (props.exercicio) {
      const payload = buildPayload()
      if (props.sessaoContext) {
        // sets/reps/peso persist as a per-day override, not the exercicio's own default —
        // upsertSessaoEntry mirrors the change onto the exercicio default on its own.
        const { sets, reps, pesoKg, ...rest } = payload
        await sessoesApi.upsertSessaoEntry({
          sessaoId: props.sessaoContext.sessaoId,
          exercicioId: props.exercicio._id,
          sets,
          reps,
          pesoKg,
        })
        const updated = await exerciciosApi.updateExercicio(props.exercicio._id, rest)
        emit('updated', updated)
      } else {
        const updated = await exerciciosApi.updateExercicio(props.exercicio._id, payload)
        emit('updated', updated)
      }
      snackbar.success('Exercício salvo.')
    }
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível salvar o exercício.'))
  } finally {
    saving.value = false
  }
}

function addVideo(): void {
  const url = novoVideoUrl.value.trim()
  if (!url || videoUrls.value.length >= 5) return
  videoUrls.value.push(url)
  novoVideoUrl.value = ''
  persistVideos()
}

function removeVideo(index: number): void {
  videoUrls.value.splice(index, 1)
  persistVideos()
}

async function persistVideos(): Promise<void> {
  if (props.mode !== 'edit' || !props.exercicio) return
  try {
    await exerciciosApi.updateExercicio(props.exercicio._id, { videoUrls: videoUrls.value })
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível salvar os vídeos.'))
  }
}

function onCapaSelected(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (props.mode === 'create') {
    stagedCapa.value = file
    stagedCapaPreview.value = URL.createObjectURL(file)
    return
  }

  if (!props.exercicio) return
  uploadingCapa.value = true
  exerciciosApi
    .uploadExercicioCapa(props.exercicio._id, file)
    .then((updated) => emit('updated', updated))
    .catch((error) => snackbar.error(extractErrorMessage(error, 'Não foi possível enviar a capa.')))
    .finally(() => {
      uploadingCapa.value = false
    })
}

async function removeCapa(): Promise<void> {
  if (props.mode === 'create') {
    stagedCapa.value = null
    stagedCapaPreview.value = null
    return
  }
  if (!props.exercicio) return
  try {
    const updated = await exerciciosApi.deleteExercicioCapa(props.exercicio._id)
    emit('updated', updated)
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível remover a capa.'))
  }
}

function onImagemSelected(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const currentCount = (props.exercicio?.imagens.length ?? 0) + stagedImagens.value.length
  if (currentCount >= 5) {
    snackbar.error('Limite de 5 imagens por exercício.')
    return
  }

  if (props.mode === 'create') {
    stagedImagens.value.push(file)
    return
  }

  if (!props.exercicio) return
  uploadingImagem.value = true
  exerciciosApi
    .uploadExercicioImagem(props.exercicio._id, file)
    .then((updated) => emit('updated', updated))
    .catch((error) => snackbar.error(extractErrorMessage(error, 'Não foi possível enviar a imagem.')))
    .finally(() => {
      uploadingImagem.value = false
    })
}

async function removeImagem(key: string): Promise<void> {
  if (!props.exercicio) return
  try {
    const updated = await exerciciosApi.deleteExercicioImagem(props.exercicio._id, key)
    emit('updated', updated)
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível remover a imagem.'))
  }
}

async function clone(): Promise<void> {
  if (!props.exercicio) return
  cloning.value = true
  try {
    const clone = await exerciciosApi.cloneExercicio(props.exercicio._id)
    emit('created', clone)
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível clonar o exercício.'))
  } finally {
    cloning.value = false
  }
}

async function remove(): Promise<void> {
  if (!props.exercicio) return
  deleting.value = true
  try {
    await exerciciosApi.deleteExercicio(props.exercicio._id)
    emit('deleted')
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível excluir o exercício.'))
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <VCard class="mb-4">
      <VCardTitle class="d-flex align-center ga-2">
        <span class="section-icon"><VIcon icon="mdi-information-outline" size="15" color="primary" /></span>
        Informações
      </VCardTitle>
      <VCardText>
        <div class="d-flex ga-6 flex-wrap">
          <div class="capa-wrap">
            <VImg
              v-if="capaUrl"
              :src="capaUrl"
              aspect-ratio="1"
              cover
              rounded="lg"
              class="capa-image"
              @click="openPreview(capaUrl)"
            />
            <div v-else class="capa-placeholder">
              <VIcon icon="mdi-image-outline" size="28" />
            </div>
            <VBtn
              v-if="capaUrl"
              icon="mdi-close"
              size="x-small"
              variant="flat"
              class="capa-remove"
              :loading="uploadingCapa"
              @click="removeCapa"
            />
            <VBtn variant="outlined" size="small" class="mt-2" block prepend-icon="mdi-image-outline" :loading="uploadingCapa">
              Alterar capa
              <input type="file" accept="image/png,image/jpeg,image/webp" class="file-input" @change="onCapaSelected" />
            </VBtn>
          </div>

          <div class="flex-grow-1" style="min-width: 260px">
            <VTextField v-model="form.nome" label="Nome" placeholder="Nome do exercício" maxlength="50" counter />
            <VTextarea
              v-model="form.descricao"
              label="Descrição (opcional)"
              placeholder="Descreva detalhes sobre o exercício, execução, dicas..."
              maxlength="200"
              counter
              rows="3"
              auto-grow
              class="mt-4"
            />
          </div>
        </div>
      </VCardText>
    </VCard>

    <VCard class="mb-4">
      <VCardTitle class="d-flex align-center ga-2">
        <span class="section-icon"><VIcon icon="mdi-dumbbell" size="15" color="primary" /></span>
        Séries e carga
      </VCardTitle>
      <VCardText>
        <div class="series-grid">
          <VTextField
            v-model="form.sets"
            label="Sets"
            type="number"
            placeholder="0"
            min="0"
            max="50"
            :rules="[maxValueRule(50)]"
            @blur="form.sets = clampMaxValue(form.sets, 50)"
          />
          <VTextField
            v-model="form.reps"
            label="Repetições"
            type="number"
            placeholder="0"
            min="0"
            max="500"
            prepend-inner-icon="mdi-repeat"
            :rules="[maxValueRule(500)]"
            @blur="form.reps = clampMaxValue(form.reps, 500)"
          />
          <VTextField
            v-model="form.pesoKg"
            label="Peso (kg)"
            type="number"
            placeholder="0"
            min="0"
            max="1000"
            prepend-inner-icon="mdi-weight-kilogram"
            :rules="[maxValueRule(1000)]"
            @blur="form.pesoKg = clampMaxValue(form.pesoKg, 1000)"
          />
          <VTextField
            v-model="form.cargaMaximaKg"
            label="1RM (opcional)"
            type="number"
            placeholder="Ex: 45"
            min="0"
            max="500"
            prepend-inner-icon="mdi-weight-lifter"
            :rules="[maxValueRule(500)]"
            @blur="form.cargaMaximaKg = clampMaxValue(form.cargaMaximaKg, 500)"
          />
        </div>

        <VExpansionPanels v-if="cargaMaximaNumero > 0" v-model="percentuaisOpen" variant="accordion" class="mt-4">
          <VExpansionPanel title="Tabela de percentuais" elevation="0">
            <VExpansionPanelText>
              <VTable density="compact">
                <tbody>
                  <tr v-for="row in percentuais" :key="row.pct">
                    <td class="font-weight-medium">{{ row.pct }}%</td>
                    <td>{{ ((cargaMaximaNumero * row.pct) / 100).toFixed(1) }} kg</td>
                    <td class="text-medium-emphasis">{{ row.label }}</td>
                  </tr>
                </tbody>
              </VTable>
            </VExpansionPanelText>
          </VExpansionPanel>
        </VExpansionPanels>
      </VCardText>
    </VCard>

    <VCard class="mb-4">
      <VCardTitle class="d-flex align-center ga-2">
        <span class="section-icon"><VIcon icon="mdi-video-outline" size="15" color="primary" /></span>
        Fotos e vídeos
      </VCardTitle>
      <VCardText>
        <div class="media-grid">
          <div>
            <p class="text-eyebrow mb-1">Fotos ({{ (exercicio?.imagens.length ?? 0) + stagedImagens.length }}/5)</p>
            <div class="d-flex flex-wrap ga-2 mt-2">
              <div v-for="imagem in exercicio?.imagens ?? []" :key="imagem.key" class="galeria-thumb">
                <VImg :src="imagem.url" aspect-ratio="1" cover rounded="lg" @click="openPreview(imagem.url)" />
                <div class="galeria-thumb__overlay" @click="openPreview(imagem.url)">
                  <VIcon icon="mdi-eye-outline" size="18" color="white" />
                </div>
                <VBtn
                  icon="mdi-close"
                  size="x-small"
                  variant="flat"
                  class="galeria-thumb__remove"
                  @click.stop="removeImagem(imagem.key)"
                />
              </div>
              <div v-for="(file, index) in stagedImagens" :key="`staged-${index}`" class="galeria-thumb">
                <VImg :src="objectUrl(file)" aspect-ratio="1" cover rounded="lg" @click="openPreview(objectUrl(file))" />
                <div class="galeria-thumb__overlay" @click="openPreview(objectUrl(file))">
                  <VIcon icon="mdi-eye-outline" size="18" color="white" />
                </div>
                <VBtn
                  icon="mdi-close"
                  size="x-small"
                  variant="flat"
                  class="galeria-thumb__remove"
                  @click.stop="removeStagedImagem(index)"
                />
              </div>
              <button
                v-if="(exercicio?.imagens.length ?? 0) + stagedImagens.length < 5"
                type="button"
                class="galeria-add"
                :class="{ 'galeria-add--loading': uploadingImagem }"
              >
                <VProgressCircular v-if="uploadingImagem" indeterminate size="20" width="2" />
                <template v-else>
                  <VIcon icon="mdi-plus" size="20" />
                  <span>Adicionar foto</span>
                </template>
                <input type="file" accept="image/png,image/jpeg,image/webp" class="file-input" @change="onImagemSelected" />
              </button>
            </div>
          </div>

          <div>
            <p class="text-eyebrow mb-1">Vídeos ({{ videoUrls.length }}/5)</p>
            <div v-if="videoUrls.length" class="video-grid mt-2 mb-3">
              <VideoPreview v-for="(url, index) in videoUrls" :key="url" :url="url" @remove="removeVideo(index)" />
            </div>
            <div v-if="videoUrls.length < 5" class="d-flex ga-2 mt-2">
              <VTextField v-model="novoVideoUrl" placeholder="Link do YouTube ou Instagram" maxlength="500" />
              <VBtn variant="outlined" :disabled="!novoVideoUrl.trim()" @click="addVideo">Adicionar</VBtn>
            </div>
            <p class="text-hint mt-2">Adicione o link de um vídeo para referência de execução.</p>
          </div>
        </div>
      </VCardText>
    </VCard>

    <VCard class="mb-4">
      <VCardTitle class="d-flex align-center ga-2">
        <span class="section-icon"><VIcon icon="mdi-tag-outline" size="15" color="primary" /></span>
        Categoria e substitutos
      </VCardTitle>
      <VCardText>
        <div class="cat-grid">
          <VSelect
            v-model="form.categoriaId"
            label="Categoria"
            :items="categorias"
            item-title="nome"
            item-value="_id"
            placeholder="Selecione uma categoria"
            class="field-w-md"
          />
          <div>
            <p class="text-eyebrow mt-0">Exercícios substitutos (opcional)</p>
            <SubstitutoPicker
              v-model="form.substitutoIds"
              :exercicios="exercicios"
              :categorias="categorias"
              :exclude-id="exercicio?._id"
            />
            <p class="text-hint mt-2">Adicione exercícios que podem substituir este quando necessário.</p>
          </div>
        </div>
      </VCardText>
    </VCard>

    <div class="d-flex flex-wrap ga-2">
      <VBtn color="primary" :loading="saving" @click="submit">Salvar</VBtn>
      <template v-if="mode === 'edit' && exercicio">
        <VBtn variant="outlined" prepend-icon="mdi-history" @click="historicoOpen = true">Histórico</VBtn>
        <VBtn variant="outlined" prepend-icon="mdi-content-copy" :loading="cloning" @click="clone">
          Clonar
        </VBtn>
        <VBtn variant="outlined" color="error" prepend-icon="mdi-trash-can-outline" @click="confirmDelete = true">
          Excluir
        </VBtn>
      </template>
    </div>

    <HistoricoDialog v-if="exercicio" v-model="historicoOpen" :exercicio-id="exercicio._id" />

    <VDialog v-model="confirmDelete" max-width="400">
      <VCard>
        <VCardTitle>Excluir exercício</VCardTitle>
        <VCardText>Tem certeza que deseja excluir "{{ exercicio?.nome }}"?</VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="confirmDelete = false">Cancelar</VBtn>
          <VBtn color="error" :loading="deleting" @click="remove">Excluir</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog :model-value="!!previewUrl" max-width="720" @update:model-value="previewUrl = null">
      <div class="lightbox">
        <VBtn icon="mdi-close" variant="flat" class="lightbox__close" @click="previewUrl = null" />
        <VImg v-if="previewUrl" :src="previewUrl" rounded="lg" max-height="80vh" />
      </div>
    </VDialog>
  </div>
</template>

<style scoped>
.field-w-md {
      max-width: 100%;
    height: 48px;
}
.section-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.capa-wrap {
  position: relative;
  width: 180px;
  flex-shrink: 0;
}

.capa-image {
  width: 180px;
  height: 180px;
  cursor: zoom-in;
}

.capa-placeholder {
  width: 180px;
  height: 180px;
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.capa-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.55) !important;
  color: #fff !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.capa-remove:hover {
  background: rgb(var(--v-theme-error)) !important;
}

.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
}

.cat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
}

.galeria-thumb {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 10px;
  overflow: hidden;
}

.galeria-thumb :deep(.v-img) {
  cursor: zoom-in;
}

.galeria-thumb__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0);
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease;
  cursor: zoom-in;
  pointer-events: none;
}

.galeria-thumb:hover .galeria-thumb__overlay {
  background: rgba(0, 0, 0, 0.35);
  opacity: 1;
  pointer-events: auto;
}

.galeria-thumb__remove {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.55) !important;
  color: #fff !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.galeria-thumb__remove:hover {
  background: rgb(var(--v-theme-error)) !important;
}

.galeria-add {
  width: 100px;
  height: 100px;
  border-radius: 10px;
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.28);
  background: transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  position: relative;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.galeria-add:hover {
  border-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}

.galeria-add span {
  font-size: 0.7rem;
  text-align: center;
  padding: 0 6px;
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.lightbox {
  position: relative;
  line-height: 0;
}

.lightbox__close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.55) !important;
  color: #fff !important;
  z-index: 1;
}
</style>
