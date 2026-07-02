import { pick } from '@/lib/helpers';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { TransferGroup } from '@/models/TransferGroup';
import { UniCourse } from '@/models/UniCourse';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin', 'committee']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const rawB = await req.json();
  const b = pick(rawB, ['groupNo', 'externalCourses', 'uniCourseId', 'requireAll']);

  if (b.externalCourses && Array.isArray(b.externalCourses)) {
    const invalidCodes = b.externalCourses.filter((ex: any) => ex.code && !/^[\d\s-]+$/.test(ex.code));
    if (invalidCodes.length > 0) {
      return NextResponse.json({ error: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }, { status: 400 });
    }
  }

  const before: any = await TransferGroup.findById(id).lean();
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await TransferGroup.findByIdAndUpdate(id, b);

  const course: any = await UniCourse.findById(before.uniCourseId).select('code nameTh').lean();
  await logAudit({
    session, request: req,
    action: 'transfergroup.update',
    entityType: 'TransferGroup',
    entityId: String(id),
    entityLabel: course ? `${course.code} ${course.nameTh} • กลุ่ม ${before.groupNo}` : `กลุ่ม ${before.groupNo}`,
    before: {
      groupNo: before.groupNo,
      externalCoursesCount: Array.isArray(before.externalCourses) ? before.externalCourses.length : 0,
    },
    after: {
      groupNo: b.groupNo ?? before.groupNo,
      externalCoursesCount: Array.isArray(b.externalCourses) ? b.externalCourses.length : (Array.isArray(before.externalCourses) ? before.externalCourses.length : 0),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin', 'committee']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const before: any = await TransferGroup.findById(id).lean();
  if (!before) return NextResponse.json({ ok: true });

  await TransferGroup.findByIdAndDelete(id);

  const course: any = await UniCourse.findById(before.uniCourseId).select('code nameTh').lean();
  await logAudit({
    session, request: req,
    action: 'transfergroup.delete',
    entityType: 'TransferGroup',
    entityId: String(id),
    entityLabel: course ? `${course.code} ${course.nameTh} • กลุ่ม ${before.groupNo}` : `กลุ่ม ${before.groupNo}`,
    before: {
      uniCourseId: String(before.uniCourseId),
      groupNo: before.groupNo,
      externalCoursesCount: Array.isArray(before.externalCourses) ? before.externalCourses.length : 0,
    },
  });

  return NextResponse.json({ ok: true });
}
