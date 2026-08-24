import { apiRequest } from './client'
import type { Treino } from '../types/workout'

export async function listTreinos(): Promise<Treino[]> {
  const { treinos } = await apiRequest<{ treinos: Treino[] }>('/api/treinos')
  return treinos
}

export async function getTreino(id: string): Promise<Treino> {
  const { treino } = await apiRequest<{ treino: Treino }>(`/api/treinos/${id}`)
  return treino
}

export async function createTreino(params: { nome: string }): Promise<Treino> {
  const { treino } = await apiRequest<{ treino: Treino }>('/api/treinos', {
    method: 'POST',
    body: { id: crypto.randomUUID(), ...params },
  })
  return treino
}

export async function updateTreino(id: string, params: { nome?: string; exercicioIds?: string[] }): Promise<Treino> {
  const { treino } = await apiRequest<{ treino: Treino }>(`/api/treinos/${id}`, {
    method: 'PATCH',
    body: params,
  })
  return treino
}

export async function cloneTreino(id: string): Promise<Treino> {
  const { treino } = await apiRequest<{ treino: Treino }>(`/api/treinos/${id}/clone`, { method: 'POST' })
  return treino
}

export function deleteTreino(id: string): Promise<void> {
  return apiRequest<void>(`/api/treinos/${id}`, { method: 'DELETE' })
}
