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

/** `substitutoIds` is user input pointing at other of the user's own exercises — validated here
 * (ownership + not-self, deduped) rather than in the Zod schema, since that requires a DB lookup.
 * `undefined` (field omitted) passes through unchanged — a no-op for PATCH. */
async function resolveSubstitutoIds(
  userId: string,
  exercicioId: string,
  substitutoIds: string[] | undefined
): Promise<{ ok: true; value: string[] | undefined } | { ok: false; error: string }> {
  if (substitutoIds === undefined) return { ok: true, value: undefined };

  const uniqueIds = [...new Set(substitutoIds)];
  if (uniqueIds.includes(exercicioId)) {
    return { ok: false, error: 'Um exercício não pode ser o próprio substituto' };
  }
  if (uniqueIds.length === 0) return { ok: true, value: [] };

  const count = await Exercicio.countDocuments({ _id: { $in: uniqueIds }, userId });
  if (count !== uniqueIds.length) {
    return { ok: false, error: 'Exercício substituto não encontrado' };
  }
  return { ok: true, value: uniqueIds };
}

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
    const { id, nome, descricao, categoriaId, sets, reps, pesoKg, cargaMaximaKg, videoUrls, substitutoIds } =
      createExercicioSchema.parse(req.body);

    const existing = await Exercicio.findOne({ _id: id, userId: req.user!.id });
    if (!existing) {
      const count = await Exercicio.countDocuments({ userId: req.user!.id });
      if (count >= MAX_EXERCICIOS) {
        res.status(409).json({ error: `Limite de ${MAX_EXERCICIOS} exercícios atingido` });
        return;
      }
    }

    const resolved = await resolveSubstitutoIds(req.user!.id, id, substitutoIds);
    if (!resolved.ok) {
      res.status(400).json({ error: resolved.error });
      return;
    }

    const exercicio = await Exercicio.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      {
        $setOnInsert: {
          _id: id,
          userId: req.user!.id,
          nome,
          descricao,
          categoriaId,
          sets,
          reps,
          pesoKg,
          cargaMaximaKg,
          videoUrls,
          substitutoIds: resolved.value ?? [],
        },
      },
      { upsert: true, new: true }
    );
    res.status(201).json({ exercicio });
  })
);

router.post(
  '/:id/clone',
  asyncHandler(async (req, res) => {
    const original = await Exercicio.findOne({ _id: req.params.id, userId: req.user!.id }).select('-historico');
    if (!original) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }

    const count = await Exercicio.countDocuments({ userId: req.user!.id });
    if (count >= MAX_EXERCICIOS) {
      res.status(409).json({ error: `Limite de ${MAX_EXERCICIOS} exercícios atingido` });
      return;
    }

    // capa/imagens are intentionally not duplicated — copying them would mean re-uploading the
    // actual files to R2 under a new key, not just copying a reference.
    const suffix = ' (cópia)';
    const baseName = original.nome.length + suffix.length > 50 ? original.nome.slice(0, 50 - suffix.length) : original.nome;

    const clone = await Exercicio.create({
      _id: randomUUID(),
      userId: req.user!.id,
      nome: `${baseName}${suffix}`,
      descricao: original.descricao,
      categoriaId: original.categoriaId,
      sets: original.sets,
      reps: original.reps,
      pesoKg: original.pesoKg,
      cargaMaximaKg: original.cargaMaximaKg,
      videoUrls: original.videoUrls,
    });

    res.status(201).json({ exercicio: clone });
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

    const resolved = await resolveSubstitutoIds(req.user!.id, req.params.id!, body.substitutoIds);
    if (!resolved.ok) {
      res.status(400).json({ error: resolved.error });
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

    const { substitutoIds: _substitutoIds, ...restBody } = body;
    const setOps: Record<string, unknown> = { ...restBody };
    if (resolved.value !== undefined) setOps.substitutoIds = resolved.value;

    const exercicio = await Exercicio.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { $set: setOps, $push: { historico: { $each: [snapshot], $slice: -50 } } },
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
    if (exercicio.capa) {
      await deleteImageFromR2(exercicio.capa.key);
    }

    await Treino.updateMany(
      { userId: req.user!.id, exercicioIds: req.params.id },
      { $pull: { exercicioIds: req.params.id } }
    );

    await Exercicio.updateMany(
      { userId: req.user!.id, substitutoIds: req.params.id },
      { $pull: { substitutoIds: req.params.id } }
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

router.post(
  '/:id/capa',
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

    const oldCapa = exercicio.capa;
    const { key, url } = await uploadImageToR2(buffer, contentType, req.user!.id, 'exercicios');
    exercicio.capa = { url, key };
    await exercicio.save();
    if (oldCapa) {
      await deleteImageFromR2(oldCapa.key);
    }

    res.status(200).json({ exercicio });
  })
);

router.delete(
  '/:id/capa',
  asyncHandler(async (req, res) => {
    const exercicio = await Exercicio.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!exercicio) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }

    if (exercicio.capa) {
      await deleteImageFromR2(exercicio.capa.key);
      exercicio.capa = undefined;
      await exercicio.save();
    }

    res.status(200).json({ exercicio });
  })
);

export default router;
