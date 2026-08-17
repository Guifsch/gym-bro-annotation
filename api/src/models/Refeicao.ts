import { Schema, model } from 'mongoose';

const refeicaoItemSchema = new Schema(
  {
    _id: { type: String, required: true },
    nome: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { _id: false }
);

const refeicaoBlocoSchema = new Schema(
  {
    _id: { type: String, required: true },
    nome: { type: String, required: true, trim: true, maxlength: 120 },
    horario: { type: String, trim: true, maxlength: 5 },
    itens: { type: [refeicaoItemSchema], default: [] },
  },
  { _id: false }
);

const refeicaoSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  nome: { type: String, required: true, trim: true, maxlength: 120 },
  dates: { type: [String], default: [] },
  blocos: { type: [refeicaoBlocoSchema], default: [] },
  observacoes: { type: String, trim: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
});

refeicaoSchema.index({ userId: 1, dates: 1 });

export const Refeicao = model('Refeicao', refeicaoSchema);
