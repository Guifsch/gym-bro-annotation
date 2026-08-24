<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '../components/PageHeader.vue'
import * as attendanceApi from '../api/attendance'
import type { AttendanceSummary } from '../types/workout'
import { useSnackbar } from '../composables/useSnackbar'
import { extractErrorMessage } from '../utils/errors'

const snackbar = useSnackbar()

const now = new Date()
const CURRENT_YEAR = now.getFullYear()
const currentMonthIndex = now.getMonth()

const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const loading = ref(true)
const selectedYear = ref(CURRENT_YEAR)
const thisYearSummary = ref<AttendanceSummary | null>(null)
const yearSummary = ref<AttendanceSummary | null>(null)

async function loadThisYear(): Promise<void> {
  thisYearSummary.value = await attendanceApi.getAttendanceSummary(CURRENT_YEAR)
}

async function loadSelectedYear(): Promise<void> {
  yearSummary.value = await attendanceApi.getAttendanceSummary(selectedYear.value)
}

async function loadAll(): Promise<void> {
  loading.value = true
  try {
    await Promise.all([loadThisYear(), loadSelectedYear()])
  } catch (error) {
    snackbar.error(extractErrorMessage(error, 'Não foi possível carregar os relatórios.'))
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)

function changeYear(delta: number): void {
  const next = selectedYear.value + delta
  if (next > CURRENT_YEAR) return
  selectedYear.value = next
  loadSelectedYear()
}

const maxCount = computed(() => Math.max(1, ...(yearSummary.value?.perMonth ?? [1])))

function barWidth(count: number): number {
  if (count === 0) return 0
  return Math.max(4, (count / maxCount.value) * 100)
}

const esteMes = computed(() => thisYearSummary.value?.perMonth[currentMonthIndex] ?? 0)
const esteAno = computed(() => thisYearSummary.value?.total ?? 0)

function barColor(count: number): string {
  if (count === 0) return 'rgba(var(--v-theme-on-surface), 0.15)'
  if (count <= 3) return 'rgb(var(--v-theme-warning))'
  if (count <= 7) return '#0e7a56'
  return 'rgb(var(--v-theme-primary))'
}
</script>

<template>
  <div>
    <PageHeader title="Relatórios" subtitle="Acompanhe sua frequência na academia." />

    <div v-if="loading" class="text-center py-10">
      <VProgressCircular indeterminate />
    </div>

    <template v-else>
      <VRow class="mb-1">
        <VCol cols="12" sm="6" md="4">
          <VCard class="stat-card">
            <VCardText class="d-flex align-center ga-4 py-4">
              <div class="stat-card__icon"><VIcon icon="mdi-calendar-month-outline" size="26" color="primary" /></div>
              <div>
                <p class="text-body-2 text-medium-emphasis">Este mês</p>
                <p class="stat-card__value">{{ esteMes }}</p>
                <p class="text-caption text-medium-emphasis">treinos realizados</p>
              </div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" sm="6" md="4">
          <VCard class="stat-card">
            <VCardText class="d-flex align-center ga-4 py-4">
              <div class="stat-card__icon"><VIcon icon="mdi-calendar-multiple" size="26" color="primary" /></div>
              <div>
                <p class="text-body-2 text-medium-emphasis">Este ano</p>
                <p class="stat-card__value">{{ esteAno }}</p>
                <p class="text-caption text-medium-emphasis">treinos realizados</p>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VCard class="mt-4 report-chart-card">
        <VCardText>
          <div class="report-year-nav">
            <VBtn icon="mdi-chevron-left" variant="outlined" size="small" class="report-year-nav__btn" @click="changeYear(-1)" />
            <div class="report-year-nav__badge">
              <VIcon icon="mdi-calendar-blank-outline" size="18" color="primary" class="mr-1" />
              <span class="font-weight-bold">{{ selectedYear }}</span>
            </div>
            <VBtn
              icon="mdi-chevron-right"
              variant="outlined"
              size="small"
              class="report-year-nav__btn"
              :disabled="selectedYear >= CURRENT_YEAR"
              @click="changeYear(1)"
            />
          </div>

          <div v-for="(name, index) in monthNames" :key="name" class="d-flex align-center ga-3 mb-3">
            <span class="report-month-label">{{ name }}</span>
            <div class="report-bar-track">
              <div
                class="report-bar-fill"
                :style="{
                  width: barWidth(yearSummary?.perMonth[index] ?? 0) + '%',
                  background: barColor(yearSummary?.perMonth[index] ?? 0),
                }"
              />
            </div>
            <span class="report-count">{{ yearSummary?.perMonth[index] ?? 0 }}</span>
          </div>

          <div class="report-legend">
            <div class="report-legend__item">
              <span class="report-legend__dot" :style="{ background: barColor(0) }" />
              0 treinos
            </div>
            <div class="report-legend__item">
              <span class="report-legend__dot" :style="{ background: barColor(1) }" />
              1 – 3 treinos
            </div>
            <div class="report-legend__item">
              <span class="report-legend__dot" :style="{ background: barColor(4) }" />
              4 – 7 treinos
            </div>
            <div class="report-legend__item">
              <span class="report-legend__dot" :style="{ background: barColor(8) }" />
              8+ treinos
            </div>
          </div>
        </VCardText>
      </VCard>
    </template>
  </div>
</template>

<style scoped>
.stat-card__icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-card__value {
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1.2;
  color: rgb(var(--v-theme-primary));
}

.report-chart-card {
  max-width: 720px;
}

.report-year-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 24px;
}

.report-year-nav__btn {
  border-radius: 10px;
}

.report-year-nav__badge {
  display: flex;
  align-items: center;
  padding: 8px 18px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 10px;
  min-width: 120px;
  justify-content: center;
}

.report-month-label {
  width: 32px;
  font-size: 0.8rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.report-bar-track {
  flex: 1;
  height: 10px;
  border-radius: 5px;
  background: rgba(var(--v-theme-on-surface), 0.08);
  overflow: hidden;
}

.report-bar-fill {
  height: 100%;
  border-radius: 7px;
  transition: width 0.2s ease, background 0.2s ease;
}

.report-count {
  width: 24px;
  text-align: right;
  font-size: 0.8rem;
  font-weight: 600;
}

.report-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.report-legend__item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.report-legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
