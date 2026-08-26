import { z } from 'zod';

export const createBodyGoalSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().max(80).optional(),
  pesoMetaKg: z.number().positive().max(500),
});

export const updateBodyGoalSchema = z.object({
  nome: z.string().trim().max(80).nullable().optional(),
  pesoMetaKg: z.number().positive().max(500).optional(),
});
