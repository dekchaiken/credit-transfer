import { Schema, model, models, type InferSchemaType } from 'mongoose';

/**
 * AuditLog — บันทึกการกระทำของผู้ใช้ที่มีผลต่อข้อมูลในระบบ
 * ใช้สำหรับตรวจสอบย้อนหลัง (admin only)
 *
 * Convention: action = "<entityType>.<verb>"
 *   ตัวอย่าง: user.create, user.update, user.delete, user.reset_password,
 *            user.assign_year, user.unassign_year, year.create, sheet.finalize
 */
const AuditLogSchema = new Schema({
  // เวลา (ใช้ createdAt จาก timestamps แทน + index ลด query cost)
  // who
  actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  actorUsername: { type: String, default: '' },
  actorRole: { type: String, default: '' },
  // what
  action: { type: String, required: true, index: true },
  entityType: { type: String, required: true, index: true },
  entityId: { type: String, default: '', index: true },
  entityLabel: { type: String, default: '' },        // human-readable label
  // change details
  changes: { type: Schema.Types.Mixed, default: null },  // { before?, after?, diff? }
  metadata: { type: Schema.Types.Mixed, default: null }, // ip, userAgent, extra context
  // outcome
  status: { type: String, enum: ['success', 'failed'], default: 'success', index: true },
  errorMessage: { type: String, default: '' },
}, { timestamps: true });

// composite index ช่วย filter หน้า audit log ที่ใช้บ่อย
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof AuditLogSchema> & { _id: any };
export const AuditLog = models.AuditLog || model('AuditLog', AuditLogSchema);
