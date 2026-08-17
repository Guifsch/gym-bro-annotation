import { Schema, model } from 'mongoose';

const historicoEntrySchema = new Schema(
  {
    _id: { type: String, required: true },
    nome: { type: String },
    descricao: { type: String },
    sets: { type: Number },
    reps: { type: Number },
    pesoKg: { type: Number },
    alteradoEm: { type: Date, default: Date.now },
  },
  { _id: false }
);

const exercicioSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  categoriaId: { type: String, ref: 'Categoria', required: true },
  nome: { type: String, required: true, trim: true, maxlength: 50 },
  descricao: { type: String, trim: true, maxlength: 200 },
  sets: { type: Number, required: true, min: 0, max: 50 },
  reps: { type: Number, required: true, min: 0, max: 500 },
  pesoKg: { type: Number, required: true, min: 0, max: 1000 },
  cargaMaximaKg: { type: Number, min: 0, max: 500 },
  capa: {
    type: { url: { type: String, required: true }, key: { type: String, required: true } },
    required: false,
    _id: false,
  },
  videoUrls: {
    type: [String],
    default: [],
    maxlength: 500,
    validate: {
      validator: (arr: string[]) => arr.length <= 5,
      message: 'Limite de 5 vídeos por exercício',
    },
  },
  imagens: {
    type: [{ url: { type: String, required: true }, key: { type: String, required: true } }],
    default: [],
    _id: false,
  },
  historico: { type: [historicoEntrySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

exercicioSchema.index({ userId: 1, categoriaId: 1, nome: 1 }, { unique: true });

export const Exercicio = model('Exercicio', exercicioSchema);
