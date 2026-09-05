import { Schema, model } from 'mongoose';

const timerPresetSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  seconds: { type: Number, required: true, min: 1, max: 3600 },
  createdAt: { type: Date, default: Date.now },
});

timerPresetSchema.index({ userId: 1, seconds: 1 }, { unique: true });

export const TimerPreset = model('TimerPreset', timerPresetSchema);
