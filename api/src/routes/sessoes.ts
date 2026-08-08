import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/requireAuth';
import { Exercicio } from '../models/Exercicio';
import { Sessao } from '../models/Sessao';
import { Treino } from '../models/Treino';
import { asyncHandler } from '../utils/asyncHandler';
import { logTreinoDaySchema, upsertSessaoEntrySchema } from '../validation/workout';

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
      { $setOnInsert: { _id: randomUUID(), userId, treinoId, date, entries: [] } },
      { upsert: true, new: true }
    );

    res.status(200).json({ sessao });
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

router.put(
  '/entries',
  asyncHandler(async (req, res) => {
    const { sessaoId, exercicioId, sets, reps, pesoKg } = upsertSessaoEntrySchema.parse(req.body);
    const userId = req.user!.id;

    if (sets === undefined && reps === undefined && pesoKg === undefined) {
      res.status(400).json({ error: 'Informe ao menos um campo: sets, reps ou pesoKg' });
      return;
    }

    const sessao = await Sessao.findOne({ _id: sessaoId, userId });
    if (!sessao) {
      res.status(404).json({ error: 'Sessão não encontrada' });
      return;
    }

    const exercicio = await Exercicio.findOne({ _id: exercicioId, userId });
    if (!exercicio) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }

    const existingEntry = sessao.entries.find((entry) => entry.exercicioId === exercicioId);

    // "último valor conhecido": compara contra a entrada do dia se existir, senão contra o padrão do cadastro
    const currentSets = existingEntry?.sets ?? exercicio.sets;
    const currentReps = existingEntry?.reps ?? exercicio.reps;
    const currentPesoKg = existingEntry?.pesoKg ?? exercicio.pesoKg;

    const changedFields: { sets?: number; reps?: number; pesoKg?: number } = {};
    if (sets !== undefined && sets !== currentSets) changedFields.sets = sets;
    if (reps !== undefined && reps !== currentReps) changedFields.reps = reps;
    if (pesoKg !== undefined && pesoKg !== currentPesoKg) changedFields.pesoKg = pesoKg;

    if (Object.keys(changedFields).length === 0) {
      res.status(200).json({ sessao, exercicio, changed: false });
      return;
    }

    const now = new Date();
    let updatedSessao;

    if (existingEntry) {
      const entrySet: Record<string, unknown> = { 'entries.$[entry].updatedAt': now, updatedAt: now };
      if (changedFields.sets !== undefined) entrySet['entries.$[entry].sets'] = changedFields.sets;
      if (changedFields.reps !== undefined) entrySet['entries.$[entry].reps'] = changedFields.reps;
      if (changedFields.pesoKg !== undefined) entrySet['entries.$[entry].pesoKg'] = changedFields.pesoKg;

      updatedSessao = await Sessao.findOneAndUpdate(
        { _id: sessaoId, userId },
        { $set: entrySet },
        { new: true, arrayFilters: [{ 'entry.exercicioId': exercicioId }] }
      );
    } else {
      updatedSessao = await Sessao.findOneAndUpdate(
        { _id: sessaoId, userId },
        {
          $push: {
            entries: {
              _id: randomUUID(),
              exercicioId,
              sets: sets ?? exercicio.sets,
              reps: reps ?? exercicio.reps,
              pesoKg: pesoKg ?? exercicio.pesoKg,
              updatedAt: now,
            },
          },
          $set: { updatedAt: now },
        },
        { new: true }
      );
    }

    const updatedExercicio = await Exercicio.findOneAndUpdate(
      { _id: exercicioId, userId },
      { $set: changedFields },
      { new: true }
    );

    res.status(200).json({ sessao: updatedSessao, exercicio: updatedExercicio, changed: true });
  })
);

export default router;
