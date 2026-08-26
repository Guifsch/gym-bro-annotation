<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  year: number
  month: number
  markedDates?: Set<string>
  refeicaoDates?: Set<string>
  attendanceDates?: Set<string>
  selectedDates?: Set<string>
  registroDates?: Set<string>
  activeDate?: string
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:yearMonth': [{ year: number; month: number }]
  dayClick: [string]
}>()

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const monthLabel = computed(() => `${monthNames[props.month - 1]} ${props.year}`)

const todayStr = (() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
})()

const weeks = computed(() => {
  const first = new Date(props.year, props.month - 1, 1)
  const startWeekday = first.getDay()
  const daysInMonth = new Date(props.year, props.month, 0).getDate()

  const cells: (string | null)[] = []
  for (let i = 0; i < startWeekday; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${props.year}-${String(props.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const result: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7))
  return result
})

function prevMonth(): void {
  const month = props.month === 1 ? 12 : props.month - 1
  const year = props.month === 1 ? props.year - 1 : props.year
  emit('update:yearMonth', { year, month })
}

function nextMonth(): void {
  const month = props.month === 12 ? 1 : props.month + 1
  const year = props.month === 12 ? props.year + 1 : props.year
  emit('update:yearMonth', { year, month })
}

function dayNumber(date: string): number {
  return Number(date.slice(8, 10))
}
</script>

<template>
  <div class="month-calendar" :class="{ 'month-calendar--compact': compact }">
    <div class="d-flex align-center justify-space-between mb-3">
      <VBtn icon="mdi-chevron-left" variant="text" @click="prevMonth" />
      <span class="text-h6 font-weight-bold">{{ monthLabel }}</span>
      <VBtn icon="mdi-chevron-right" variant="text" @click="nextMonth" />
    </div>

    <div class="month-calendar__grid">
      <span v-for="wd in ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']" :key="wd" class="month-calendar__weekday">
        {{ wd }}
      </span>

      <template v-for="(week, wi) in weeks" :key="wi">
        <button
          v-for="(date, di) in week"
          :key="di"
          type="button"
          class="month-calendar__day"
          :class="{
            'month-calendar__day--empty': !date,
            'month-calendar__day--today': date === todayStr,
            'month-calendar__day--selected': date && selectedDates?.has(date),
            'month-calendar__day--active': date && date === activeDate && date !== todayStr,
          }"
          :disabled="!date"
          @click="date && emit('dayClick', date)"
        >
          <span v-if="date">{{ dayNumber(date) }}</span>
          <span v-if="date && attendanceDates?.has(date)" class="month-calendar__ring" />
          <div
            v-if="date && (markedDates?.has(date) || refeicaoDates?.has(date) || registroDates?.has(date))"
            class="month-calendar__dots"
          >
            <span v-if="markedDates?.has(date)" class="month-calendar__dot month-calendar__dot--treino" />
            <span v-if="refeicaoDates?.has(date)" class="month-calendar__dot month-calendar__dot--refeicao" />
            <span v-if="registroDates?.has(date)" class="month-calendar__dot month-calendar__dot--registro" />
          </div>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.month-calendar {
  width: 100%;
}

.month-calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.month-calendar__weekday {
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(var(--v-theme-on-surface), 0.5);
  padding-bottom: 8px;
}

/* Height is fixed and independent of column width, so the grid can stretch across a wide
   card without cells turning into giant circles (aspect-ratio would tie height to width). */
.month-calendar__day {
  position: relative;
  width: 100%;
  height: 52px;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.month-calendar--compact .month-calendar__day {
  height: 34px;
  border-radius: 8px;
  font-size: 0.8rem;
}

.month-calendar--compact .month-calendar__grid {
  gap: 2px;
}

.month-calendar--compact .month-calendar__weekday {
  font-size: 0.7rem;
  font-weight: 400;
  padding-bottom: 4px;
}

.month-calendar__day:not(.month-calendar__day--empty):hover {
  background: rgba(21, 181, 128, 0.1);
}

.month-calendar__day--empty {
  cursor: default;
  pointer-events: none;
}

.month-calendar__day--today {
  background: rgb(3 87 10);
  color: #fff;
  font-weight: 700;
}

.month-calendar__day--selected {
  outline: 2px solid rgb(var(--v-theme-primary));
}

.month-calendar__day--active {
  outline: 2px solid rgb(255 114 0);
}

.month-calendar__dots {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 3px;
}

.month-calendar__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(203 255 15);
}

.month-calendar__dot--refeicao {
  background: rgb(255 114 0);
}

.month-calendar__dot--registro {
  background: rgb(244 67 54);
}

.month-calendar--compact .month-calendar__dots {
  bottom: 5px;
  gap: 2px;
}

.month-calendar--compact .month-calendar__dot {
  width: 4px;
  height: 5px;
}

.month-calendar__ring {
  position: absolute;
  inset: 2px;
  border-radius: 8px;
  border: 2px solid #1fd08f;
  pointer-events: none;
}

.month-calendar--compact .month-calendar__ring {
  inset: 1px;
  border-width: 2px;
  border-radius: 6px;
}
</style>
