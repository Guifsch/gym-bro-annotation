import { Schema, model } from 'mongoose';

/** One document per day the user checked "fui na academia" — existence is the signal, there's no
 * boolean field to flip. Unchecking a day just deletes its document. */
const attendanceSchema = new Schema({
  _id: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export const Attendance = model('Attendance', attendanceSchema);
