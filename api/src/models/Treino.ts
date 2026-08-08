import { Schema, model } from 'mongoose';

const treinoSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  nome: { type: String, required: true, trim: true, maxlength: 120 },
  exercicioIds: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

treinoSchema.index({ userId: 1 });

export const Treino = model('Treino', treinoSchema);
