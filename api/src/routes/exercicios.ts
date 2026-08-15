import { randomUUID } from 'crypto';

import express, { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { Exercicio } from '../models/Exercicio';
import { Treino } from '../models/Treino';
import { asyncHandler } from '../utils/asyncHandler';
import { deleteImageFromR2, uploadImageToR2 } from '../utils/storage';
import { createExercicioSchema, updateExercicioSchema } from '../validation/workout';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_EXERCICIOS = 100;

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const exercicios = await Exercicio.find({ userId: req.user!.id }).select('-historico').sort({ nome: 1 });
    res.status(200).json({ exercicios });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { id, nome, descricao, categoriaId, sets, reps, pesoKg, cargaMaximaKg } = createExercicioSchema.parse(
      req.body
    );

    const existing = await Exercicio.findOne({ _id: id, userId: req.user!.id });
    if (!existing) {
      const count = await Exercicio.countDocuments({ userId: req.user!.id });
      if (count >= MAX_EXERCICIOS) {
        res.status(409).json({ error: `Limite de ${MAX_EXERCICIOS} exercícios atingido` });
        return;
      }
    }

    const exercicio = await Exercicio.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $setOnInsert: { _id: id, userId: req.user!.id, nome, descricao, categoriaId, sets, reps, pesoKg, cargaMaximaKg } },
      { upsert: true, new: true }
    );
    res.status(201).json({ exercicio });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateExercicioSchema.parse(req.body);

    const existing = await Exercicio.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!existing) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }

    const snapshot = {
      _id: randomUUID(),
      nome: existing.nome,
      descricao: existing.descricao,
      sets: existing.sets,
      reps: existing.reps,
      pesoKg: existing.pesoKg,
      alteradoEm: new Date(),
    };

    const exercicio = await Exercicio.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { $set: body, $push: { historico: { $each: [snapshot], $slice: -50 } } },
      { new: true }
    ).select('-historico');
    if (!exercicio) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }
    res.status(200).json({ exercicio });
  })
);

router.get(
  '/:id/historico',
  asyncHandler(async (req, res) => {
    const exercicio = await Exercicio.findOne({ _id: req.params.id, userId: req.user!.id }).select('historico');
    if (!exercicio) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }
    const historico = [...exercicio.historico].reverse();
    res.status(200).json({ historico });
  })
);

router.delete(
  '/:id/historico/:entryId',
  asyncHandler(async (req, res) => {
    if (!req.params.entryId || req.params.entryId === 'undefined') {
      res.status(400).json({ error: 'entryId inválido' });
      return;
    }

    const exercicio = await Exercicio.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { $pull: { historico: { _id: req.params.entryId } } },
      { new: true }
    ).select('historico');
    if (!exercicio) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }
    const historico = [...exercicio.historico].reverse();
    res.status(200).json({ historico });
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

    for (const imagem of exercicio.imagens) {
      await deleteImageFromR2(imagem.key);
    }

    await Treino.updateMany(
      { userId: req.user!.id, exercicioIds: req.params.id },
      { $pull: { exercicioIds: req.params.id } }
    );

    res.status(204).end();
  })
);

router.post(
  '/:id/imagens',
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

    if (exercicio.imagens.length >= 5) {
      res.status(409).json({ error: 'Limite de 5 imagens por exercício' });
      return;
    }

    const { key, url } = await uploadImageToR2(buffer, contentType, req.user!.id, 'exercicios');
    exercicio.imagens.push({ url, key });
    await exercicio.save();

    res.status(200).json({ exercicio });
  })
);

router.delete(
  '/:id/imagens/:key',
  asyncHandler(async (req, res) => {
    const exercicio = await Exercicio.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!exercicio) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }

    const key = decodeURIComponent(req.params.key ?? '');
    const found = exercicio.imagens.some((imagem) => imagem.key === key);
    if (found) {
      await deleteImageFromR2(key);
      exercicio.imagens = exercicio.imagens.filter((imagem) => imagem.key !== key) as typeof exercicio.imagens;
      await exercicio.save();
    }

    res.status(200).json({ exercicio });
  })
);

export default router;
