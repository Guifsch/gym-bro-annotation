import { Schema, model } from 'mongoose';

const entrySchema = new Schema(
  {
    _id: { type: String },
    exercicioId: { type: String, ref: 'Exercicio', required: true },
    sets: { type: Number, min: 1, max: 50 },
    reps: { type: Number, min: 1, max: 500 },
    pesoKg: { type: Number, min: 0, max: 1000 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const sessaoSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  treinoId: { type: String, ref: 'Treino', required: true },
  date: { type: String, required: true },
  entries: { type: [entrySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

sessaoSchema.index({ userId: 1, treinoId: 1, date: 1 }, { unique: true });
sessaoSchema.index({ userId: 1, date: 1 });

export const Sessao = model('Sessao', sessaoSchema);
