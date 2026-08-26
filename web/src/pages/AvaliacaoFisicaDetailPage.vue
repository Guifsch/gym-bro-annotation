<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import PageHeader from '../components/PageHeader.vue'
import MonthCalendar from '../components/calendario/MonthCalendar.vue'
import BodyDiagram from '../components/BodyDiagram.vue'
import * as bodyGoalsApi from '../api/bodyGoals'
import type { BodyGoal, BodyMetricEntry, BodyMetricMedidas } from '../types/workout'
import {
  MEDIDA_KEYS,
  MEDIDA_LABELS,
  computeGoalProgressPct,
  computeWeightDeltas,
  findPreviousFieldValue,
  getGoalDirection,
  getWeightEntries,
  isDeltaFavorable,
} from '../utils/bodyMetrics'
import { useThemeMode } from '../composables/useThemeMode'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'
import { clampMaxValue, maxValueRule } from '../utils/numberField'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const props = defineProps<{ id: string }>()
const snackbar = useSnackbar()
const { isDark } = useThemeMode()

const loading = ref(true)
const notFound = ref(false)
const goal = ref<BodyGoal | null>(null)
const entries = ref<BodyMetricEntry[]>([])

async function load(): Promise<void> {
  loading.value = true
  try {
    const [goalData, entriesData] = await Promise.all([
      bodyGoalsApi.getBodyGoal(props.id),
      bodyGoalsApi.listBodyMetricEntries(props.id),
    ])
    goal.value = goalData
    entries.value = entriesData
  } catch {
    notFound.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)

function goalTitle(): string {
  return goal.value?.nome?.trim() || `Meta de ${goal.value?.pesoMetaKg} kg`
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function todayStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// --- Summary --------------------------------------------------------------

const weightEntries = computed(() => getWeightEntries(entries.value))
const deltas = computed(() => computeWeightDeltas(weightEntries.value))
const currentWeight = computed(() => weightEntries.value.at(-1)?.pesoKg ?? null)
const firstWeight = computed(() => weightEntries.value[0]?.pesoKg ?? null)
const direction = computed(() =>
  firstWeight.value != null && goal.value ? getGoalDirection(firstWeight.value, goal.value.pesoMetaKg) : null
)
const progressPct = computed(() => {
  if (firstWeight.value == null || currentWeight.value == null || !goal.value) return null
  return computeGoalProgressPct(firstWeight.value, currentWeight.value, goal.value.pesoMetaKg)
})

function deltaClass(delta: number | null): string {
  const favorable = isDeltaFavorable(delta, direction.value)
  if (favorable === null) return 'text-medium-emphasis'
  return favorable ? 'text-primary' : 'text-error'
}

function formatDelta(delta: number | null): string {
  if (delta === null) return '—'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)} kg`
}

const editingGoal = ref(false)
const goalEditValue = ref('')

function startEditGoal(): void {
  goalEditValue.value = String(goal.value?.pesoMetaKg ?? '')
  editingGoal.value = true
}

async function saveGoalEdit(): Promise<void> {
  const pesoMetaKg = Number(goalEditValue.value)
  if (!goal.value || !pesoMetaKg || pesoMetaKg <= 0) return
  try {
    goal.value = await bodyGoalsApi.updateBodyGoal(goal.value._id, { pesoMetaKg })
    editingGoal.value = false
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível atualizar a meta.'))
  }
}

// --- Chart ------------------------------------------------------------

const chartData = computed<ChartData<'line'>>(() => {
  const labels = weightEntries.value.map((entry) => formatDateBR(entry.date))
  const datasets: ChartData<'line'>['datasets'] = [
    {
      label: 'Peso',
      data: weightEntries.value.map((entry) => entry.pesoKg),
      borderColor: '#15b580',
      backgroundColor: 'rgba(21, 181, 128, 0.15)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: '#15b580',
    },
  ]
  if (goal.value) {
    const target = goal.value.pesoMetaKg
    datasets.push({
      label: 'Meta',
      data: weightEntries.value.map(() => target),
      borderColor: 'rgba(150, 150, 150, 0.7)',
      borderDash: [6, 6],
      pointRadius: 0,
      fill: false,
    })
  }
  return { labels, datasets }
})

const chartOptions = computed<ChartOptions<'line'>>(() => {
  const textColor = isDark.value ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'
  const gridColor = isDark.value ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true },
    },
    scales: {
      x: { ticks: { color: textColor }, grid: { display: false } },
      y: { ticks: { color: textColor }, grid: { color: gridColor } },
    },
  }
})

// --- New entry form -----------------------------------------------------

const registroDatesSet = computed(() => new Set(entries.value.map((entry) => entry.date)))

const nowDate = new Date()
const entryCalYear = ref(nowDate.getFullYear())
const entryCalMonth = ref(nowDate.getMonth() + 1)
const historyCalYear = ref(nowDate.getFullYear())
const historyCalMonth = ref(nowDate.getMonth() + 1)

const entryDate = ref(todayStr())
const entryPeso = ref('')
const entryObservacoes = ref('')
const entryMedidas = reactive<Record<keyof BodyMetricMedidas, string>>({
  cintura: '',
  quadril: '',
  peito: '',
  pescoco: '',
  bracoEsquerdo: '',
  bracoDireito: '',
  coxaEsquerda: '',
  coxaDireita: '',
})
const medidasExpanded = ref(true)
const savingEntry = ref(false)
const entryCalendarMenu = ref(false)
const historyCalendarMenu = ref(false)

function loadEntryIntoForm(entry: BodyMetricEntry | null, date: string): void {
  entryDate.value = date
  const [y, m] = date.split('-').map(Number)
  entryCalYear.value = y
  entryCalMonth.value = m
  entryPeso.value = entry?.pesoKg != null ? String(entry.pesoKg) : ''
  entryObservacoes.value = entry?.observacoes ?? ''
  for (const key of MEDIDA_KEYS) {
    entryMedidas[key] = entry?.medidas?.[key] != null ? String(entry.medidas[key]) : ''
  }
}

const liveMedidas = computed<BodyMetricMedidas>(() => {
  const result: BodyMetricMedidas = {}
  for (const key of MEDIDA_KEYS) {
    const raw = entryMedidas[key]
    if (raw.trim()) {
      const parsed = Number(raw)
      if (Number.isFinite(parsed)) result[key] = parsed
    }
  }
  return result
})

const MEDIDA_INPUT_MAX_LENGTH = 3

// Blocks a 4th digit from ever landing in the field — a plain `maxlength` attribute doesn't
// apply to `type="number"` inputs per the HTML spec, and truncating the bound value after the
// fact doesn't reliably resync back to the field's own displayed text. Backspace/Delete/arrow
// keys and replacing an active selection are still allowed through.
function blockExtraMedidaDigit(event: KeyboardEvent): void {
  if (event.key.length > 1 || event.ctrlKey || event.metaKey) return
  const input = event.target as HTMLInputElement
  const hasSelection = input.selectionStart !== input.selectionEnd
  if (!hasSelection && input.value.length >= MEDIDA_INPUT_MAX_LENGTH) {
    event.preventDefault()
  }
}

function onEntryDateClick(date: string): void {
  const existing = entries.value.find((entry) => entry.date === date) ?? null
  loadEntryIntoForm(existing, date)
  entryCalendarMenu.value = false
}

function onHistoryDateClick(date: string): void {
  historyFilterDate.value = historyFilterDate.value === date ? '' : date
  historyCalendarMenu.value = false
}

async function saveEntry(): Promise<void> {
  const pesoKg = entryPeso.value.trim() ? Number(entryPeso.value) : undefined
  const medidas: BodyMetricMedidas = {}
  for (const key of MEDIDA_KEYS) {
    const raw = entryMedidas[key]
    if (raw.trim()) {
      const parsed = Number(raw)
      if (Number.isFinite(parsed)) medidas[key] = parsed
    }
  }
  const hasMedidas = Object.keys(medidas).length > 0
  const observacoes = entryObservacoes.value.trim() || undefined

  if (pesoKg === undefined && !hasMedidas && !observacoes) {
    snackbar.error('Preencha ao menos um campo antes de salvar.')
    return
  }

  savingEntry.value = true
  try {
    await bodyGoalsApi.upsertBodyMetricEntry(props.id, entryDate.value, {
      pesoKg: pesoKg ?? null,
      medidas: hasMedidas ? medidas : null,
      observacoes: observacoes ?? null,
    })
    await load()
    snackbar.success('Registro salvo.')
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível salvar o registro.'))
  } finally {
    savingEntry.value = false
  }
}

function editEntry(entry: BodyMetricEntry): void {
  loadEntryIntoForm(entry, entry.date)
  medidasExpanded.value = !!entry.medidas && Object.keys(entry.medidas).length > 0
  document.getElementById('novo-registro-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// --- History --------------------------------------------------------------

const historyExpanded = ref(false)
const historyFilterDate = ref('')
const historyPage = ref(1)
const historyPageSize = ref(10)

const historyDesc = computed(() => [...entries.value].reverse())
const filteredHistory = computed(() =>
  historyFilterDate.value ? historyDesc.value.filter((entry) => entry.date === historyFilterDate.value) : historyDesc.value
)
const historyPageCount = computed(() => Math.max(1, Math.ceil(filteredHistory.value.length / historyPageSize.value)))
const pagedHistory = computed(() => {
  const start = (historyPage.value - 1) * historyPageSize.value
  return filteredHistory.value.slice(start, start + historyPageSize.value)
})

watch([historyFilterDate, historyPageSize], () => {
  historyPage.value = 1
})
watch(historyPageCount, (count) => {
  if (historyPage.value > count) historyPage.value = count
})

function entryMedidaKeys(entry: BodyMetricEntry): (keyof BodyMetricMedidas)[] {
  return MEDIDA_KEYS.filter((key) => entry.medidas?.[key] != null)
}

function entryDelta(entry: BodyMetricEntry, field: keyof BodyMetricMedidas): number | undefined {
  const index = entries.value.findIndex((item) => item._id === entry._id)
  const value = entry.medidas?.[field]
  if (value === undefined || index === -1) return undefined
  const previous = findPreviousFieldValue(entries.value, index, field)
  return previous === undefined ? undefined : value - previous
}

const deleteEntryTarget = ref<BodyMetricEntry | null>(null)
const deletingEntry = ref(false)

async function confirmDeleteEntry(): Promise<void> {
  if (!deleteEntryTarget.value) return
  deletingEntry.value = true
  try {
    await bodyGoalsApi.deleteBodyMetricEntry(props.id, deleteEntryTarget.value.date)
    await load()
    deleteEntryTarget.value = null
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível excluir o registro.'))
  } finally {
    deletingEntry.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="goal ? goalTitle() : 'Avaliação Física'" back="/avaliacao-fisica" />

    <div v-if="loading" class="text-center py-10">
      <VProgressCircular indeterminate />
    </div>

    <VCard v-else-if="notFound">
      <VCardText class="text-center py-10">
        <p class="text-medium-emphasis text-body-2 mb-4">Esta meta não existe mais.</p>
        <VBtn color="primary" to="/avaliacao-fisica">Voltar</VBtn>
      </VCardText>
    </VCard>

    <template v-else-if="goal">
      <VCard class="mb-4">
        <VCardTitle class="d-flex align-center ga-2">
          <span class="section-icon"><VIcon icon="mdi-chart-line" size="15" color="primary" /></span>
          Resumo
        </VCardTitle>
        <VCardText>
          <p class="text-caption text-medium-emphasis mb-1">Peso atual</p>
          <p v-if="currentWeight != null" class="summary-weight">{{ currentWeight }} kg</p>
          <p v-else class="text-medium-emphasis text-body-2">Nenhum registro ainda</p>

          <div class="d-flex ga-8 mt-4 flex-wrap">
            <div>
              <p class="text-caption text-medium-emphasis">Desde o último</p>
              <p class="font-weight-bold" :class="deltaClass(deltas.sinceLast)">{{ formatDelta(deltas.sinceLast) }}</p>
            </div>
            <div>
              <p class="text-caption text-medium-emphasis">Desde o início</p>
              <p class="font-weight-bold" :class="deltaClass(deltas.sinceFirst)">{{ formatDelta(deltas.sinceFirst) }}</p>
            </div>
          </div>

          <VDivider class="my-4" />

          <div v-if="!editingGoal" class="d-flex align-center ga-2">
            <span class="text-body-2">Meta: <strong>{{ goal.pesoMetaKg }} kg</strong></span>
            <VBtn icon="mdi-pencil-outline" variant="text" size="x-small" @click="startEditGoal" />
          </div>
          <div v-else class="d-flex align-center ga-2">
            <VTextField
              v-model="goalEditValue"
              type="number"
              min="0"
              max="500"
              density="compact"
              hide-details="auto"
              style="max-width: 140px"
              :rules="[maxValueRule(500)]"
              @blur="goalEditValue = clampMaxValue(goalEditValue, 500)"
            />
            <VBtn icon="mdi-check" variant="text" size="small" color="primary" @click="saveGoalEdit" />
            <VBtn icon="mdi-close" variant="text" size="small" @click="editingGoal = false" />
          </div>

          <template v-if="progressPct != null">
            <VProgressLinear :model-value="progressPct" color="primary" height="10" rounded class="mt-4" />
            <p class="text-caption text-medium-emphasis mt-1">
              {{ progressPct >= 100 ? 'Meta atingida' : `${progressPct.toFixed(0)}% da meta` }}
            </p>
          </template>
        </VCardText>
      </VCard>

      <VCard class="mb-4">
        <VCardTitle class="d-flex align-center ga-2">
          <span class="section-icon"><VIcon icon="mdi-trending-up" size="15" color="primary" /></span>
          Evolução
        </VCardTitle>
        <VCardText>
          <p v-if="weightEntries.length === 0" class="text-center py-8 text-medium-emphasis text-body-2">
            Registre seu peso pra ver a evolução aqui.
          </p>
          <p v-else-if="weightEntries.length === 1" class="text-center py-8 text-medium-emphasis text-body-2">
            {{ weightEntries[0].pesoKg }} kg em {{ formatDateBR(weightEntries[0].date) }} — registre mais um dia pra ver
            a evolução aqui.
          </p>
          <div v-else class="chart-wrap">
            <Line :data="chartData" :options="chartOptions" />
          </div>
        </VCardText>
      </VCard>

      <VCard id="novo-registro-card" class="mb-4">
        <VCardTitle class="d-flex align-center ga-2">
          <span class="section-icon"><VIcon icon="mdi-plus" size="15" color="primary" /></span>
          Novo registro
        </VCardTitle>
        <VCardText>
          <p class="text-caption text-medium-emphasis mb-2">Data do registro</p>
          <VMenu v-model="entryCalendarMenu" :close-on-content-click="false" location="bottom start">
            <template #activator="{ props: menuProps }">
              <VBtn variant="outlined" color="primary" prepend-icon="mdi-calendar-month-outline" v-bind="menuProps">
                {{ formatDateBR(entryDate) }}
              </VBtn>
            </template>
            <VCard class="af-calendar-menu">
              <VCardText>
                <MonthCalendar
                  compact
                  :year="entryCalYear"
                  :month="entryCalMonth"
                  :registro-dates="registroDatesSet"
                  :active-date="entryDate"
                  @update:year-month="(v) => { entryCalYear = v.year; entryCalMonth = v.month }"
                  @day-click="onEntryDateClick"
                />
                <div class="af-legend">
                  <div class="d-flex align-center ga-2">
                    <span class="af-legend-swatch af-legend-swatch--hoje" />
                    <span class="text-caption text-medium-emphasis">Hoje</span>
                  </div>
                  <div class="d-flex align-center ga-2">
                    <span class="af-legend-swatch af-legend-swatch--selecionado" />
                    <span class="text-caption text-medium-emphasis">Selecionado</span>
                  </div>
                  <div class="d-flex align-center ga-2">
                    <span class="af-legend-dot" />
                    <span class="text-caption text-medium-emphasis">Tem registro</span>
                  </div>
                </div>
              </VCardText>
            </VCard>
          </VMenu>

          <VTextField
            v-model="entryPeso"
            label="Peso (kg)"
            type="number"
            min="0"
            max="500"
            style="max-width: 200px"
            class="mt-4"
            :rules="[maxValueRule(500)]"
            @blur="entryPeso = clampMaxValue(entryPeso, 500)"
          />

          <div class="medidas-toggle mt-3" @click="medidasExpanded = !medidasExpanded">
            <span class="text-primary font-weight-medium text-body-2">
              {{ medidasExpanded ? 'Ocultar medidas' : '+ Mais medidas' }}
            </span>
            <VIcon :icon="medidasExpanded ? 'mdi-chevron-up' : 'mdi-chevron-down'" size="18" color="primary" />
          </div>
          <VExpandTransition>
            <div v-if="medidasExpanded" class="mt-3">
              <BodyDiagram :values="liveMedidas" class="mb-4" />
              <div class="medidas-grid">
                <VTextField
                  v-for="key in MEDIDA_KEYS"
                  :key="key"
                  v-model="entryMedidas[key]"
                  :label="`${MEDIDA_LABELS[key]} (cm)`"
                  type="number"
                  min="0"
                  max="300"
                  :rules="[maxValueRule(300)]"
                  @keydown="blockExtraMedidaDigit"
                  @blur="entryMedidas[key] = clampMaxValue(entryMedidas[key], 300)"
                />
              </div>
            </div>
          </VExpandTransition>

          <VTextarea
            v-model="entryObservacoes"
            label="Observações (opcional)"
            maxlength="300"
            counter
            rows="2"
            auto-grow
            class="mt-4"
          />

          <VBtn color="primary" class="mt-2" :loading="savingEntry" @click="saveEntry">Salvar registro</VBtn>
        </VCardText>
      </VCard>

      <VCard>
        <button type="button" class="history-header" @click="historyExpanded = !historyExpanded">
          <span class="section-icon"><VIcon icon="mdi-history" size="15" color="primary" /></span>
          <span class="history-header__title">Histórico</span>
          <VSpacer />
          <VIcon
            icon="mdi-chevron-down"
            class="history-header__chevron"
            :class="{ 'history-header__chevron--open': historyExpanded }"
          />
        </button>

        <VExpandTransition>
          <VCardText v-if="historyExpanded">
            <div v-if="entries.length" class="d-flex align-center ga-2 mb-4">
              <VMenu v-model="historyCalendarMenu" :close-on-content-click="false" location="bottom start">
                <template #activator="{ props: menuProps }">
                  <VBtn variant="outlined" prepend-icon="mdi-calendar-month-outline" v-bind="menuProps">
                    {{ historyFilterDate ? formatDateBR(historyFilterDate) : 'Filtrar por data' }}
                  </VBtn>
                </template>
                <VCard class="af-calendar-menu">
                  <VCardText>
                    <MonthCalendar
                      compact
                      :year="historyCalYear"
                      :month="historyCalMonth"
                      :registro-dates="registroDatesSet"
                      :active-date="historyFilterDate || undefined"
                      @update:year-month="(v) => { historyCalYear = v.year; historyCalMonth = v.month }"
                      @day-click="onHistoryDateClick"
                    />
                    <div class="af-legend">
                      <div class="d-flex align-center ga-2">
                        <span class="af-legend-swatch af-legend-swatch--hoje" />
                        <span class="text-caption text-medium-emphasis">Hoje</span>
                      </div>
                      <div class="d-flex align-center ga-2">
                        <span class="af-legend-swatch af-legend-swatch--selecionado" />
                        <span class="text-caption text-medium-emphasis">Selecionado</span>
                      </div>
                      <div class="d-flex align-center ga-2">
                        <span class="af-legend-dot" />
                        <span class="text-caption text-medium-emphasis">Tem registro</span>
                      </div>
                    </div>
                  </VCardText>
                </VCard>
              </VMenu>
              <VBtn v-if="historyFilterDate" icon="mdi-close" variant="text" size="small" @click="historyFilterDate = ''" />
            </div>

            <p v-if="!filteredHistory.length" class="text-medium-emphasis text-body-2">
              {{ entries.length ? 'Nenhum registro nessa data.' : 'Nenhum registro ainda.' }}
            </p>

            <VCard v-for="entry in pagedHistory" :key="entry._id" variant="outlined" class="mb-2 history-entry">
              <VCardText>
                <div class="d-flex align-center justify-space-between">
                  <span class="font-weight-bold">{{ formatDateBR(entry.date) }}</span>
                  <div class="d-flex align-center ga-1">
                    <span v-if="entry.pesoKg != null" class="font-weight-bold text-primary mr-2">{{ entry.pesoKg }} kg</span>
                    <VBtn icon="mdi-pencil-outline" variant="text" size="small" @click="editEntry(entry)" />
                    <VBtn
                      icon="mdi-trash-can-outline"
                      variant="text"
                      size="small"
                      color="error"
                      @click="deleteEntryTarget = entry"
                    />
                  </div>
                </div>

                <div v-if="entryMedidaKeys(entry).length" class="d-flex flex-wrap ga-2 mt-3">
                  <VChip v-for="key in entryMedidaKeys(entry)" :key="key" size="small" variant="tonal" class="medida-chip">
                    <span class="medida-chip__label">{{ MEDIDA_LABELS[key] }}</span>
                    <span class="medida-chip__value">{{ entry.medidas![key] }}cm</span>
                    <span v-if="entryDelta(entry, key) !== undefined" class="medida-chip__delta">
                      <VIcon
                        :icon="entryDelta(entry, key)! > 0 ? 'mdi-arrow-up' : entryDelta(entry, key)! < 0 ? 'mdi-arrow-down' : 'mdi-minus'"
                        size="11"
                      />
                      {{ Math.abs(entryDelta(entry, key)!).toFixed(1) }}
                    </span>
                  </VChip>
                </div>

                <p v-if="entry.observacoes" class="text-body-2 text-medium-emphasis mt-2">{{ entry.observacoes }}</p>
              </VCardText>
            </VCard>

            <div v-if="filteredHistory.length > 5" class="history-pagination">
              <VSelect
                v-model="historyPageSize"
                :items="[5, 10, 20]"
                label="Por página"
                density="compact"
                hide-details
                class="history-pagination__size"
                style="min-width: 150px"
              />
              <VPagination
                v-model="historyPage"
                :length="historyPageCount"
                density="compact"
                total-visible="5"
                class="history-pagination__nav"
              />
            </div>
          </VCardText>
        </VExpandTransition>
      </VCard>
    </template>

    <VDialog :model-value="!!deleteEntryTarget" max-width="400" @update:model-value="deleteEntryTarget = null">
      <VCard v-if="deleteEntryTarget">
        <VCardTitle>Excluir registro</VCardTitle>
        <VCardText>Tem certeza que deseja excluir o registro de {{ formatDateBR(deleteEntryTarget.date) }}?</VCardText>
        <VCardActions>
          <VSpacer />
          <VBtn variant="text" @click="deleteEntryTarget = null">Cancelar</VBtn>
          <VBtn color="error" :loading="deletingEntry" @click="confirmDeleteEntry">Excluir</VBtn>
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

.summary-weight {
  font-size: 2rem;
  font-weight: 800;
  color: rgb(var(--v-theme-primary));
  line-height: 1.2;
}

.chart-wrap {
  height: 260px;
}

.af-calendar-menu {
  width: 320px;
}

.af-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 10px;
}

.af-legend-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  flex-shrink: 0;
}

.af-legend-swatch--hoje {
  background: rgb(3 87 10);
}

.af-legend-swatch--selecionado {
  background: transparent;
  outline: 2px solid rgb(255 114 0);
  outline-offset: -2px;
}

.af-legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgb(244 67 54);
  flex-shrink: 0;
}

.medidas-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  width: fit-content;
}

.medidas-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}

.history-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.history-header__title {
  font-weight: 700;
  font-size: 1.1rem;
}

.history-header__chevron {
  transition: transform 0.2s ease;
}

.history-header__chevron--open {
  transform: rotate(180deg);
}

.history-entry {
  break-inside: avoid;
}

.history-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.history-pagination__size {
  max-width: 170px;
  flex: 0 0 auto;
}

.history-pagination__nav {
  flex: 1 1 auto;
  justify-content: flex-end;
}

.medida-chip :deep(.v-chip__content) {
  gap: 5px;
}

.medida-chip__label {
  opacity: 0.7;
}

.medida-chip__value {
  font-weight: 700;
}

.medida-chip__delta {
  display: flex;
  align-items: center;
  opacity: 0.65;
  font-size: 0.8em;
}
</style>
