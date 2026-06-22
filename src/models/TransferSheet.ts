import { Schema, model, models } from 'mongoose';

const SelectionSchema = new Schema({
  uniCourseId: { type: Schema.Types.ObjectId, ref: 'UniCourse', required: true },
  groupNo: { type: Number, default: null },         // กลุ่มเทียบที่ถูกเลือก (null = ไม่เลือก)
  grade: { type: String, default: '' },             // เกรด (กรอกเป็น text เพื่อรองรับ A/B/C/2.00 ฯลฯ)
  outsideCE: { type: Boolean, default: false },     // นอกระบบ CE
  selected: { type: Boolean, default: false },      // กรรมการเลือก
  externalCourseCode: { type: String, default: null }, // รหัสวิชาย่อยที่เลือก (null = group-level legacy)
}, { _id: false });

const CommitteeSchema = new Schema({
  name: { type: String, default: '' },              // เช่น "ผู้ช่วยศาสตราจารย์ ดร.นิกร กรรณิกากลาง"
  role: { type: String, default: 'กรรมการ' },
}, { _id: false });

const TransferSheetSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  yearId: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
  selections: { type: [SelectionSchema], default: [] },
  committee: { type: [CommitteeSchema], default: [] },
  signMonthYear: { type: String, default: '' },     // "เมษายน 2569"
  status: { type: String, enum: ['draft', 'pending_review', 'finalized'], default: 'draft' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

TransferSheetSchema.index({ studentId: 1 }, { unique: true });

export const TransferSheet = models.TransferSheet || model('TransferSheet', TransferSheetSchema);
