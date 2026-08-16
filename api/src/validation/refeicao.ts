import { z } from 'zod';

const uuid = z.string().uuid();
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

const refeicaoItem = z.object({
  id: uuid,
  nome: z.string().trim().min(1).max(200),
});

const refeicaoBloco = z.object({
  id: uuid,
  nome: z.string().trim().min(1).max(120),
  horario: z.string().trim().max(20).optional(),
  itens: z.array(refeicaoItem).max(30).optional(),
});

export const createRefeicaoSchema = z.object({
  id: uuid,
  nome: z.string().trim().min(1).max(120),
  dates: z.array(dateString).max(60).optional(),
  itens: z.array(refeicaoItem).max(30).optional(),
  blocos: z.array(refeicaoBloco).max(20).optional(),
  observacoes: z.string().trim().max(500).optional(),
});

export const updateRefeicaoSchema = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  dates: z.array(dateString).max(60).optional(),
  itens: z.array(refeicaoItem).max(30).optional(),
  blocos: z.array(refeicaoBloco).max(20).optional(),
  observacoes: z.string().trim().max(500).optional(),
});
