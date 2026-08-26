import { z } from 'zod';

const medidasSchema = z.object({
  cintura: z.number().positive().max(300).optional(),
  quadril: z.number().positive().max(300).optional(),
  peito: z.number().positive().max(300).optional(),
  pescoco: z.number().positive().max(300).optional(),
  bracoEsquerdo: z.number().positive().max(300).optional(),
  bracoDireito: z.number().positive().max(300).optional(),
  coxaEsquerda: z.number().positive().max(300).optional(),
  coxaDireita: z.number().positive().max(300).optional(),
});

export const upsertBodyMetricEntrySchema = z
  .object({
    pesoKg: z.number().positive().max(500).nullable().optional(),
    medidas: medidasSchema.nullable().optional(),
    observacoes: z.string().trim().max(300).nullable().optional(),
  })
  .refine((body) => body.pesoKg !== undefined || body.medidas !== undefined || body.observacoes !== undefined, {
    message: 'Informe ao menos um campo',
  });
