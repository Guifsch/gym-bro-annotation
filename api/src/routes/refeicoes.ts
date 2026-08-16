import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { Refeicao } from '../models/Refeicao';
import { asyncHandler } from '../utils/asyncHandler';
import { createRefeicaoSchema, updateRefeicaoSchema } from '../validation/refeicao';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const refeicoes = await Refeicao.find({ userId: req.user!.id }).sort({ createdAt: -1 });
    res.status(200).json({ refeicoes });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { id, nome, date, itens, observacoes } = createRefeicaoSchema.parse(req.body);

    const refeicao = await Refeicao.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      {
        $setOnInsert: {
          _id: id,
          userId: req.user!.id,
          nome,
          date,
          itens: (itens ?? []).map((item) => ({ _id: item.id, nome: item.nome })),
          observacoes,
        },
      },
      { upsert: true, new: true }
    );
    res.status(201).json({ refeicao });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const refeicao = await Refeicao.findOne({ _id: req.params.id, userId: req.user!.id });
    if (!refeicao) {
      res.status(404).json({ error: 'Refeição não encontrada' });
      return;
    }
    res.status(200).json({ refeicao });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateRefeicaoSchema.parse(req.body);
    const { itens, ...rest } = body;

    const refeicao = await Refeicao.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { $set: { ...rest, ...(itens ? { itens: itens.map((item) => ({ _id: item.id, nome: item.nome })) } : {}) } },
      { new: true }
    );
    if (!refeicao) {
      res.status(404).json({ error: 'Refeição não encontrada' });
      return;
    }
    res.status(200).json({ refeicao });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await Refeicao.deleteOne({ _id: req.params.id, userId: req.user!.id });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Refeição não encontrada' });
      return;
    }
    res.status(204).end();
  })
);

export default router;
