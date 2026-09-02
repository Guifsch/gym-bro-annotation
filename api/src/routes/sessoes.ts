import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/requireAuth';
import { Sessao } from '../models/Sessao';
import { Treino } from '../models/Treino';
import { asyncHandler } from '../utils/asyncHandler';
import { logTreinoDaySchema } from '../validation/workout';

const router = Router();
router.use(requireAuth);

const dayQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

const monthQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  month: z.string().regex(/^(0[1-9]|1[0-2])$/),
});

router.get(
  '/month',
  asyncHandler(async (req, res) => {
    const { year, month } = monthQuerySchema.parse(req.query);
    const dates = await Sessao.distinct('date', {
      userId: req.user!.id,
      date: { $regex: `^${year}-${month}` },
    });
    res.status(200).json({ dates });
  })
);

router.get(
  '/day',
  asyncHandler(async (req, res) => {
    const { date } = dayQuerySchema.parse(req.query);
    const userId = req.user!.id;

    const sessoes = await Sessao.find({ userId, date }).sort({ createdAt: 1 });
    const treinoIds = [...new Set(sessoes.map((s) => s.treinoId))];
    const treinos = await Treino.find({ _id: { $in: treinoIds }, userId });
    const treinoNomeById = Object.fromEntries(treinos.map((t) => [t._id, t.nome]));

    const result = sessoes.map((s) => ({
      _id: s._id,
      treinoId: s.treinoId,
      treinoNome: treinoNomeById[s.treinoId] ?? 'Treino removido',
      date: s.date,
    }));

    res.status(200).json({ sessoes: result });
  })
);

router.post(
  '/day',
  asyncHandler(async (req, res) => {
    const { treinoId, date } = logTreinoDaySchema.parse(req.body);
    const userId = req.user!.id;

    const sessao = await Sessao.findOneAndUpdate(
      { userId, treinoId, date },
      { $setOnInsert: { _id: randomUUID(), userId, treinoId, date } },
      { upsert: true, new: true }
    );

    res.status(200).json({ sessao });
  })
);

const moveSessaoSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

router.patch(
  '/:id/date',
  asyncHandler(async (req, res) => {
    const { date } = moveSessaoSchema.parse(req.body);
    const userId = req.user!.id;

    try {
      const sessao = await Sessao.findOneAndUpdate(
        { _id: req.params.id, userId },
        { $set: { date, updatedAt: new Date() } },
        { new: true }
      );
      if (!sessao) {
        res.status(404).json({ error: 'Sessão não encontrada' });
        return;
      }
      res.status(200).json({ sessao });
    } catch (error: unknown) {
      if ((error as { code?: number })?.code === 11000) {
        res.status(409).json({ error: 'Já existe uma sessão desse treino nesse dia.' });
        return;
      }
      throw error;
    }
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sessao = await Sessao.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!sessao) {
      res.status(404).json({ error: 'Sessão não encontrada' });
      return;
    }
    res.status(200).json({ sessao });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await Sessao.deleteOne({ _id: req.params.id, userId: req.user!.id });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Sessão não encontrada' });
      return;
    }
    res.status(204).end();
  })
);

export default router;
