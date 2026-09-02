import { Schema, model } from 'mongoose';

// `entries[]` (per-session sets/reps/pesoKg overrides) existed here until ago/2026 — removed in
// favor of a single source of truth (`Exercicio.sets/reps/pesoKg`, see exercicios.ts) updated
// directly, with every real change logged to `Exercicio.historico[]`. A `Sessao` now only marks
// "this treino happened on this date" — it doesn't carry its own performance data anymore.
const sessaoSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  treinoId: { type: String, ref: 'Treino', required: true },
  date: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

sessaoSchema.index({ userId: 1, treinoId: 1, date: 1 }, { unique: true });
sessaoSchema.index({ userId: 1, date: 1 });

export const Sessao = model('Sessao', sessaoSchema);
