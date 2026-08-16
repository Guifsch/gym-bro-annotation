import { Schema, model } from 'mongoose';

const refeicaoItemSchema = new Schema(
  {
    _id: { type: String, required: true },
    nome: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { _id: false }
);

const refeicaoSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  nome: { type: String, required: true, trim: true, maxlength: 120 },
  date: { type: String },
  itens: { type: [refeicaoItemSchema], default: [] },
  observacoes: { type: String, trim: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
});

refeicaoSchema.index({ userId: 1, date: 1 });

export const Refeicao = model('Refeicao', refeicaoSchema);
