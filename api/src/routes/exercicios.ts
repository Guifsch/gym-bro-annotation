import express, { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { Exercicio } from '../models/Exercicio';
import { Treino } from '../models/Treino';
import { asyncHandler } from '../utils/asyncHandler';
import { deleteImageFromR2, uploadImageToR2 } from '../utils/storage';
import { createExercicioSchema, updateExercicioSchema } from '../validation/workout';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const exercicios = await Exercicio.find({ userId: req.user!.id }).sort({ nome: 1 });
    res.status(200).json({ exercicios });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { id, nome, descricao, categoriaId, sets, reps, pesoKg } = createExercicioSchema.parse(req.body);
    const exercicio = await Exercicio.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $setOnInsert: { _id: id, userId: req.user!.id, nome, descricao, categoriaId, sets, reps, pesoKg } },
      { upsert: true, new: true }
    );
    res.status(201).json({ exercicio });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateExercicioSchema.parse(req.body);
    const exercicio = await Exercicio.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { $set: body },
      { new: true }
    );
    if (!exercicio) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }
    res.status(200).json({ exercicio });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const exercicio = await Exercicio.findOneAndDelete({ _id: req.params.id, userId: req.user!.id });
    if (!exercicio) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }

    if (exercicio.imagemKey) {
      await deleteImageFromR2(exercicio.imagemKey);
    }

    await Treino.updateMany(
      { userId: req.user!.id, exercicioIds: req.params.id },
      { $pull: { exercicioIds: req.params.id } }
    );

    res.status(204).end();
  })
);

router.post(
  '/:id/imagem',
  express.raw({ type: ALLOWED_IMAGE_TYPES, limit: MAX_IMAGE_SIZE_BYTES }),
  asyncHandler(async (req, res) => {
    const contentType = req.headers['content-type'] ?? '';
    if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
      res.status(400).json({ error: 'Tipo de imagem não suportado' });
      return;
    }

    const buffer = req.body as Buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      res.status(400).json({ error: 'Imagem vazia' });
      return;
    }

    const exercicio = await Exercicio.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!exercicio) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }

    const previousImagemKey = exercicio.imagemKey;
    const { key, url } = await uploadImageToR2(buffer, contentType, req.user!.id, 'exercicios');

    exercicio.imagemUrl = url;
    exercicio.imagemKey = key;
    await exercicio.save();

    if (previousImagemKey) {
      await deleteImageFromR2(previousImagemKey);
    }

    res.status(200).json({ exercicio });
  })
);

router.delete(
  '/:id/imagem',
  asyncHandler(async (req, res) => {
    const exercicio = await Exercicio.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!exercicio) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }

    if (exercicio.imagemKey) {
      await deleteImageFromR2(exercicio.imagemKey);
    }

    exercicio.imagemUrl = undefined;
    exercicio.imagemKey = undefined;
    await exercicio.save();

    res.status(200).json({ exercicio });
  })
);

export default router;
