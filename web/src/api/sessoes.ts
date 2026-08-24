import { apiRequest } from './client'
import type { Exercicio, Sessao } from '../types/workout'

export interface SessaoDia {
  _id: string
  treinoId: string
  treinoNome: string
  date: string
}

export async function listSessaoDatesForMonth(year: number, month: number): Promise<string[]> {
  const mm = String(month).padStart(2, '0')
  const { dates } = await apiRequest<{ dates: string[] }>(`/api/sessoes/month?year=${year}&month=${mm}`)
  return dates
}

export async function listSessoesForDay(date: string): Promise<SessaoDia[]> {
  const { sessoes } = await apiRequest<{ sessoes: SessaoDia[] }>(`/api/sessoes/day?date=${date}`)
  return sessoes
}

export async function createSessaoDia(params: { treinoId: string; date: string }): Promise<Sessao> {
  const { sessao } = await apiRequest<{ sessao: Sessao }>('/api/sessoes/day', { method: 'POST', body: params })
  return sessao
}

export async function getSessao(id: string): Promise<Sessao> {
  const { sessao } = await apiRequest<{ sessao: Sessao }>(`/api/sessoes/${id}`)
  return sessao
}

export function deleteSessao(id: string): Promise<void> {
  return apiRequest<void>(`/api/sessoes/${id}`, { method: 'DELETE' })
}

export interface UpsertSessaoEntryParams {
  sessaoId: string
  exercicioId: string
  sets?: number
  reps?: number
  pesoKg?: number
}

export function upsertSessaoEntry(
  params: UpsertSessaoEntryParams
): Promise<{ sessao: Sessao; exercicio: Exercicio; changed: boolean }> {
  return apiRequest('/api/sessoes/entries', { method: 'PUT', body: params })
}
