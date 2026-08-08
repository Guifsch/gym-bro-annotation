import cors from 'cors';
import express from 'express';

import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';
import authRoutes from './routes/auth';
import categoriasRoutes from './routes/categorias';
import exerciciosRoutes from './routes/exercicios';
import sessoesRoutes from './routes/sessoes';
import treinosRoutes from './routes/treinos';
import { env } from './utils/env';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/categorias', categoriasRoutes);
  app.use('/api/exercicios', exerciciosRoutes);
  app.use('/api/treinos', treinosRoutes);
  app.use('/api/sessoes', sessoesRoutes);

  app.use(errorHandler);

  return app;
}
