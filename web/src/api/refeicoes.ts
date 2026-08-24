import { apiRequest } from './client'
import type { Refeicao, RefeicaoBloco } from '../types/workout'

export async function listRefeicoes(): Promise<Refeicao[]> {
  const { refeicoes } = await apiRequest<{ refeicoes: Refeicao[] }>('/api/refeicoes')
  return refeicoes
}

export async function getRefeicao(id: string): Promise<Refeicao> {
  const { refeicao } = await apiRequest<{ refeicao: Refeicao }>(`/api/refeicoes/${id}`)
  return refeicao
}

export async function createRefeicao(params: { nome: string }): Promise<Refeicao> {
  const { refeicao } = await apiRequest<{ refeicao: Refeicao }>('/api/refeicoes', {
    method: 'POST',
    body: { id: crypto.randomUUID(), ...params },
  })
  return refeicao
}

export interface UpdateRefeicaoParams {
  nome?: string
  dates?: string[]
  blocos?: Array<{ id: string; nome: string; horario?: string; itens: Array<{ id: string; nome: string }> }>
  observacoes?: string
}

export async function updateRefeicao(id: string, params: UpdateRefeicaoParams): Promise<Refeicao> {
  const { refeicao } = await apiRequest<{ refeicao: Refeicao }>(`/api/refeicoes/${id}`, {
    method: 'PATCH',
    body: params,
  })
  return refeicao
}

export function deleteRefeicao(id: string): Promise<void> {
  return apiRequest<void>(`/api/refeicoes/${id}`, { method: 'DELETE' })
}

/** Server expects `id` on bloco/item write but returns `_id` on read — map before every whole-array PATCH. */
export function toBlocoParams(blocos: RefeicaoBloco[]): UpdateRefeicaoParams['blocos'] {
  return blocos.map((bloco) => ({
    id: bloco._id,
    nome: bloco.nome,
    horario: bloco.horario,
    itens: bloco.itens.map((item) => ({ id: item._id, nome: item.nome })),
  }))
}
