import { Schema, model } from 'mongoose';

const categoriaSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  nome: { type: String, required: true, trim: true, maxlength: 120 },
  createdAt: { type: Date, default: Date.now },
});

categoriaSchema.index({ userId: 1, nome: 1 }, { unique: true });

export const Categoria = model('Categoria', categoriaSchema);
