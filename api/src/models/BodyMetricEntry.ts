import { Schema, model } from 'mongoose';

const medidasSchema = new Schema(
  {
    cintura: { type: Number },
    quadril: { type: Number },
    peito: { type: Number },
    pescoco: { type: Number },
    bracoEsquerdo: { type: Number },
    bracoDireito: { type: Number },
    coxaEsquerda: { type: Number },
    coxaDireita: { type: Number },
  },
  { _id: false }
);

/** One document per user per goal per date, same shape as Attendance — existência de registro
 * numa data não é o sinal aqui (ao contrário de Attendance), então tem campos de verdade em vez de
 * só _id. Escopado por `goalId` (ver `BodyGoal`) — cada meta tem seu próprio histórico, não existe
 * mais um único stream contínuo por usuário. */
const bodyMetricEntrySchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  goalId: { type: String, ref: 'BodyGoal', required: true },
  date: { type: String, required: true },
  pesoKg: { type: Number },
  medidas: { type: medidasSchema },
  observacoes: { type: String, trim: true, maxlength: 300 },
  createdAt: { type: Date, default: Date.now },
});

bodyMetricEntrySchema.index({ userId: 1, goalId: 1, date: 1 }, { unique: true });

export const BodyMetricEntry = model('BodyMetricEntry', bodyMetricEntrySchema);
