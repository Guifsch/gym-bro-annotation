import { z } from 'zod';

export const createTimerPresetSchema = z.object({
  id: z.string().uuid(),
  seconds: z.number().int().min(1).max(3600),
});
