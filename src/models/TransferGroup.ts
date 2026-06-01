import { Schema, model, models } from 'mongoose';

const ExternalCourseSchema = new Schema({
  code: { type: String, required: true },
  nameTh: { type: String, required: true },
  credits: { type: String, default: '3' },           // string เพราะมี "(0-2-0)" ปนได้
}, { _id: false });

const TransferGroupSchema = new Schema({
  uniCourseId: { type: Schema.Types.ObjectId, ref: 'UniCourse', required: true, index: true },
  groupNo: { type: Number, required: true },          // กลุ่มเทียบ 1,2,3...
  externalCourses: { type: [ExternalCourseSchema], default: [] },
}, { timestamps: true });

TransferGroupSchema.index({ uniCourseId: 1, groupNo: 1 }, { unique: true });

export const TransferGroup = models.TransferGroup || model('TransferGroup', TransferGroupSchema);
