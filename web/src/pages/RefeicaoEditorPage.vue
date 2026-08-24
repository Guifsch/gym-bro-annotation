<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import MonthCalendar from '../components/calendario/MonthCalendar.vue'
import PageHeader from '../components/PageHeader.vue'
import * as refeicoesApi from '../api/refeicoes'
import type { Refeicao, RefeicaoBloco } from '../types/workout'
import { formatTimeInput } from '../utils/time'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'

const props = defineProps<{ id: string }>()
const router = useRouter()
const snackbar = useSnackbar()

const loading = ref(true)
const notFound = ref(false)
const refeicao = ref<Refeicao | null>(null)

const nome = ref('')
const savingNome = ref(false)
const observacoes = ref('')
const savingObservacoes = ref(false)

const blocos = ref<RefeicaoBloco[]>([])
const savingBlocos = ref(false)
const novoBloco = reactive({ nome: '', horario: '' })
const novoItemNome = reactive<Record<string, string>>({})

const datesDialog = ref(false)
const now = new Date()
const calYear = ref(now.getFullYear())
const calMonth = ref(now.getMonth() + 1)

const confirmDelete = ref(false)
const deleting = ref(false)

const draggedBlocoId = ref<string | null>(null)
const dragOverBlocoId = ref<string | null>(null)
const dragHandleBlocoId = ref<string | null>(null)

function onBlocoDragStart(bloco: RefeicaoBloco, event: DragEvent): void {
  draggedBlocoId.value = bloco._id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', bloco._id)
  }
}

function onBlocoDragEnd(): void {
  draggedBlocoId.value = null
  dragOverBlocoId.value = null
  dragHandleBlocoId.value = null
}

