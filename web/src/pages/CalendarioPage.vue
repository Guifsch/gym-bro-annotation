<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import MonthCalendar from '../components/calendario/MonthCalendar.vue'
import PageHeader from '../components/PageHeader.vue'
import * as sessoesApi from '../api/sessoes'
import * as attendanceApi from '../api/attendance'
import * as refeicoesApi from '../api/refeicoes'
import * as treinosApi from '../api/treinos'
import type { Refeicao, Treino } from '../types/workout'
import type { SessaoDia } from '../api/sessoes'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'

const router = useRouter()
const snackbar = useSnackbar()

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const now = new Date()
const todayStr = isoDate(now)
const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const year = ref(now.getFullYear())
const month = ref(now.getMonth() + 1)
const monthLabel = computed(() => `${monthNames[month.value - 1]} ${year.value}`)

const loading = ref(true)
const sessaoDates = ref<Set<string>>(new Set())
const attendanceDates = ref<Set<string>>(new Set())
const refeicoes = ref<Refeicao[]>([])
const treinos = ref<Treino[]>([])
const sessoesByDate = ref<Record<string, SessaoDia[]>>({})

async function load(): Promise<void> {
  loading.value = true
  try {
    const [dates, attDates, refeicoesData, treinosData] = await Promise.all([
      sessoesApi.listSessaoDatesForMonth(year.value, month.value),
      attendanceApi.listAttendanceDatesForMonth(year.value, month.value),
      refeicoesApi.listRefeicoes(),
      treinosApi.listTreinos(),
    ])
    sessaoDates.value = new Set(dates)
    attendanceDates.value = new Set(attDates)
    refeicoes.value = refeicoesData
    treinos.value = treinosData

    const entries = await Promise.all(
      dates.map(async (date) => [date, await sessoesApi.listSessoesForDay(date)] as const)
    )
    sessoesByDate.value = Object.fromEntries(entries)
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível carregar o calendário.'))
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch([year, month], load)

function setYearMonth({ year: y, month: m }: { year: number; month: number }): void {
  year.value = y
  month.value = m
}

function goToday(): void {
  year.value = now.getFullYear()
  month.value = now.getMonth() + 1
}

function changeMonth(delta: number): void {
  const total = (year.value * 12 + (month.value - 1)) + delta
  year.value = Math.floor(total / 12)
  month.value = (total % 12) + 1
}

interface DayCell {
  date: string
  day: number
  inMonth: boolean
}

const weeks = computed<DayCell[][]>(() => {
  const startWeekday = new Date(year.value, month.value - 1, 1).getDay()
  const daysInMonth = new Date(year.value, month.value, 0).getDate()

  const cells: DayCell[] = []
  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const d = new Date(year.value, month.value - 2, new Date(year.value, month.value - 1, 0).getDate() - i)
    cells.push({ date: isoDate(d), day: d.getDate(), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(year.value, month.value - 1, day)
    cells.push({ date: isoDate(d), day, inMonth: true })
  }
  let nextDay = 1
  while (cells.length < 42) {
    const d = new Date(year.value, month.value, nextDay)
    cells.push({ date: isoDate(d), day: d.getDate(), inMonth: false })
    nextDay += 1
  }

  const result: DayCell[][] = []
  for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7))
  return result
})

interface CellEvent {
  key: string
  type: 'treino' | 'refeicao'
  label: string
}

function refeicoesFor(date: string): Refeicao[] {
  return refeicoes.value.filter((refeicao) => refeicao.dates.includes(date))
}

const refeicaoDatesSet = computed(() => {
  const set = new Set<string>()
  for (const refeicao of refeicoes.value) {
    for (const date of refeicao.dates) set.add(date)
  }
  return set
})

function eventsFor(date: string): CellEvent[] {
  const items: CellEvent[] = []
  for (const sessao of sessoesByDate.value[date] ?? []) {
    items.push({ key: sessao._id, type: 'treino', label: sessao.treinoNome })
  }
  for (const refeicao of refeicoesFor(date)) {
    items.push({ key: refeicao._id, type: 'refeicao', label: refeicao.nome })
  }
  return items
}

function goToDay(date: string): void {
  router.push(`/calendario/${date}`)
}

// A plain click (not a drag) on an event pill jumps straight into it — the session to log sets
// for a treino, the editor for a refeição — instead of just opening the day overview.
function onEventClick(item: CellEvent, date: string): void {
  if (item.type === 'treino') router.push(`/calendario/${date}/${item.key}`)
  else router.push(`/alimentacao/${item.key}`)
}

// Quick toggle from the month grid — same effect as the presence switch on the day page, just
// without navigating in. Optimistic, reverted if the request fails.
async function toggleAttendance(date: string): Promise<void> {
  const next = !attendanceDates.value.has(date)
  const optimistic = new Set(attendanceDates.value)
  if (next) optimistic.add(date)
  else optimistic.delete(date)
  attendanceDates.value = optimistic

  try {
    await attendanceApi.setAttendance(date, next)
  } catch (error) {
    const reverted = new Set(attendanceDates.value)
    if (next) reverted.delete(date)
    else reverted.add(date)
    attendanceDates.value = reverted
    snackbar.error(extractErrorMessage(error, 'Não foi possível atualizar a presença.'))
  }
}

// --- Drag and drop scheduling ---------------------------------------------

interface DragPayload {
  type: 'treino' | 'refeicao' | 'treino-move' | 'refeicao-move'
  id: string
  fromDate?: string
}

const dragOverDate = ref<string | null>(null)

// Set whenever a dragged event pill actually lands on a valid calendar cell (see `onCellDrop`).
// If a move-drag ends without ever touching a cell — dropped out in the page margin, on the
// sidebar, off the window — this stays false and the pill's `dragend` handler below treats it as
// "dragged out to delete/unlink" instead.
let activeDragHandled = false

function onAgendaDragStart(event: DragEvent, payload: DragPayload): void {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('text/plain', JSON.stringify(payload))
}

// Events already scheduled on a day are draggable too — dropping one on a different day moves
// it (updates the existing sessão/refeição link) instead of creating a duplicate. Dropping one
// outside the calendar entirely deletes/unlinks it (see `activeDragHandled` above).
function onEventDragStart(event: DragEvent, item: CellEvent, fromDate: string): void {
  if (!event.dataTransfer) return
  activeDragHandled = false
  event.dataTransfer.effectAllowed = 'move'
  const payload: DragPayload =
    item.type === 'treino'
      ? { type: 'treino-move', id: item.key, fromDate }
      : { type: 'refeicao-move', id: item.key, fromDate }
  event.dataTransfer.setData('text/plain', JSON.stringify(payload))
}

async function onEventDragEnd(item: CellEvent, fromDate: string): Promise<void> {
  dragOverDate.value = null
  if (activeDragHandled) return

  if (item.type === 'treino') {
    try {
      await sessoesApi.deleteSessao(item.key)
      snackbar.success('Treino removido do calendário.')
      await load()
    } catch (error) {
      snackbar.error(extractErrorMessage(error, 'Não foi possível remover o treino.'))
    }
    return
  }

  const refeicao = refeicoes.value.find((r) => r._id === item.key)
  if (!refeicao) return
  try {
    const updated = await refeicoesApi.updateRefeicao(item.key, {
      dates: refeicao.dates.filter((d) => d !== fromDate),
    })
    refeicoes.value = refeicoes.value.map((r) => (r._id === updated._id ? updated : r))
    snackbar.success('Refeição desvinculada do dia.')
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível desvincular a refeição.'))
  }
}

async function addRefeicaoDate(refeicaoId: string, date: string, successMessage: string): Promise<void> {
  const refeicao = refeicoes.value.find((item) => item._id === refeicaoId)
  if (!refeicao) return
  if (refeicao.dates.includes(date)) {
    snackbar.error('Essa refeição já está vinculada a este dia.')
    return
  }
  try {
    const updated = await refeicoesApi.updateRefeicao(refeicaoId, { dates: [...refeicao.dates, date] })
    refeicoes.value = refeicoes.value.map((item) => (item._id === updated._id ? updated : item))
    snackbar.success(successMessage)
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível vincular a refeição.'))
  }
}

async function onCellDrop(event: DragEvent, date: string): Promise<void> {
  activeDragHandled = true
  dragOverDate.value = null
  const raw = event.dataTransfer?.getData('text/plain')
  if (!raw) return

  let payload: DragPayload
  try {
    payload = JSON.parse(raw)
  } catch {
    return
  }

  if (payload.fromDate === date) return

  if (payload.type === 'treino') {
    try {
      await sessoesApi.createSessaoDia({ treinoId: payload.id, date })
      snackbar.success('Treino agendado.')
      await load()
    } catch (error) {
      snackbar.error(extractErrorMessage(error, 'Não foi possível agendar o treino.'))
    }
    return
  }

  if (payload.type === 'treino-move') {
    try {
      await sessoesApi.moveSessaoDate(payload.id, date)
      snackbar.success('Treino movido.')
      await load()
    } catch (error) {
      snackbar.error(extractErrorMessage(error, 'Não foi possível mover o treino.'))
    }
    return
  }

  if (payload.type === 'refeicao') {
    await addRefeicaoDate(payload.id, date, 'Refeição vinculada ao dia.')
    return
  }

  // refeicao-move
  const refeicao = refeicoes.value.find((item) => item._id === payload.id)
  if (!refeicao) return
  if (refeicao.dates.includes(date)) {
    snackbar.error('Essa refeição já está vinculada a este dia.')
    return
  }
  const nextDates = refeicao.dates.filter((d) => d !== payload.fromDate)
  nextDates.push(date)
  try {
    const updated = await refeicoesApi.updateRefeicao(payload.id, { dates: nextDates })
    refeicoes.value = refeicoes.value.map((item) => (item._id === updated._id ? updated : item))
    snackbar.success('Refeição movida.')
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível mover a refeição.'))
  }
}

const proximos = computed(() => {
  const items: { key: string; type: 'treino' | 'refeicao'; label: string; date: string }[] = []

  for (const [date, list] of Object.entries(sessoesByDate.value)) {
    if (date < todayStr) continue
    for (const sessao of list) items.push({ key: sessao._id, type: 'treino', label: sessao.treinoNome, date })
  }
  for (const refeicao of refeicoes.value) {
    for (const date of refeicao.dates) {
      if (date < todayStr) continue
      items.push({ key: `${refeicao._id}-${date}`, type: 'refeicao', label: refeicao.nome, date })
    }
  }

  items.sort((a, b) => a.date.localeCompare(b.date))
  return items.slice(0, 5)
})

function relativeLabel(date: string): string {
  if (date === todayStr) return 'Hoje'
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (date === isoDate(tomorrow)) return 'Amanhã'
  const [, m, d] = date.split('-')
  return `${d}/${m}`
}

const resumoTreinos = computed(() => Object.values(sessoesByDate.value).reduce((sum, list) => sum + list.length, 0))
const resumoRefeicoes = computed(() =>
  refeicoes.value.reduce(
    (sum, refeicao) => sum + refeicao.dates.filter((d) => d.startsWith(`${year.value}-${pad(month.value)}`)).length,
    0
  )
)
const resumoPresencas = computed(() => attendanceDates.value.size)
</script>

<template>
  <div>
    <PageHeader title="Calendário" subtitle="Organize seus treinos e refeições." />

    <VRow>
      <VCol cols="12" lg="2">
        <p class="agenda-hint text-caption text-medium-emphasis mb-2">Arraste e solte</p>

        <VCard class="mb-4 agenda-card">
          <VCardTitle class="agenda-card__title">
            <VIcon icon="mdi-clipboard-list-outline" size="16" color="primary" class="mr-1" />
            Treinos
          </VCardTitle>
          <VCardText class="agenda-list">
            <p v-if="!treinos.length" class="text-caption text-medium-emphasis">Nenhum treino cadastrado.</p>
            <div
              v-for="treino in treinos"
              :key="treino._id"
              class="agenda-item"
              draggable="true"
              @dragstart="onAgendaDragStart($event, { type: 'treino', id: treino._id })"
              @click="router.push(`/treinos/${treino._id}`)"
            >
              <VIcon icon="mdi-drag-vertical" size="16" class="agenda-item__handle" />
              <span class="agenda-item__label">{{ treino.nome }}</span>
            </div>
          </VCardText>
        </VCard>

        <VCard class="agenda-card">
          <VCardTitle class="agenda-card__title">
            <VIcon icon="mdi-food-apple-outline" size="16" color="warning" class="mr-1" />
            Refeições
          </VCardTitle>
          <VCardText class="agenda-list">
            <p v-if="!refeicoes.length" class="text-caption text-medium-emphasis">Nenhuma refeição cadastrada.</p>
            <div
              v-for="refeicao in refeicoes"
              :key="refeicao._id"
              class="agenda-item"
              draggable="true"
              @dragstart="onAgendaDragStart($event, { type: 'refeicao', id: refeicao._id })"
              @click="router.push(`/alimentacao/${refeicao._id}`)"
            >
              <VIcon icon="mdi-drag-vertical" size="16" class="agenda-item__handle" />
              <span class="agenda-item__label">{{ refeicao.nome }}</span>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" lg="7">
        <VCard>
          <div class="cal-toolbar">
            <span class="cal-toolbar__month">{{ monthLabel }}</span>
            <VSpacer />
            <VBtn variant="outlined" size="small" class="mr-2" @click="goToday">Hoje</VBtn>
            <VBtn icon="mdi-chevron-left" variant="text" size="small" @click="changeMonth(-1)" />
            <VBtn icon="mdi-chevron-right" variant="text" size="small" @click="changeMonth(1)" />
          </div>

          <VDivider />

          <div class="cal-grid">
            <span v-for="wd in ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']" :key="wd" class="cal-weekday">
              {{ wd }}
            </span>

            <template v-for="(week, wi) in weeks" :key="wi">
              <button
                v-for="cell in week"
                :key="cell.date"
                type="button"
                class="cal-cell"
                :class="{
                  'cal-cell--out': !cell.inMonth,
                  'cal-cell--today': cell.date === todayStr,
                  'cal-cell--drag-over': dragOverDate === cell.date,
                }"
                @click="goToDay(cell.date)"
                @dragover.prevent="dragOverDate = cell.date"
                @dragleave="dragOverDate = dragOverDate === cell.date ? null : dragOverDate"
                @drop.prevent="onCellDrop($event, cell.date)"
              >
                <div class="cal-cell__top">
                  <span class="cal-cell__day">{{ cell.day }}</span>
                  <span class="cal-presence-toggle" @click.stop="toggleAttendance(cell.date)">
                    <VIcon
                      :icon="attendanceDates.has(cell.date) ? 'mdi-check-circle' : 'mdi-checkbox-blank-circle-outline'"
                      size="14"
                      :class="attendanceDates.has(cell.date) ? 'cal-presence-icon--checked' : 'cal-presence-icon--empty'"
                    />
                  </span>
                </div>
                <div class="cal-cell__events">
                  <div
                    v-for="item in eventsFor(cell.date).slice(0, 2)"
                    :key="item.key"
                    class="cal-event"
                    :class="`cal-event--${item.type}`"
                    draggable="true"
                    @dragstart="onEventDragStart($event, item, cell.date)"
                    @dragend="onEventDragEnd(item, cell.date)"
                    @click.stop="onEventClick(item, cell.date)"
                  >
                    <VIcon icon="mdi-drag-vertical" size="10" class="cal-event__handle" />
                    <span class="cal-event__label">{{ item.label }}</span>
                  </div>
                  <span v-if="eventsFor(cell.date).length > 2" class="cal-cell__more">
                    +{{ eventsFor(cell.date).length - 2 }} mais
                  </span>
                </div>
              </button>
            </template>
          </div>

          <VCardText class="d-flex ga-5 pt-2">
            <div class="d-flex align-center ga-2">
              <span class="legend-dot legend-dot--treino" />
              <span class="text-caption text-medium-emphasis">Treino</span>
            </div>
            <div class="d-flex align-center ga-2">
              <span class="legend-dot legend-dot--refeicao" />
              <span class="text-caption text-medium-emphasis">Refeição</span>
            </div>
            <div class="d-flex align-center ga-2">
              <VIcon icon="mdi-check-circle" size="14" color="primary" />
              <span class="text-caption text-medium-emphasis">Presença</span>
            </div>
          </VCardText>
        </VCard>
      </VCol>

      <VCol cols="12" lg="3">
        <VCard class="mb-4">
          <VCardTitle>Visão mensal</VCardTitle>
          <VCardText>
            <MonthCalendar
              compact
              :year="year"
              :month="month"
              :marked-dates="sessaoDates"
              :refeicao-dates="refeicaoDatesSet"
              :attendance-dates="attendanceDates"
              @update:year-month="setYearMonth"
              @day-click="goToDay"
            />

            <div class="mini-cal-legend">
              <div class="d-flex align-center ga-2">
                <span class="legend-dot legend-dot--treino" />
                <span class="text-caption text-medium-emphasis">Treino</span>
              </div>
              <div class="d-flex align-center ga-2">
                <span class="legend-dot legend-dot--refeicao-mini" />
                <span class="text-caption text-medium-emphasis">Refeição</span>
              </div>
              <div class="d-flex align-center ga-2">
                <span class="legend-ring" />
                <span class="text-caption text-medium-emphasis">Presença</span>
              </div>
            </div>
          </VCardText>
        </VCard>

        <VCard class="mb-4">
          <VCardTitle>Próximos</VCardTitle>
          <VCardText v-if="!proximos.length" class="text-medium-emphasis text-body-2">
            Nada agendado neste período.
          </VCardText>
          <VList v-else density="compact">
            <VListItem v-for="item in proximos" :key="item.key" @click="goToDay(item.date)">
              <template #prepend>
                <VAvatar size="32" :color="item.type === 'treino' ? 'primary' : 'warning'" variant="tonal">
                  <VIcon :icon="item.type === 'treino' ? 'mdi-clipboard-list-outline' : 'mdi-food-apple-outline'" size="16" />
                </VAvatar>
              </template>
              <VListItemTitle class="text-body-2 font-weight-medium">{{ item.label }}</VListItemTitle>
              <VListItemSubtitle>{{ relativeLabel(item.date) }}</VListItemSubtitle>
            </VListItem>
          </VList>
        </VCard>

        <VCard>
          <VCardTitle>Resumo do mês</VCardTitle>
          <VCardText class="d-flex ga-3 flex-wrap">
            <div class="resumo-tile">
              <span class="resumo-tile__value text-primary">{{ resumoTreinos }}</span>
              <span class="resumo-tile__label">Treinos</span>
            </div>
            <div class="resumo-tile">
              <span class="resumo-tile__value text-warning">{{ resumoRefeicoes }}</span>
              <span class="resumo-tile__label">Refeições</span>
            </div>
            <div class="resumo-tile">
              <span class="resumo-tile__value text-info">{{ resumoPresencas }}</span>
              <span class="resumo-tile__label">Presenças</span>
            </div>
          </VCardText>
        </VCard>
      </VCol>
    </VRow>

    <div v-if="loading" class="cal-loading">
      <VProgressCircular indeterminate size="22" />
    </div>
  </div>
