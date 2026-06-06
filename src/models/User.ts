import { Schema, model, models, type InferSchemaType } from 'mongoose';

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String, default: '' },
  role: { type: String, enum: ['admin', 'teacher', 'committee', 'student'], required: true },
  studentId: { type: String, default: null, index: true },
  mustChangePassword: { type: Boolean, default: false },
  assignedYears: { type: [Number], default: [] },  // ปีการศึกษาที่ teacher/committee รับผิดชอบ เช่น [2569, 2570]
}, { timestamps: true });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: any };
export const User = models.User || model('User', UserSchema);
