import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', issues: err.issues });
    return;
  }

  if (err instanceof Error && err.name === 'MongoServerError' && 'code' in err && (err as { code?: number }).code === 11000) {
    res.status(409).json({ error: 'Duplicate resource' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