</template>

<style scoped>
.cal-toolbar {
  display: flex;
  align-items: center;
  padding: 16px 20px;
}

.cal-toolbar__month {
  font-size: 1.05rem;
  font-weight: 700;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.07);
}

.cal-weekday {
  text-align: center;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: rgba(var(--v-theme-on-surface), 0.5);
  padding: 10px 0;
}

.cal-cell {
  position: relative;
  height: 98px;
  border: none;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.07);
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.07);
  background: transparent;
  cursor: pointer;
  padding: 6px 6px 4px;
  display: flex;
  flex-direction: column;
  text-align: left;
  overflow: hidden;
}

.cal-cell:nth-child(7n) {
  border-right: none;
}

.cal-cell:hover {
  background: rgba(21, 181, 128, 0.06);
}

.cal-cell--out {
  color: rgba(var(--v-theme-on-surface), 0.35);
}

.cal-cell--out .cal-cell__day {
  color: rgba(var(--v-theme-on-surface), 0.35);
}

.cal-cell--today .cal-cell__day {
  background: rgb(var(--v-theme-primary));
  color: #fff;
}

.cal-cell--drag-over {
  background: rgba(21, 181, 128, 0.16);
  box-shadow: inset 0 0 0 2px rgb(var(--v-theme-primary));
}

