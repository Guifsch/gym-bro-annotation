import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { TimerPreset } from '../models/TimerPreset';
import { asyncHandler } from '../utils/asyncHandler';
import { createTimerPresetSchema } from '../validation/timerPreset';

const router = Router();
router.use(requireAuth);

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
    const preset = await TimerPreset.findOneAndUpdate(
      { userId: req.user!.id, seconds },
      { $setOnInsert: { _id: id, userId: req.user!.id, seconds } },
      { upsert: true, new: true }
    );
    res.status(201).json({ preset });
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
