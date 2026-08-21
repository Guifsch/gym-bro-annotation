import { randomUUID } from 'crypto';

import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/requireAuth';
import { Attendance } from '../models/Attendance';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(requireAuth);

const dateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

const yearParamSchema = z.object({
  year: z.string().regex(/^\d{4}$/),
});

const monthQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  month: z.string().regex(/^(0[1-9]|1[0-2])$/),
});

const putBodySchema = z.object({ checked: z.boolean() });

// "/month" and "/summary/:year" are registered before "/:date" so they aren't swallowed by that
// single-segment wildcard.
router.get(
  '/month',
  asyncHandler(async (req, res) => {
    const { year, month } = monthQuerySchema.parse(req.query);
    const dates = await Attendance.distinct('date', {
      userId: req.user!.id,
      date: { $regex: `^${year}-${month}` },
    });
    res.status(200).json({ dates });
  })
);

router.get(
  '/summary/:year',
  asyncHandler(async (req, res) => {
    const { year } = yearParamSchema.parse(req.params);
    const dates = await Attendance.distinct('date', { userId: req.user!.id, date: { $regex: `^${year}-` } });

    const perMonth = Array(12).fill(0) as number[];
    for (const date of dates) {
      const monthIndex = Number(date.slice(5, 7)) - 1;
      if (monthIndex >= 0 && monthIndex < 12) perMonth[monthIndex] = (perMonth[monthIndex] ?? 0) + 1;
    }

    res.status(200).json({ year, total: dates.length, perMonth });
  })
);

router.get(
  '/:date',
  asyncHandler(async (req, res) => {
    const { date } = dateParamSchema.parse(req.params);
    const checked = await Attendance.exists({ userId: req.user!.id, date });
    res.status(200).json({ checked: Boolean(checked) });
  })
);

router.put(
  '/:date',
  asyncHandler(async (req, res) => {
    const { date } = dateParamSchema.parse(req.params);
    const { checked } = putBodySchema.parse(req.body);
    const userId = req.user!.id;

    if (checked) {
      await Attendance.findOneAndUpdate(
        { userId, date },
        { $setOnInsert: { _id: randomUUID(), userId, date } },
        { upsert: true }
      );
    } else {
      await Attendance.deleteOne({ userId, date });
    }

    res.status(200).json({ checked });
  })
);

export default router;
