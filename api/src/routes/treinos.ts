import { randomUUID } from 'crypto';

import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { Sessao } from '../models/Sessao';
import { Treino } from '../models/Treino';
import { asyncHandler } from '../utils/asyncHandler';
import { createTreinoSchema, updateTreinoSchema } from '../validation/workout';

const router = Router();
router.use(requireAuth);

const MAX_TREINOS = 50;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const treinos = await Treino.find({ userId: req.user!.id }).sort({ nome: 1 });
    res.status(200).json({ treinos });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { id, nome } = createTreinoSchema.parse(req.body);

    const existing = await Treino.findOne({ _id: id, userId: req.user!.id });
    if (!existing) {
      const count = await Treino.countDocuments({ userId: req.user!.id });
      if (count >= MAX_TREINOS) {
        res.status(409).json({ error: `Limite de ${MAX_TREINOS} treinos atingido` });
        return;
      }
    }

    const treino = await Treino.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $setOnInsert: { _id: id, userId: req.user!.id, nome, exercicioIds: [] } },
      { upsert: true, new: true }
    );
    res.status(201).json({ treino });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const treino = await Treino.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!treino) {
      res.status(404).json({ error: 'Treino não encontrado' });
      return;
    }
    res.status(200).json({ treino });
  })
);

router.post(
  '/:id/clone',
  asyncHandler(async (req, res) => {
    const original = await Treino.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!original) {
      res.status(404).json({ error: 'Treino não encontrado' });
      return;
    }

    const count = await Treino.countDocuments({ userId: req.user!.id });
    if (count >= MAX_TREINOS) {
      res.status(409).json({ error: `Limite de ${MAX_TREINOS} treinos atingido` });
      return;
    }

    const suffix = ' (cópia)';
    const baseName = original.nome.length + suffix.length > 120 ? original.nome.slice(0, 120 - suffix.length) : original.nome;

    const clone = await Treino.create({
      _id: randomUUID(),
      userId: req.user!.id,
      nome: `${baseName}${suffix}`,
      exercicioIds: original.exercicioIds,
    });

    res.status(201).json({ treino: clone });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateTreinoSchema.parse(req.body);
    const treino = await Treino.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { $set: { ...body, updatedAt: new Date() } },
      { new: true }
    );
    if (!treino) {
      res.status(404).json({ error: 'Treino não encontrado' });
      return;
    }
    res.status(200).json({ treino });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await Treino.deleteOne({ _id: req.params.id, userId: req.user!.id });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Treino não encontrado' });
      return;
    }

    await Sessao.deleteMany({ treinoId: req.params.id, userId: req.user!.id });

    res.status(204).end();
  })
);

export default router;
