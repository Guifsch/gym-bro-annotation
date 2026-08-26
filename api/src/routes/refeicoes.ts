import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { Refeicao } from '../models/Refeicao';
import { asyncHandler } from '../utils/asyncHandler';
import { paginateFind, parseLimit, type SortSpec } from '../utils/pagination';
import { createRefeicaoSchema, updateRefeicaoSchema } from '../validation/refeicao';

const router = Router();
router.use(requireAuth);

const MAX_REFEICOES = 200;

// See exercicios.ts for why the default limit equals the resource's own hard cap. `createdAt`'s
// cursor value round-trips through JSON as an ISO string, so it needs `parse` to become a real
// `Date` again before Mongo compares it against the `Date`-typed field.
const REFEICOES_SORT: SortSpec[] = [
  { field: 'createdAt', direction: -1, parse: (raw) => new Date(raw as string) },
  { field: '_id', direction: 1 },
];

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
    const limit = parseLimit(req.query.limit, MAX_REFEICOES);
    const { items: refeicoes, nextCursor } = await paginateFind(Refeicao, { userId: req.user!.id }, REFEICOES_SORT, {
      cursor: req.query.cursor,
      limit,
    });
    res.status(200).json({ refeicoes, nextCursor });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { id, nome, dates, blocos, observacoes } = createRefeicaoSchema.parse(req.body);

    const existing = await Refeicao.findOne({ _id: id, userId: req.user!.id });
    if (!existing) {
      const count = await Refeicao.countDocuments({ userId: req.user!.id });
      if (count >= MAX_REFEICOES) {
        res.status(409).json({ error: `Limite de ${MAX_REFEICOES} refeições atingido` });
        return;
      }
    }

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
