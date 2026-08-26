import { apiRequest } from './client'
import type { BodyGoal, BodyGoalSummary, BodyMetricEntry, BodyMetricMedidas } from '../types/workout'

export async function listBodyGoals(): Promise<BodyGoalSummary[]> {
  const { goals } = await apiRequest<{ goals: BodyGoalSummary[] }>('/api/body-goals')
  return goals
}

export async function createBodyGoal(params: { nome?: string; pesoMetaKg: number }): Promise<BodyGoal> {
  const { goal } = await apiRequest<{ goal: BodyGoal }>('/api/body-goals', {
    method: 'POST',
    body: { id: crypto.randomUUID(), ...params },
  })
  return goal
}

export async function getBodyGoal(id: string): Promise<BodyGoal> {
  const { goal } = await apiRequest<{ goal: BodyGoal }>(`/api/body-goals/${id}`)
  return goal
}

export async function updateBodyGoal(id: string, params: { nome?: string | null; pesoMetaKg?: number }): Promise<BodyGoal> {
  const { goal } = await apiRequest<{ goal: BodyGoal }>(`/api/body-goals/${id}`, {
    method: 'PATCH',
    body: params,
  })
  return goal
}

export function deleteBodyGoal(id: string): Promise<void> {
  return apiRequest<void>(`/api/body-goals/${id}`, { method: 'DELETE' })
}

export async function listBodyMetricEntries(goalId: string): Promise<BodyMetricEntry[]> {
  const { entries } = await apiRequest<{ entries: BodyMetricEntry[] }>(`/api/body-goals/${goalId}/entries`)
  return entries
}

export async function getBodyMetricEntry(goalId: string, date: string): Promise<BodyMetricEntry | null> {
  const { entry } = await apiRequest<{ entry: BodyMetricEntry | null }>(`/api/body-goals/${goalId}/entries/${date}`)
  return entry
}

export interface UpsertBodyMetricEntryParams {
  pesoKg?: number | null
  medidas?: BodyMetricMedidas | null
  observacoes?: string | null
}

export async function upsertBodyMetricEntry(
  goalId: string,
  date: string,
  params: UpsertBodyMetricEntryParams
): Promise<BodyMetricEntry> {
  const { entry } = await apiRequest<{ entry: BodyMetricEntry }>(`/api/body-goals/${goalId}/entries/${date}`, {
    method: 'PUT',
    body: params,
  })
  return entry
}

export function deleteBodyMetricEntry(goalId: string, date: string): Promise<void> {
  return apiRequest<void>(`/api/body-goals/${goalId}/entries/${date}`, { method: 'DELETE' })
}
