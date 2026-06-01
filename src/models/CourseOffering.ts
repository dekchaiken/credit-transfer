import { Schema, model, models } from 'mongoose';

// Links a UniCourse (central catalog) to an AcademicYear (program + ปี).
// Same UniCourse can be offered in multiple programs/years; each (course,year)
// pair has its own `order` for the curriculum sequence.
const CourseOfferingSchema = new Schema({
  uniCourseId: { type: Schema.Types.ObjectId, ref: 'UniCourse', required: true, index: true },
  yearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true, index: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

CourseOfferingSchema.index({ uniCourseId: 1, yearId: 1 }, { unique: true });

export const CourseOffering = models.CourseOffering || model('CourseOffering', CourseOfferingSchema);
