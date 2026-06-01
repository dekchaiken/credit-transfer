import { Schema, model, models } from 'mongoose';

const AcademicYearSchema = new Schema({
  year: { type: Number, required: true },           // e.g. 2569
  programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true },
  level: { type: String, default: 'เทียบโอน' },
}, { timestamps: true });

AcademicYearSchema.index({ year: 1, programId: 1 }, { unique: true });

export const AcademicYear = models.AcademicYear || model('AcademicYear', AcademicYearSchema);
