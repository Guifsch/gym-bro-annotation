import { File } from 'expo-file-system';

import { getAccessToken } from '@/auth/tokenMemory';
import type {
  BodyGoal,
  BodyGoalSummary,
  BodyMetricEntry,
  BodyMetricMedidas,
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

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PageParams {
  /** `null`/`undefined` fetches the first page. */
  cursor?: string | null;
  limit: number;
}

/** Every `GET /` list endpoint defaults `limit` to the resource's own hard cap when it's omitted,
 * so the plain `listX()` functions below (used by pickers/forms that want everything at once) keep
 * working unpaginated — only the `listXPage()` variants, used by infinite-scroll listing screens,
 * pass an explicit `limit` to actually paginate. */
function pageQuery({ cursor, limit }: PageParams): Record<string, string> {
  const query: Record<string, string> = { limit: String(limit) };
  if (cursor) query.cursor = cursor;
  return query;
}

export async function listCategorias(): Promise<Categoria[]> {
  const { data } = await apiClient.get('/api/categorias');
  return data.categorias;
}

export async function listCategoriasPage(params: PageParams): Promise<Page<Categoria>> {
  const { data } = await apiClient.get('/api/categorias', { params: pageQuery(params) });
  return { items: data.categorias, nextCursor: data.nextCursor };
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

export async function listExerciciosPage(params: PageParams): Promise<Page<Exercicio>> {
  const { data } = await apiClient.get('/api/exercicios', { params: pageQuery(params) });
  return { items: data.exercicios, nextCursor: data.nextCursor };
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
  videoUrls?: string[];
  substitutoIds?: string[];
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
  videoUrls?: string[];
  substitutoIds?: string[];
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

export async function uploadExercicioCapa(id: string, uri: string, contentType: string): Promise<Exercicio> {
  const token = getAccessToken();
  const result = await new File(uri).upload(`${API_URL}/api/exercicios/${id}/capa`, {
    headers: {
      'Content-Type': contentType,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Falha no upload da capa (status ${result.status})`);
  }
  return JSON.parse(result.body).exercicio;
}

export async function deleteExercicioCapa(id: string): Promise<Exercicio> {
  const { data } = await apiClient.delete(`/api/exercicios/${id}/capa`);
  return data.exercicio;
}

export async function cloneExercicio(id: string): Promise<Exercicio> {
  const { data } = await apiClient.post(`/api/exercicios/${id}/clone`);
  return data.exercicio;
}

export async function listTreinos(): Promise<Treino[]> {
  const { data } = await apiClient.get('/api/treinos');
  return data.treinos;
}

export async function listTreinosPage(params: PageParams): Promise<Page<Treino>> {
  const { data } = await apiClient.get('/api/treinos', { params: pageQuery(params) });
  return { items: data.treinos, nextCursor: data.nextCursor };
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

export async function cloneTreino(id: string): Promise<Treino> {
  const { data } = await apiClient.post(`/api/treinos/${id}/clone`);
  return data.treino;
}

export async function listSessaoDatesForMonth(year: string, month: string): Promise<string[]> {
  const { data } = await apiClient.get('/api/sessoes/month', { params: { year, month } });
  return data.dates;
}

export async function listAttendanceDatesForMonth(year: string, month: string): Promise<string[]> {
  const { data } = await apiClient.get('/api/attendance/month', { params: { year, month } });
  return data.dates;
}

export async function getAttendance(date: string): Promise<boolean> {
  const { data } = await apiClient.get(`/api/attendance/${date}`);
  return data.checked;
}

export async function setAttendance(date: string, checked: boolean): Promise<boolean> {
  const { data } = await apiClient.put(`/api/attendance/${date}`, { checked });
  return data.checked;
}

export interface AttendanceSummary {
  year: string;
  total: number;
  perMonth: number[];
}

export async function getAttendanceSummary(year: string): Promise<AttendanceSummary> {
  const { data } = await apiClient.get(`/api/attendance/summary/${year}`);
  return data;
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
  blocos?: RefeicaoBlocoParams[];
  observacoes?: string;
}

export interface UpdateRefeicaoParams {
  nome?: string;
  dates?: string[];
  blocos?: RefeicaoBlocoParams[];
  observacoes?: string;
}

export async function listRefeicoes(): Promise<Refeicao[]> {
  const { data } = await apiClient.get('/api/refeicoes');
  return data.refeicoes;
}

export async function listRefeicoesPage(params: PageParams): Promise<Page<Refeicao>> {
  const { data } = await apiClient.get('/api/refeicoes', { params: pageQuery(params) });
  return { items: data.refeicoes, nextCursor: data.nextCursor };
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

export interface UpsertBodyMetricEntryParams {
  pesoKg?: number | null;
  medidas?: BodyMetricMedidas | null;
  observacoes?: string | null;
}

export async function listBodyMetricEntries(goalId: string): Promise<BodyMetricEntry[]> {
  const { data } = await apiClient.get(`/api/body-goals/${goalId}/entries`);
  return data.entries;
}

export async function getBodyMetricEntry(goalId: string, date: string): Promise<BodyMetricEntry | null> {
  const { data } = await apiClient.get(`/api/body-goals/${goalId}/entries/${date}`);
  return data.entry;
}

export async function upsertBodyMetricEntry(
  goalId: string,
  date: string,
  params: UpsertBodyMetricEntryParams
): Promise<BodyMetricEntry> {
  const { data } = await apiClient.put(`/api/body-goals/${goalId}/entries/${date}`, params);
  return data.entry;
}

export async function deleteBodyMetricEntry(goalId: string, date: string): Promise<void> {
  await apiClient.delete(`/api/body-goals/${goalId}/entries/${date}`);
}

export interface CreateBodyGoalParams {
  id: string;
  nome?: string;
  pesoMetaKg: number;
}

export interface UpdateBodyGoalParams {
  nome?: string | null;
  pesoMetaKg?: number;
}

export async function listBodyGoals(): Promise<BodyGoalSummary[]> {
  const { data } = await apiClient.get('/api/body-goals');
  return data.goals;
}

export async function listBodyGoalsPage(params: PageParams): Promise<Page<BodyGoalSummary>> {
  const { data } = await apiClient.get('/api/body-goals', { params: pageQuery(params) });
  return { items: data.goals, nextCursor: data.nextCursor };
}

export async function createBodyGoal(params: CreateBodyGoalParams): Promise<BodyGoal> {
  const { data } = await apiClient.post('/api/body-goals', params);
  return data.goal;
}

export async function getBodyGoal(id: string): Promise<BodyGoal> {
  const { data } = await apiClient.get(`/api/body-goals/${id}`);
  return data.goal;
}

export async function updateBodyGoal(id: string, params: UpdateBodyGoalParams): Promise<BodyGoal> {
  const { data } = await apiClient.patch(`/api/body-goals/${id}`, params);
  return data.goal;
}

export async function deleteBodyGoal(id: string): Promise<void> {
  await apiClient.delete(`/api/body-goals/${id}`);
}
