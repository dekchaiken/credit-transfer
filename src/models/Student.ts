import { Schema, model, models } from 'mongoose';

const StudentSchema = new Schema({
  studentId: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true },
  yearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true, index: true },
  level: { type: String, default: 'เทียบโอน' },
  faculty: { type: String, default: '' },
  email: { type: String, default: '' },
}, { timestamps: true });

export const Student = models.Student || model('Student', StudentSchema);
