import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { BodyGoal } from '../models/BodyGoal';
import { BodyMetricEntry } from '../models/BodyMetricEntry';
import { asyncHandler } from '../utils/asyncHandler';
import { createBodyGoalSchema, updateBodyGoalSchema } from '../validation/bodyGoal';
import entriesRouter from './bodyGoalEntries';

const router = Router();
router.use(requireAuth);

// Goals are meant to be created rarely (a new one every few months/years, per the user's own
// framing), so this is a generous ceiling, not a realistic usage cap.
const MAX_GOALS = 50;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const goals = await BodyGoal.find({ userId: req.user!.id }).sort({ createdAt: -1 });

    // N+1 is fine here — a user has a handful of goals over years, not hundreds. Each goal gets
    // its own "latest weight logged" so the list can show progress at a glance without opening it.
    const goalsWithSummary = await Promise.all(
      goals.map(async (goal) => {
        const latestEntry = await BodyMetricEntry.findOne({
          userId: req.user!.id,
          goalId: goal._id,
          pesoKg: { $exists: true },
        }).sort({ date: -1 });
        return { ...goal.toObject(), latestPesoKg: latestEntry?.pesoKg ?? null };
      })
    );

    res.status(200).json({ goals: goalsWithSummary });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { id, nome, pesoMetaKg } = createBodyGoalSchema.parse(req.body);

    const existing = await BodyGoal.findOne({ _id: id, userId: req.user!.id });
    if (!existing) {
      const count = await BodyGoal.countDocuments({ userId: req.user!.id });
      if (count >= MAX_GOALS) {
        res.status(409).json({ error: `Limite de ${MAX_GOALS} metas atingido` });
        return;
      }
    }

    const goal = await BodyGoal.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $setOnInsert: { _id: id, userId: req.user!.id, nome, pesoMetaKg } },
      { upsert: true, new: true }
    );
    res.status(201).json({ goal });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const goal = await BodyGoal.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!goal) {
      res.status(404).json({ error: 'Meta não encontrada' });
      return;
    }
    res.status(200).json({ goal });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateBodyGoalSchema.parse(req.body);

    const setOps: Record<string, unknown> = {};
    const unsetOps: Record<string, ''> = {};
    if (body.nome !== undefined) {
      if (body.nome === null) unsetOps.nome = '';
      else setOps.nome = body.nome;
    }
    if (body.pesoMetaKg !== undefined) setOps.pesoMetaKg = body.pesoMetaKg;

    const update: Record<string, unknown> = {};
    if (Object.keys(setOps).length > 0) update.$set = setOps;
    if (Object.keys(unsetOps).length > 0) update.$unset = unsetOps;

    const goal = await BodyGoal.findOneAndUpdate({ _id: req.params.id, userId: req.user!.id }, update, { new: true });
    if (!goal) {
      res.status(404).json({ error: 'Meta não encontrada' });
      return;
    }
    res.status(200).json({ goal });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const goal = await BodyGoal.findOneAndDelete({ _id: req.params.id, userId: req.user!.id });
    if (!goal) {
      res.status(404).json({ error: 'Meta não encontrada' });
      return;
    }
    // Cascade — an entry without its goal would just be orphaned dead weight, never reachable
    // through any route again (every entry route requires a valid goalId to even respond).
    await BodyMetricEntry.deleteMany({ userId: req.user!.id, goalId: req.params.id });
    res.status(204).end();
  })
);

router.use('/:goalId/entries', entriesRouter);

export default router;
