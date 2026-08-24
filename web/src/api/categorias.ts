import { apiRequest } from './client'
import type { Categoria } from '../types/workout'

export async function listCategorias(): Promise<Categoria[]> {
  const { categorias } = await apiRequest<{ categorias: Categoria[] }>('/api/categorias')
  return categorias
}

export async function createCategoria(params: { nome: string; descricao?: string }): Promise<Categoria> {
  const { categoria } = await apiRequest<{ categoria: Categoria }>('/api/categorias', {
    method: 'POST',
    body: { id: crypto.randomUUID(), ...params },
  })
  return categoria
}

export async function updateCategoria(
  id: string,
  params: { nome?: string; descricao?: string; ordem?: number }
): Promise<Categoria> {
  const { categoria } = await apiRequest<{ categoria: Categoria }>(`/api/categorias/${id}`, {
    method: 'PATCH',
    body: params,
  })
  return categoria
}

export function deleteCategoria(id: string): Promise<void> {
  return apiRequest<void>(`/api/categorias/${id}`, { method: 'DELETE' })
}
