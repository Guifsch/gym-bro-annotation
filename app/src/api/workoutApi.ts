import { File } from 'expo-file-system';

import { getAccessToken } from '@/auth/tokenMemory';
import type {
  Categoria,
  DiaTreino,
  Exercicio,
  ExercicioHistoricoEntry,
  Refeicao,
  Sessao,
  TimerPreset,
  Treino,
} from '@/types/workout';

import { API_URL, apiClient } from './apiClient';

export async function listCategorias(): Promise<Categoria[]> {
  const { data } = await apiClient.get('/api/categorias');
  return data.categorias;
}

export async function createCategoria(params: { id: string; nome: string }): Promise<Categoria> {
  const { data } = await apiClient.post('/api/categorias', params);
  return data.categoria;
}

export async function updateCategoria(id: string, params: { nome: string }): Promise<Categoria> {
  const { data } = await apiClient.patch(`/api/categorias/${id}`, params);
  return data.categoria;
}

export async function deleteCategoria(id: string): Promise<void> {
  await apiClient.delete(`/api/categorias/${id}`);
}

export async function listExercicios(): Promise<Exercicio[]> {
  const { data } = await apiClient.get('/api/exercicios');
  return data.exercicios;
}

export interface CreateExercicioParams {
  id: string;
  nome: string;
  descricao?: string;
  categoriaId: string;
  sets: number;
  reps: number;
  pesoKg: number;
  cargaMaximaKg?: number;
  videoUrl?: string;
}

export async function createExercicio(params: CreateExercicioParams): Promise<Exercicio> {
  const { data } = await apiClient.post('/api/exercicios', params);
  return data.exercicio;
}

export interface UpdateExercicioParams {
  nome?: string;
  descricao?: string;
  categoriaId?: string;
  sets?: number;
  reps?: number;
  pesoKg?: number;
  cargaMaximaKg?: number;
  videoUrl?: string;
}

export async function updateExercicio(id: string, params: UpdateExercicioParams): Promise<Exercicio> {
  const { data } = await apiClient.patch(`/api/exercicios/${id}`, params);
  return data.exercicio;
}

export async function deleteExercicio(id: string): Promise<void> {
  await apiClient.delete(`/api/exercicios/${id}`);
}

export async function getExercicioHistorico(id: string): Promise<ExercicioHistoricoEntry[]> {
  const { data } = await apiClient.get(`/api/exercicios/${id}/historico`);
  return data.historico;
}

export async function deleteExercicioHistoricoEntry(id: string, entryId: string): Promise<ExercicioHistoricoEntry[]> {
  const { data } = await apiClient.delete(`/api/exercicios/${id}/historico/${entryId}`);
  return data.historico;
}

export async function uploadExercicioImagem(id: string, uri: string, contentType: string): Promise<Exercicio> {
  const token = getAccessToken();
  const result = await new File(uri).upload(`${API_URL}/api/exercicios/${id}/imagens`, {
    headers: {
      'Content-Type': contentType,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Falha no upload da imagem (status ${result.status})`);
  }
  return JSON.parse(result.body).exercicio;
}

export async function deleteExercicioImagem(id: string, key: string): Promise<Exercicio> {
  const { data } = await apiClient.delete(`/api/exercicios/${id}/imagens/${encodeURIComponent(key)}`);
  return data.exercicio;
}

export async function listTreinos(): Promise<Treino[]> {
  const { data } = await apiClient.get('/api/treinos');
  return data.treinos;
}

export async function createTreino(params: { id: string; nome: string }): Promise<Treino> {
  const { data } = await apiClient.post('/api/treinos', params);
  return data.treino;
}

export async function getTreino(id: string): Promise<Treino> {
  const { data } = await apiClient.get(`/api/treinos/${id}`);
  return data.treino;
}

export async function updateTreino(id: string, params: { nome?: string; exercicioIds?: string[] }): Promise<Treino> {
  const { data } = await apiClient.patch(`/api/treinos/${id}`, params);
  return data.treino;
}

export async function deleteTreino(id: string): Promise<void> {
  await apiClient.delete(`/api/treinos/${id}`);
}

export async function listSessaoDatesForMonth(year: string, month: string): Promise<string[]> {
  const { data } = await apiClient.get('/api/sessoes/month', { params: { year, month } });
  return data.dates;
}

export async function listSessoesForDay(date: string): Promise<DiaTreino[]> {
  const { data } = await apiClient.get('/api/sessoes/day', { params: { date } });
  return data.sessoes;
}

export async function logTreinoForDay(params: { treinoId: string; date: string }): Promise<Sessao> {
  const { data } = await apiClient.post('/api/sessoes/day', params);
  return data.sessao;
}

export async function getSessao(id: string): Promise<Sessao> {
  const { data } = await apiClient.get(`/api/sessoes/${id}`);
  return data.sessao;
}

export async function deleteSessao(id: string): Promise<void> {
  await apiClient.delete(`/api/sessoes/${id}`);
}

export interface UpsertEntryParams {
  sessaoId: string;
  exercicioId: string;
  sets?: number;
  reps?: number;
  pesoKg?: number;
}

export interface UpsertEntryResult {
  sessao: Sessao;
  exercicio: Exercicio;
  changed: boolean;
}

export async function upsertSessaoEntry(params: UpsertEntryParams): Promise<UpsertEntryResult> {
  const { data } = await apiClient.put('/api/sessoes/entries', params);
  return data;
}

export interface RefeicaoItemParams {
  id: string;
  nome: string;
}

export interface RefeicaoBlocoParams {
  id: string;
  nome: string;
  horario?: string;
  itens?: RefeicaoItemParams[];
}

export interface CreateRefeicaoParams {
  id: string;
  nome: string;
  dates?: string[];
  itens?: RefeicaoItemParams[];
  blocos?: RefeicaoBlocoParams[];
  observacoes?: string;
}

export interface UpdateRefeicaoParams {
  nome?: string;
  dates?: string[];
  itens?: RefeicaoItemParams[];
  blocos?: RefeicaoBlocoParams[];
  observacoes?: string;
}

export async function listRefeicoes(): Promise<Refeicao[]> {
  const { data } = await apiClient.get('/api/refeicoes');
  return data.refeicoes;
}

export async function createRefeicao(params: CreateRefeicaoParams): Promise<Refeicao> {
  const { data } = await apiClient.post('/api/refeicoes', params);
  return data.refeicao;
}

export async function getRefeicao(id: string): Promise<Refeicao> {
  const { data } = await apiClient.get(`/api/refeicoes/${id}`);
  return data.refeicao;
}

export async function updateRefeicao(id: string, params: UpdateRefeicaoParams): Promise<Refeicao> {
  const { data } = await apiClient.patch(`/api/refeicoes/${id}`, params);
  return data.refeicao;
}

export async function deleteRefeicao(id: string): Promise<void> {
  await apiClient.delete(`/api/refeicoes/${id}`);
}

export async function listTimerPresets(): Promise<TimerPreset[]> {
  const { data } = await apiClient.get('/api/timer-presets');
  return data.presets;
}

export async function createTimerPreset(params: { id: string; seconds: number }): Promise<TimerPreset> {
  const { data } = await apiClient.post('/api/timer-presets', params);
  return data.preset;
}

export async function deleteTimerPreset(id: string): Promise<void> {
  await apiClient.delete(`/api/timer-presets/${id}`);
}
