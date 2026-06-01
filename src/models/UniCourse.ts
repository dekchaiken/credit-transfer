import { Schema, model, models } from 'mongoose';

const UniCourseSchema = new Schema({
  // yearId is vestigial post-Phase-1: kept on legacy docs as the "originating
  // year", but new catalog-only entries can be created without it. Use
  // CourseOffering for the real per-year linkage.
  yearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: false, index: true },
  code: { type: String, required: true },
  nameTh: { type: String, required: true },
  nameEn: { type: String, default: '' },
  credits: { type: Number, default: 3 },
  creditHours: { type: String, default: '' },        // เช่น "3(0-6-3)"
  order: { type: Number, default: 0 },
}, { timestamps: true });

UniCourseSchema.index({ yearId: 1, code: 1 }, { unique: true, sparse: true });

export const UniCourse = models.UniCourse || model('UniCourse', UniCourseSchema);
