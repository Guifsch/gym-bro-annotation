import cors from 'cors';
import express from 'express';

import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimit';
import attendanceRoutes from './routes/attendance';
import authRoutes from './routes/auth';
import categoriasRoutes from './routes/categorias';
import exerciciosRoutes from './routes/exercicios';
import refeicoesRoutes from './routes/refeicoes';
import sessoesRoutes from './routes/sessoes';
import timerPresetsRoutes from './routes/timerPresets';
import treinosRoutes from './routes/treinos';
import { env } from './utils/env';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());

  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/categorias', categoriasRoutes);
  app.use('/api/exercicios', exerciciosRoutes);
  app.use('/api/treinos', treinosRoutes);
  app.use('/api/refeicoes', refeicoesRoutes);
  app.use('/api/sessoes', sessoesRoutes);
  app.use('/api/timer-presets', timerPresetsRoutes);
  app.use('/api/attendance', attendanceRoutes);

  app.use(errorHandler);

  return app;
}
