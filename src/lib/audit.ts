import { AuditLog } from '@/models/AuditLog';
import { dbConnect } from '@/lib/db';
import { getSession } from '@/lib/auth';

export type AuditAction =
  // user
  | 'user.create' | 'user.update' | 'user.delete' | 'user.reset_password'
  | 'user.assign_year' | 'user.unassign_year' | 'user.change_role'
  // year
  | 'year.create' | 'year.create_empty' | 'year.update' | 'year.delete' | 'year.delete_all' | 'year.bulk_create'
  // faculty / program / course catalog
  | 'faculty.create' | 'faculty.update' | 'faculty.delete'
  | 'program.create' | 'program.update' | 'program.delete'
  | 'unicourse.create' | 'unicourse.update' | 'unicourse.delete'
  | 'unicourse.update_offerings'
  | 'transfergroup.create' | 'transfergroup.update' | 'transfergroup.delete'
  // student
  | 'student.create' | 'student.update' | 'student.delete' | 'student.import'
  // sheet
  | 'sheet.update' | 'sheet.delete'
  | 'sheet.submit_review' | 'sheet.finalize' | 'sheet.unfinalize' | 'sheet.recall'
  // settings
  | 'settings.update';

export type AuditEntityType =
  | 'User' | 'AcademicYear' | 'Year' | 'Faculty' | 'Program'
  | 'UniCourse' | 'CourseOffering' | 'TransferGroup'
  | 'Student' | 'TransferSheet' | 'Settings';

export interface LogAuditInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityLabel?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  status?: 'success' | 'failed';
  errorMessage?: string;
  /** ส่ง session มาตรงๆ ถ้ามีอยู่แล้ว (เลี่ยง getSession ซ้ำ) */
  session?: any;
  /** request — ใช้ดึง ip / userAgent อัตโนมัติ */
  request?: Request;
}

/**
 * คำนวณ diff: เก็บเฉพาะ key ที่ค่าต่างกันจริง (ลด noise)
 * - skip: ฟิลด์ระบบที่ไม่อยากเห็นใน log (passwordHash, _id, timestamps)
 */
const SKIP_FIELDS = new Set(['_id', '__v', 'passwordHash', 'createdAt', 'updatedAt']);

function normalize(v: any): any {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && v._bsontype === 'ObjectId') return String(v);
  if (Array.isArray(v)) return v.map(normalize);
  if (typeof v === 'object') {
    const out: any = {};
    for (const k of Object.keys(v)) {
      if (SKIP_FIELDS.has(k)) continue;
      out[k] = normalize(v[k]);
    }
    return out;
  }
  return v;
}

function diffShallow(before: any, after: any): Record<string, { from: any; to: any }> | null {
  const a = normalize(before) || {};
  const b = normalize(after) || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const diff: Record<string, { from: any; to: any }> = {};
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      diff[k] = { from: av ?? null, to: bv ?? null };
    }
  }
  return Object.keys(diff).length === 0 ? null : diff;
}

/**
 * บันทึก audit log แบบ fire-and-forget — ห้าม throw ออกไปข้างนอก
 * เพราะถ้า log error ตามมาทำให้ business action ที่สำเร็จแล้ว rollback
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    await dbConnect();
    const session = input.session || (await getSession().catch(() => null));
    const actor = (session?.user as any) || null;

    let metadata: Record<string, unknown> = { ...(input.metadata || {}) };
    if (input.request) {
      const ip =
        input.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        input.request.headers.get('x-real-ip') ||
        '';
      const ua = input.request.headers.get('user-agent') || '';
      if (ip) metadata.ip = ip;
      if (ua) metadata.userAgent = ua;
    }

    const before = input.before !== undefined ? normalize(input.before) : undefined;
    const after = input.after !== undefined ? normalize(input.after) : undefined;
    const diff =
      before !== undefined && after !== undefined ? diffShallow(before, after) : null;

    let changes: any = null;
    if (before !== undefined || after !== undefined) {
      changes = { before: before ?? null, after: after ?? null, diff };
    }

    await AuditLog.create({
      actorId: actor?.userId || actor?.id || null,
      actorUsername: actor?.username || actor?.name || '',
      actorRole: actor?.role || '',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || '',
      entityLabel: input.entityLabel || '',
      changes,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
      status: input.status || 'success',
      errorMessage: input.errorMessage || '',
    });
  } catch (err) {
    // ห้าม throw — fire-and-forget. Log ลง stderr เผื่อ debug.
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write log:', err);
  }
}

/**
 * เปรียบเทียบสมาชิก array สำหรับ assignedYears
 * คืน { added, removed } เพื่อใช้ทำ diff event แยก assign/unassign
 */
export function diffArray<T>(before: T[] = [], after: T[] = []): { added: T[]; removed: T[] } {
  const b = new Set(before.map(v => JSON.stringify(v)));
  const a = new Set(after.map(v => JSON.stringify(v)));
  const added: T[] = [];
  const removed: T[] = [];
  for (const v of after) if (!b.has(JSON.stringify(v))) added.push(v);
  for (const v of before) if (!a.has(JSON.stringify(v))) removed.push(v);
  return { added, removed };
}
