import { Schema, model } from 'mongoose';

const registrationEmailCodeSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  codeHash: { type: String, required: true },
  payloadJson: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

registrationEmailCodeSchema.index({ email: 1 });
registrationEmailCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RegistrationEmailCode = model('RegistrationEmailCode', registrationEmailCodeSchema);
