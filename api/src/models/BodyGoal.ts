import { Schema, model } from 'mongoose';

/** A tracking period the user defines for themselves ("Verão 2026", "Pós-férias") — each one owns
 * its own set of `BodyMetricEntry` docs (see `goalId` there), so someone who starts using this
 * feature, stops, and comes back years later to set a new target gets a clean new history instead
 * of one continuous stream mixing unrelated periods together. */
const bodyGoalSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  nome: { type: String, trim: true, maxlength: 80 },
  pesoMetaKg: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

bodyGoalSchema.index({ userId: 1, createdAt: -1 });

export const BodyGoal = model('BodyGoal', bodyGoalSchema);
