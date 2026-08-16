import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { Refeicao } from '../models/Refeicao';
import { asyncHandler } from '../utils/asyncHandler';
import { createRefeicaoSchema, updateRefeicaoSchema } from '../validation/refeicao';

const router = Router();
router.use(requireAuth);

interface ItemInput {
  id: string;
  nome: string;
}

interface BlocoInput {
  id: string;
  nome: string;
  horario?: string;
  itens?: ItemInput[];
}

function mapItens(itens: ItemInput[]) {
  return itens.map((item) => ({ _id: item.id, nome: item.nome }));
}

function mapBlocos(blocos: BlocoInput[]) {
  return blocos.map((bloco) => ({
    _id: bloco.id,
    nome: bloco.nome,
    horario: bloco.horario,
    itens: mapItens(bloco.itens ?? []),
  }));
}

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
    const { id, nome, dates, blocos, observacoes } = createRefeicaoSchema.parse(req.body);

    const refeicao = await Refeicao.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      {
        $setOnInsert: {
          _id: id,
          userId: req.user!.id,
          nome,
          dates: dates ?? [],
          blocos: mapBlocos(blocos ?? []),
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
    const { blocos, ...rest } = body;

    const refeicao = await Refeicao.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      {
        $set: {
          ...rest,
          ...(blocos ? { blocos: mapBlocos(blocos) } : {}),
        },
      },
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
