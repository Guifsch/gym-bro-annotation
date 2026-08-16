import { z } from 'zod';

const uuid = z.string().uuid();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

const refeicaoItem = z.object({
  id: uuid,
  nome: z.string().trim().min(1).max(200),
});

export const createRefeicaoSchema = z.object({
  id: uuid,
  nome: z.string().trim().min(1).max(120),
  date: dateString.optional(),
  itens: z.array(refeicaoItem).max(30).optional(),
  observacoes: z.string().trim().max(500).optional(),
});

export const updateRefeicaoSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  date: dateString.nullable().optional(),
  itens: z.array(refeicaoItem).max(30).optional(),
  observacoes: z.string().trim().max(500).optional(),
});
