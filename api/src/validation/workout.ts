import { z } from 'zod';

const uuid = z.string().uuid();
const nome = z.string().trim().min(1).max(120);
const exercicioNome = z.string().trim().min(1).max(50);
const descricao = z.string().trim().max(200).optional();
const videoUrls = z.array(z.string().trim().max(500)).max(5).optional();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

export const createCategoriaSchema = z.object({
  id: uuid,
  nome,
});

export const updateCategoriaSchema = z.object({
  nome,
});

export const createExercicioSchema = z.object({
  id: uuid,
  nome: exercicioNome,
  descricao,
  categoriaId: uuid,
  sets: z.number().int().min(0).max(50),
  reps: z.number().int().min(0).max(500),
  pesoKg: z.number().min(0).max(1000),
  cargaMaximaKg: z.number().min(0).max(500).optional(),
  videoUrls,
});

export const updateExercicioSchema = z.object({
  nome: exercicioNome.optional(),
  descricao,
  categoriaId: uuid.optional(),
  sets: z.number().int().min(0).max(50).optional(),
  reps: z.number().int().min(0).max(500).optional(),
  pesoKg: z.number().min(0).max(1000).optional(),
  cargaMaximaKg: z.number().min(0).max(500).optional(),
  videoUrls,
});

export const createTreinoSchema = z.object({
  id: uuid,
  nome,
});

export const updateTreinoSchema = z.object({
  nome: nome.optional(),
  exercicioIds: z.array(uuid).max(100).optional(),
});

export const logTreinoDaySchema = z.object({
  treinoId: uuid,
  date: dateString,
});

export const upsertSessaoEntrySchema = z.object({
  sessaoId: uuid,
  exercicioId: uuid,
  sets: z.number().int().min(1).max(50).optional(),
  reps: z.number().int().min(1).max(500).optional(),
  pesoKg: z.number().min(0).max(1000).optional(),
});
