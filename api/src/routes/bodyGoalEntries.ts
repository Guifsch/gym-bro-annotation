import { randomUUID } from 'crypto';

import { Router } from 'express';
import { z } from 'zod';

import { BodyGoal } from '../models/BodyGoal';
import { BodyMetricEntry } from '../models/BodyMetricEntry';
import { asyncHandler } from '../utils/asyncHandler';
import { upsertBodyMetricEntrySchema } from '../validation/bodyMetricEntry';

// Mounted at /api/body-goals/:goalId/entries — `mergeParams` is required for `req.params.goalId`
// to be visible here, since this router is registered from `bodyGoals.ts`, not `app.ts` directly.
const router = Router({ mergeParams: true });

const dateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

// Defensive cap — at one entry per day this covers ~2.7 years, plenty for the chart/history.
const MAX_ENTRIES = 1000;

interface GoalParams {
  goalId: string;
}

// Every route here operates on a specific goal's entries — confirm the goal exists and belongs to
// the caller before touching anything, since `goalId` arrives as a raw URL param.
router.use(
  asyncHandler(async (req, res, next) => {
    const { goalId } = req.params as unknown as GoalParams;
    const goal = await BodyGoal.exists({ _id: goalId, userId: req.user!.id });
    if (!goal) {
      res.status(404).json({ error: 'Meta não encontrada' });
      return;
    }
    next();
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { goalId } = req.params as unknown as GoalParams;
    // Sorted descending + capped to keep the MOST RECENT entries if a user ever exceeds the cap,
    // then reversed so the response is ascending (what the chart and delta math both want).
    const entries = await BodyMetricEntry.find({ userId: req.user!.id, goalId }).sort({ date: -1 }).limit(MAX_ENTRIES);
    entries.reverse();
    res.status(200).json({ entries });
  })
);

router.get(
  '/:date',
  asyncHandler(async (req, res) => {
    const { goalId } = req.params as unknown as GoalParams;
    const { date } = dateParamSchema.parse(req.params);
    const entry = await BodyMetricEntry.findOne({ userId: req.user!.id, goalId, date });
    res.status(200).json({ entry });
  })
);

router.put(
  '/:date',
  asyncHandler(async (req, res) => {
    const { goalId } = req.params as unknown as GoalParams;
    const { date } = dateParamSchema.parse(req.params);
    const body = upsertBodyMetricEntrySchema.parse(req.body);
    const userId = req.user!.id;

    // Full-replace-per-field semantics: a defined value sets it, an explicit `null` clears it,
    // omitting the field entirely leaves whatever was already stored untouched.
    const setOps: Record<string, unknown> = {};
    const unsetOps: Record<string, ''> = {};

    if (body.pesoKg !== undefined) {
      if (body.pesoKg === null) unsetOps.pesoKg = '';
      else setOps.pesoKg = body.pesoKg;
    }
    if (body.medidas !== undefined) {
      if (body.medidas === null) unsetOps.medidas = '';
      else setOps.medidas = body.medidas;
    }
    if (body.observacoes !== undefined) {
      if (!body.observacoes) unsetOps.observacoes = '';
      else setOps.observacoes = body.observacoes;
    }

    const update: Record<string, unknown> = { $setOnInsert: { _id: randomUUID(), userId, goalId, date } };
    if (Object.keys(setOps).length > 0) update.$set = setOps;
    if (Object.keys(unsetOps).length > 0) update.$unset = unsetOps;

    const entry = await BodyMetricEntry.findOneAndUpdate({ userId, goalId, date }, update, { upsert: true, new: true });
    res.status(200).json({ entry });
  })
);

router.delete(
  '/:date',
  asyncHandler(async (req, res) => {
    const { goalId } = req.params as unknown as GoalParams;
    const { date } = dateParamSchema.parse(req.params);
    await BodyMetricEntry.deleteOne({ userId: req.user!.id, goalId, date });
    res.status(204).end();
  })
);

export default router;
