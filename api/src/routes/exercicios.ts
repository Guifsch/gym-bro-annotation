import { randomUUID } from 'crypto';

import express, { Router } from 'express';
import sharp from 'sharp';

import { requireAuth } from '../middleware/requireAuth';
import { Exercicio } from '../models/Exercicio';
import { Treino } from '../models/Treino';
import { asyncHandler } from '../utils/asyncHandler';
import { detectImageContentType } from '../utils/imageValidation';
import { paginateFind, parseLimit, type SortSpec } from '../utils/pagination';
import { deleteImageFromR2, uploadImageToR2 } from '../utils/storage';
import { createExercicioSchema, reorderExercicioSchema, updateExercicioSchema } from '../validation/workout';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_EXERCICIOS = 100;
const CAPA_THUMB_MAX_SIZE = 300;
const CAPA_THUMB_QUALITY = 82;

// Default limit == MAX_EXERCICIOS so call sites that never pass `limit`/`cursor` (pickers like the
// treino editor's exercise checklist, substituto picker, category chips) keep getting every row in
// one page, exactly like before pagination existed. Only the Exercícios tab's listing screen
// explicitly passes a smaller `limit` to actually paginate.
const EXERCICIOS_SORT: SortSpec[] = [
  { field: 'ordem', direction: 1 },
  { field: 'nome', direction: 1 },
  { field: '_id', direction: 1 },
];

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

/** Substitute is a mutual relationship — if A lists B, B should list A too. `substitutoIds` is
 * only ever written from the "origin" side, so every write here also pushes/pulls the origin's
 * own id on the other side, diffing against what was there before to know which side changed. */
async function syncReciprocalSubstitutos(
  userId: string,
  exercicioId: string,
  previousIds: string[],
  newIds: string[]
): Promise<void> {
  const added = newIds.filter((id) => !previousIds.includes(id));
  const removed = previousIds.filter((id) => !newIds.includes(id));

  if (added.length > 0) {
    await Exercicio.updateMany(
      { _id: { $in: added }, userId },
      { $addToSet: { substitutoIds: exercicioId } }
    );
  }
  if (removed.length > 0) {
    await Exercicio.updateMany(
      { _id: { $in: removed }, userId },
      { $pull: { substitutoIds: exercicioId } }
    );
  }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit, MAX_EXERCICIOS);
    const { items: exercicios, nextCursor } = await paginateFind(
      Exercicio,
      { userId: req.user!.id },
      EXERCICIOS_SORT,
      { cursor: req.query.cursor, limit, select: '-historico' }
    );
    res.status(200).json({ exercicios, nextCursor });
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

    if (!existing && resolved.value && resolved.value.length > 0) {
      await syncReciprocalSubstitutos(req.user!.id, id, [], resolved.value);
    }

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

    // Histórico tracks nome/descrição/sets/reps/pesoKg changes (ago/2026: nome/descrição joined
    // sets/reps/pesoKg here once the per-session entry override was removed — every meaningful
    // change to an exercise, wherever it's edited from, now leaves a dated trail). Editing só
    // categoria/substitutos/cargaMáxima, or resaving the same values, doesn't push a redundant
    // snapshot.
    const historicoTrigger =
      (body.nome !== undefined && body.nome !== existing.nome) ||
      (body.descricao !== undefined && body.descricao !== existing.descricao) ||
      (body.sets !== undefined && body.sets !== existing.sets) ||
      (body.reps !== undefined && body.reps !== existing.reps) ||
      (body.pesoKg !== undefined && body.pesoKg !== existing.pesoKg);

    const updateOps: Record<string, unknown> = { $set: setOps };
    if (historicoTrigger) {
      updateOps.$push = { historico: { $each: [snapshot], $slice: -50 } };
    }

    const exercicio = await Exercicio.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      updateOps,
      { new: true }
    ).select('-historico');
    if (!exercicio) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }

    if (resolved.value !== undefined) {
      await syncReciprocalSubstitutos(req.user!.id, req.params.id!, existing.substitutoIds, resolved.value);
    }

    res.status(200).json({ exercicio });
  })
);

// Dedicated endpoint for drag-and-drop reordering (web today, mobile eventually): unlike the
// general PATCH /:id above, this never touches historico — dragging an exercise to a new spot
// isn't a content edit, and reusing the general route made every reorder push a bogus
// "before/after" snapshot with identical nome/sets/reps/pesoKg (only ordem actually changed).
router.patch(
  '/:id/ordem',
  asyncHandler(async (req, res) => {
    const { ordem } = reorderExercicioSchema.parse(req.body);

    const exercicio = await Exercicio.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { $set: { ordem } },
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

    // Content-Type is client-declared and trivially spoofable — trust the actual bytes instead
    // for what gets stored/served.
    const detectedType = detectImageContentType(buffer);
    if (!detectedType) {
      res.status(400).json({ error: 'Arquivo não é uma imagem válida' });
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

    const { key, url } = await uploadImageToR2(buffer, detectedType, req.user!.id, 'exercicios');
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

    // Content-Type is client-declared and trivially spoofable — trust the actual bytes instead
    // for what gets stored/served.
    const detectedType = detectImageContentType(buffer);
    if (!detectedType) {
      res.status(400).json({ error: 'Arquivo não é uma imagem válida' });
      return;
    }

    const exercicio = await Exercicio.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!exercicio) {
      res.status(404).json({ error: 'Exercício não encontrado' });
      return;
    }

    const oldCapa = exercicio.capa;
    const { key, url } = await uploadImageToR2(buffer, detectedType, req.user!.id, 'exercicios');
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

// Re-encoded server-side (not proxied as-is) because the R2 bucket has no CORS policy, so the
// browser can't downscale the original via canvas itself — see the treino print PDF, whose file
// size otherwise scaled with the original photo resolution instead of the ~90px it's shown at.
router.get(
  '/:id/capa/thumb',
  asyncHandler(async (req, res) => {
    const exercicio = await Exercicio.findOne({ _id: req.params.id, userId: req.user!.id }).select('capa');
    if (!exercicio?.capa) {
      res.status(404).json({ error: 'Imagem não encontrada' });
      return;
    }

    const original = await fetch(exercicio.capa.url);
    if (!original.ok) {
      res.status(502).json({ error: 'Não foi possível buscar a imagem original' });
      return;
    }

    const buffer = Buffer.from(await original.arrayBuffer());
    const thumb = await sharp(buffer)
      .resize(CAPA_THUMB_MAX_SIZE, CAPA_THUMB_MAX_SIZE, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: CAPA_THUMB_QUALITY })
      .toBuffer();

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'private, max-age=86400');
    res.status(200).send(thumb);
  })
);

export default router;
