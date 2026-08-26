import { Router } from 'express';

import { requireAuth } from '../middleware/requireAuth';
import { Categoria } from '../models/Categoria';
import { Exercicio } from '../models/Exercicio';
import { asyncHandler } from '../utils/asyncHandler';
import { paginateFind, parseLimit, type SortSpec } from '../utils/pagination';
import { createCategoriaSchema, updateCategoriaSchema } from '../validation/workout';

const router = Router();
router.use(requireAuth);

const MAX_CATEGORIAS = 50;

// See exercicios.ts for why the default limit equals the resource's own hard cap.
const CATEGORIAS_SORT: SortSpec[] = [
  { field: 'ordem', direction: 1 },
  { field: 'nome', direction: 1 },
  { field: '_id', direction: 1 },
];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit, MAX_CATEGORIAS);
    const { items: categorias, nextCursor } = await paginateFind(
      Categoria,
      { userId: req.user!.id },
      CATEGORIAS_SORT,
      { cursor: req.query.cursor, limit }
    );
    res.status(200).json({ categorias, nextCursor });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { id, nome, descricao } = createCategoriaSchema.parse(req.body);

    const existing = await Categoria.findOne({ _id: id, userId: req.user!.id });
    if (!existing) {
      const count = await Categoria.countDocuments({ userId: req.user!.id });
      if (count >= MAX_CATEGORIAS) {
        res.status(409).json({ error: `Limite de ${MAX_CATEGORIAS} categorias atingido` });
        return;
      }
    }

    const categoria = await Categoria.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $setOnInsert: { _id: id, userId: req.user!.id, nome, descricao } },
      { upsert: true, new: true }
    );
    res.status(201).json({ categoria });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = updateCategoriaSchema.parse(req.body);
    const categoria = await Categoria.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { $set: body },
      { new: true }
    );
    if (!categoria) {
      res.status(404).json({ error: 'Categoria não encontrada' });
      return;
    }
    res.status(200).json({ categoria });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const exercicioCount = await Exercicio.countDocuments({ userId: req.user!.id, categoriaId: req.params.id });
    if (exercicioCount > 0) {
      res.status(409).json({ error: 'Existem exercícios vinculados a esta categoria' });
      return;
    }

    const result = await Categoria.deleteOne({ _id: req.params.id, userId: req.user!.id });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Categoria não encontrada' });
      return;
    }
    res.status(204).end();
  })
);

export default router;
