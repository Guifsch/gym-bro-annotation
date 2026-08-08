import { Schema, model } from 'mongoose';

const exercicioSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  categoriaId: { type: String, ref: 'Categoria', required: true },
  nome: { type: String, required: true, trim: true, maxlength: 120 },
  descricao: { type: String, trim: true, maxlength: 500 },
  sets: { type: Number, required: true, min: 1, max: 50 },
  reps: { type: Number, required: true, min: 1, max: 500 },
  pesoKg: { type: Number, required: true, min: 0, max: 1000 },
  imagemUrl: { type: String },
  imagemKey: { type: String },
  createdAt: { type: Date, default: Date.now },
});

exercicioSchema.index({ userId: 1, categoriaId: 1, nome: 1 }, { unique: true });

export const Exercicio = model('Exercicio', exercicioSchema);