function onBlocoDrop(target: RefeicaoBloco): void {
  const sourceId = draggedBlocoId.value
  dragOverBlocoId.value = null
  draggedBlocoId.value = null
  if (!sourceId || sourceId === target._id) return

  const fromIndex = blocos.value.findIndex((b) => b._id === sourceId)
  const toIndex = blocos.value.findIndex((b) => b._id === target._id)
  if (fromIndex === -1 || toIndex === -1) return

  const reordered = [...blocos.value]
  const [moved] = reordered.splice(fromIndex, 1)
  reordered.splice(toIndex, 0, moved)
  blocos.value = reordered
  persistBlocos()
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await refeicoesApi.getRefeicao(props.id)
    refeicao.value = data
    nome.value = data.nome
    observacoes.value = data.observacoes ?? ''
    blocos.value = data.blocos
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function saveNome(): Promise<void> {
  if (!refeicao.value || !nome.value.trim()) return
  savingNome.value = true
  try {
    refeicao.value = await refeicoesApi.updateRefeicao(refeicao.value._id, { nome: nome.value.trim() })
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível salvar o nome.'))
  } finally {
    savingNome.value = false
  }
}

async function saveObservacoes(): Promise<void> {
  if (!refeicao.value) return
  savingObservacoes.value = true
  try {
    refeicao.value = await refeicoesApi.updateRefeicao(refeicao.value._id, {
      observacoes: observacoes.value.trim() || undefined,
    })
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível salvar as observações.'))
  } finally {
    savingObservacoes.value = false
  }
}

async function toggleDate(date: string): Promise<void> {
  if (!refeicao.value) return
  const linked = refeicao.value.dates.includes(date)
  const dates = linked ? refeicao.value.dates.filter((d) => d !== date) : [...refeicao.value.dates, date]
  try {
    refeicao.value = await refeicoesApi.updateRefeicao(refeicao.value._id, { dates })
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível atualizar os dias vinculados.'))
  }
}

async function persistBlocos(): Promise<void> {
  if (!refeicao.value) return
  savingBlocos.value = true
  try {
    const updated = await refeicoesApi.updateRefeicao(refeicao.value._id, {
      blocos: refeicoesApi.toBlocoParams(blocos.value),
    })
    refeicao.value = updated
    blocos.value = updated.blocos
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível salvar os blocos.'))
  } finally {
    savingBlocos.value = false
  }
}

function criarBloco(): void {
  const nomeBloco = novoBloco.nome.trim()
  if (!nomeBloco || blocos.value.length >= 20) return
  blocos.value.push({
    _id: crypto.randomUUID(),
    nome: nomeBloco,
    horario: novoBloco.horario || undefined,
    itens: [],
  })
  novoBloco.nome = ''
  novoBloco.horario = ''
  persistBlocos()
}

function removerBloco(blocoId: string): void {
  blocos.value = blocos.value.filter((bloco) => bloco._id !== blocoId)
  persistBlocos()
}

function adicionarItem(blocoId: string): void {
  const nomeItem = (novoItemNome[blocoId] ?? '').trim()
  if (!nomeItem) return
  const bloco = blocos.value.find((item) => item._id === blocoId)
  if (!bloco || bloco.itens.length >= 30) return
  bloco.itens.push({ _id: crypto.randomUUID(), nome: nomeItem })
  novoItemNome[blocoId] = ''
  persistBlocos()
}

function removerItem(blocoId: string, itemId: string): void {
  const bloco = blocos.value.find((item) => item._id === blocoId)
  if (!bloco) return
  bloco.itens = bloco.itens.filter((item) => item._id !== itemId)
  persistBlocos()
}

async function excluirRefeicao(): Promise<void> {
  if (!refeicao.value) return
  deleting.value = true
  try {
    await refeicoesApi.deleteRefeicao(refeicao.value._id)
    router.push('/alimentacao')
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível excluir a refeição.'))
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Editar refeição" subtitle="Atualize as informações e a organização da sua refeição." back="/alimentacao">
      <template #actions>
        <VBtn variant="outlined" color="error" prepend-icon="mdi-trash-can-outline" @click="confirmDelete = true">
          Excluir refeição
        </VBtn>
      </template>
    </PageHeader>

    <div v-if="loading" class="text-center py-10">
      <VProgressCircular indeterminate />
    </div>

    <VCard v-else-if="notFound">
      <VCardText class="text-center py-10">
        <p class="text-medium-emphasis text-body-2 mb-4">Esta refeição foi removida.</p>
        <VBtn color="primary" to="/alimentacao">Voltar para alimentação</VBtn>
      </VCardText>
    </VCard>

    <template v-else-if="refeicao">
      <VCard class="mb-4">
        <VCardTitle class="d-flex align-center ga-2">
          <span class="section-icon"><VIcon icon="mdi-information-outline" size="15" color="primary" /></span>
          Informações
        </VCardTitle>
        <VCardText>
          <VForm class="d-flex align-end ga-3 mb-4" @submit.prevent="saveNome">
            <VTextField
              v-model="nome"
              label="Nome da refeição"
              placeholder="Ex: Café da manhã"
              maxlength="120"
              hide-details
              class="field-w-lg"
            />
            <VBtn color="primary" type="submit" :loading="savingNome">Salvar</VBtn>
          </VForm>

          <div class="d-flex align-center justify-space-between flex-wrap ga-2">
            <span class="text-body-2 text-medium-emphasis">
              {{ refeicao.dates.length ? `${refeicao.dates.length} dia(s) vinculado(s)` : 'Sem data vinculada' }}
            </span>
            <VBtn variant="outlined" size="small" prepend-icon="mdi-calendar-edit-outline" @click="datesDialog = true">
              Gerenciar dias
            </VBtn>
          </div>
        </VCardText>
      </VCard>

      <VCard class="mb-4">
        <VCardTitle class="d-flex align-center ga-2">
          <span class="section-icon"><VIcon icon="mdi-package-variant-closed" size="15" color="primary" /></span>
          Blocos
        </VCardTitle>
        <p class="text-hint px-6 mt-n2 mb-3">Organize os blocos e itens desta refeição.</p>
        <VCardText>
          <div
            v-for="bloco in blocos"
            :key="bloco._id"
            class="bloco-row"
            :class="{ 'bloco-row--over': dragOverBlocoId === bloco._id }"
            :draggable="dragHandleBlocoId === bloco._id"
            @dragstart="onBlocoDragStart(bloco, $event)"
            @dragend="onBlocoDragEnd"
            @dragover.prevent
            @dragenter.prevent="dragOverBlocoId = bloco._id"
            @drop.prevent="onBlocoDrop(bloco)"
          >
            <div class="d-flex align-center ga-2 mb-2">
              <VIcon
                icon="mdi-drag-vertical"
                size="25"
                class="drag-handle"
                @mousedown="dragHandleBlocoId = bloco._id"
                @mouseup="dragHandleBlocoId = null"
              />
              <span class="bloco-icon"><VIcon icon="mdi-silverware-fork-knife" size="14" color="primary" /></span>
              <span class="font-weight-bold">{{ bloco.nome }}</span>
              <span v-if="bloco.horario" class="text-medium-emphasis">· {{ bloco.horario }}</span>
              <VSpacer />
              <VBtn icon="mdi-trash-can-outline" size="small" variant="text" color="error" @click="removerBloco(bloco._id)" />
            </div>

            <div class="bloco-itens">
              <div v-for="item in bloco.itens" :key="item._id" class="item-row">
                <span>{{ item.nome }}</span>
                <VBtn icon="mdi-close" size="x-small" variant="flat" class="item-row__remove" @click="removerItem(bloco._id, item._id)" />
              </div>
            </div>

            <div v-if="bloco.itens.length < 30" class="d-flex ga-2 mt-2">
              <VTextField
                v-model="novoItemNome[bloco._id]"
                placeholder="Adicionar item"
                maxlength="200"
                @keyup.enter="adicionarItem(bloco._id)"
              />
              <VBtn color="primary" @click="adicionarItem(bloco._id)">Adicionar</VBtn>
            </div>
          </div>

          <div v-if="blocos.length < 20" class="novo-bloco-row">
            <span class="novo-bloco-row__label">Novo bloco</span>
            <VTextField
              v-model="novoBloco.nome"
              placeholder="Nome do bloco"
              maxlength="120"
              hide-details
              class="flex-grow-1"
              style="min-width: 160px"
            />
            <VTextField
              :model-value="novoBloco.horario"
              placeholder="Horário"
              maxlength="5"
              hide-details
              prepend-inner-icon="mdi-clock-outline"
              style="max-width: 140px"
              @update:model-value="(v) => (novoBloco.horario = formatTimeInput(v))"
            />
            <VBtn color="primary" :disabled="!novoBloco.nome.trim()" @click="criarBloco">Criar bloco</VBtn>
          </div>
        </VCardText>
      </VCard>

      <VCard>
        <VCardTitle class="d-flex align-center ga-2">
          <span class="section-icon"><VIcon icon="mdi-message-text-outline" size="15" color="primary" /></span>
          Observações
        </VCardTitle>
        <VCardText>
          <VForm class="d-flex flex-column ga-3" @submit.prevent="saveObservacoes">
            <VTextarea v-model="observacoes" placeholder="Alguma observação sobre esta refeição..." maxlength="500" counter rows="3" auto-grow />
            <VBtn color="primary" type="submit" :loading="savingObservacoes" style="align-self: start">
              Salvar observações
            </VBtn>
          </VForm>
        </VCardText>
      </VCard>
    </template>

    <VDialog v-model="datesDialog" max-width="360">
      <VCard v-if="refeicao">
        <VCardTitle>Dias vinculados</VCardTitle>
        <VCardText>
          <MonthCalendar
            compact
            :year="calYear"
            :month="calMonth"
            :selected-dates="new Set(refeicao.dates)"
            @update:year-month="(v) => { calYear = v.year; calMonth = v.month }"
            @day-click="toggleDate"
          />
        </VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn color="primary" @click="datesDialog = false">Concluído</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>

    <VDialog v-model="confirmDelete" max-width="420">
      <VCard>
        <VCardTitle>Excluir refeição</VCardTitle>
        <VCardText>Tem certeza que deseja excluir "{{ refeicao?.nome }}"?</VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="confirmDelete = false">Cancelar</VBtn>
          <VBtn color="error" :loading="deleting" @click="excluirRefeicao">Excluir</VBtn>
        </VCardActions>
      </VCard>
    </VDialog>
  </div>
</template>

<style scoped>
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

.bloco-row {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
  cursor: grab;
}

.bloco-row:active {
  cursor: grabbing;
}

.bloco-row--over {
  box-shadow: inset 0 2px 0 rgb(var(--v-theme-primary));
}

.drag-handle {
  cursor: grab;
  color: rgba(var(--v-theme-on-surface), 0.35);
}

.bloco-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bloco-itens {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.04);
  font-size: 0.9rem;
}

.item-row__remove {
  background: rgba(var(--v-theme-on-surface), 0.12) !important;
}

.item-row__remove:hover {
  background: rgb(var(--v-theme-error)) !important;
  color: #fff !important;
}

.novo-bloco-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 4px;
}

.novo-bloco-row__label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}
</style>
