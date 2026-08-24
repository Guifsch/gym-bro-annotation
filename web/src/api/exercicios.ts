import { apiRequest, apiRequestBlob } from './client'
import type { Exercicio, ExercicioHistoricoEntry } from '../types/workout'

export async function listExercicios(): Promise<Exercicio[]> {
  const { exercicios } = await apiRequest<{ exercicios: Exercicio[] }>('/api/exercicios')
  return exercicios
}

export interface ExercicioParams {
  nome: string
  descricao?: string
  categoriaId: string
  sets: number
  reps: number
  pesoKg: number
  cargaMaximaKg?: number
  videoUrls?: string[]
  substitutoIds?: string[]
}

export async function createExercicio(params: ExercicioParams): Promise<Exercicio> {
  const { exercicio } = await apiRequest<{ exercicio: Exercicio }>('/api/exercicios', {
    method: 'POST',
    body: { id: crypto.randomUUID(), ...params },
  })
  return exercicio
}

export async function updateExercicio(id: string, params: Partial<ExercicioParams>): Promise<Exercicio> {
  const { exercicio } = await apiRequest<{ exercicio: Exercicio }>(`/api/exercicios/${id}`, {
    method: 'PATCH',
    body: params,
  })
  return exercicio
}

export async function reorderExercicio(id: string, ordem: number): Promise<Exercicio> {
  const { exercicio } = await apiRequest<{ exercicio: Exercicio }>(`/api/exercicios/${id}/ordem`, {
    method: 'PATCH',
    body: { ordem },
  })
  return exercicio
}

export async function cloneExercicio(id: string): Promise<Exercicio> {
  const { exercicio } = await apiRequest<{ exercicio: Exercicio }>(`/api/exercicios/${id}/clone`, { method: 'POST' })
  return exercicio
}

export function deleteExercicio(id: string): Promise<void> {
  return apiRequest<void>(`/api/exercicios/${id}`, { method: 'DELETE' })
}

export async function getExercicioHistorico(id: string): Promise<ExercicioHistoricoEntry[]> {
  const { historico } = await apiRequest<{ historico: ExercicioHistoricoEntry[] }>(`/api/exercicios/${id}/historico`)
  return historico
}

export async function deleteExercicioHistoricoEntry(id: string, entryId: string): Promise<ExercicioHistoricoEntry[]> {
  const { historico } = await apiRequest<{ historico: ExercicioHistoricoEntry[] }>(
    `/api/exercicios/${id}/historico/${entryId}`,
    { method: 'DELETE' }
  )
  return historico
}

export async function uploadExercicioCapa(id: string, file: File): Promise<Exercicio> {
  const { exercicio } = await apiRequest<{ exercicio: Exercicio }>(`/api/exercicios/${id}/capa`, {
    method: 'POST',
    raw: { data: file, contentType: file.type },
  })
  return exercicio
}

export async function getExercicioCapaThumb(id: string): Promise<Blob> {
  return apiRequestBlob(`/api/exercicios/${id}/capa/thumb`)
}

export async function deleteExercicioCapa(id: string): Promise<Exercicio> {
  const { exercicio } = await apiRequest<{ exercicio: Exercicio }>(`/api/exercicios/${id}/capa`, {
    method: 'DELETE',
  })
  return exercicio
}

export async function uploadExercicioImagem(id: string, file: File): Promise<Exercicio> {
  const { exercicio } = await apiRequest<{ exercicio: Exercicio }>(`/api/exercicios/${id}/imagens`, {
    method: 'POST',
    raw: { data: file, contentType: file.type },
  })
  return exercicio
}

export async function deleteExercicioImagem(id: string, key: string): Promise<Exercicio> {
  const { exercicio } = await apiRequest<{ exercicio: Exercicio }>(
    `/api/exercicios/${id}/imagens/${encodeURIComponent(key)}`,
    { method: 'DELETE' }
  )
  return exercicio
}