.cal-cell__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cal-presence-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 50%;
  padding: 3px;
  margin: -3px;
  transition: background 0.15s ease;
}

.cal-presence-toggle:hover {
  background: rgba(21, 181, 128, 0.16);
}

.cal-presence-icon--checked {
  color: rgb(var(--v-theme-primary));
}

.cal-presence-icon--empty {
  color: rgba(var(--v-theme-on-surface), 0.25);
}

.cal-cell__day {
  width: 25px;
  height: 25px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.88rem;
  font-weight: 600;
}

.cal-cell__events {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.cal-event {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 2px 5px;
  border-radius: 6px;
  cursor: grab;
  background: rgba(203, 255, 15, 0.16);
}

.cal-event--refeicao {
  background: rgba(255, 114, 0, 0.16);
}

.cal-event:hover {
  filter: brightness(1.15);
}

.cal-event:active {
  cursor: grabbing;
}

.cal-event__handle {
  color: rgba(var(--v-theme-on-surface), 0.45);
  flex-shrink: 0;
}

.cal-event__label {
  font-size: 0.72rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cal-cell__more {
  font-size: 0.74rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgb(203 255 15);
}

.legend-dot--refeicao {
  background: rgb(255 114 0);
}

.mini-cal-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.legend-dot--refeicao-mini {
   background: rgb(255 114 0);
}

.legend-ring {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00e893;
}

.resumo-tile {
  flex: 1;
  min-width: 90px;
  display: flex;
  flex-direction: column;
}

.resumo-tile__value {
  font-size: 1.6rem;
  font-weight: 800;
}

.resumo-tile__label {
  font-size: 0.82rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.cal-loading {
  position: fixed;
  bottom: 24px;
  right: 24px;
}

.agenda-hint {
  padding: 0 4px;
}

.agenda-card :deep(.v-card-text) {
  padding-top: 4px;
}

.agenda-card__title {
  display: flex;
  align-items: center;
  font-size: 0.95rem;
  padding-bottom: 6px;
}

.agenda-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 260px;
  overflow-y: auto;
}

.agenda-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: grab;
  background: rgba(var(--v-theme-on-surface), 0.04);
  transition: background 0.15s ease;
}

.agenda-item:hover {
  background: rgba(21, 181, 128, 0.12);
}

.agenda-item:active {
  cursor: grabbing;
}

.agenda-item__handle {
  color: rgba(var(--v-theme-on-surface), 0.35);
  flex-shrink: 0;
}

.agenda-item__label {
  font-size: 0.82rem;
  line-height: 1.25;
}
</style>
