import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { TimerPreset } from '../models/TimerPreset';
import { asyncHandler } from '../utils/asyncHandler';
import { createTimerPresetSchema } from '../validation/timerPreset';

const router = Router();
router.use(requireAuth);

const MAX_TIMER_PRESETS = 10;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const presets = await TimerPreset.find({ userId: req.user!.id }).sort({ seconds: 1 });
    res.status(200).json({ presets });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { id, seconds } = createTimerPresetSchema.parse(req.body);

    const existing = await TimerPreset.findOne({ userId: req.user!.id, seconds });
    if (!existing) {
      const count = await TimerPreset.countDocuments({ userId: req.user!.id });
      if (count >= MAX_TIMER_PRESETS) {
        res.status(409).json({ error: `Limite de ${MAX_TIMER_PRESETS} timers atingido` });
        return;
      }
    }

    try {
      const preset = await TimerPreset.findOneAndUpdate(
        { userId: req.user!.id, seconds },
        { $setOnInsert: { _id: id, userId: req.user!.id, seconds } },
        { upsert: true, new: true }
      );
      res.status(201).json({ preset });
    } catch (err) {
      // Two concurrent upserts for the same (userId, seconds) can both pass the "does it exist"
      // check before either has inserted, and the second then hits the unique index — the first
      // request already created the row we actually want, so just fetch and return that instead.
      if ((err as { code?: number }).code === 11000) {
        const preset = await TimerPreset.findOne({ userId: req.user!.id, seconds });
        res.status(201).json({ preset });
        return;
      }
      throw err;
    }
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await TimerPreset.deleteOne({ _id: req.params.id, userId: req.user!.id });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Timer não encontrado' });
      return;
    }
    res.status(204).end();
  })
);

export default router;
