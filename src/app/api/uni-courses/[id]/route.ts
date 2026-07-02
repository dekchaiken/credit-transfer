import { pick } from '@/lib/helpers';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { UniCourse } from '@/models/UniCourse';
import { TransferGroup } from '@/models/TransferGroup';
import { CourseOffering } from '@/models/CourseOffering';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin', 'committee']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const rawB = await req.json();
  const b = pick(rawB, ['code', 'nameTh', 'nameEn', 'credits', 'creditHours']);

  if (b.code && !/^[\d\s-]+$/.test(b.code)) {
    return NextResponse.json({ error: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }, { status: 400 });
  }

  const before: any = await UniCourse.findById(id).lean();
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await UniCourse.findByIdAndUpdate(id, b);

  await logAudit({
    session, request: req,
    action: 'unicourse.update',
    entityType: 'UniCourse',
    entityId: String(id),
    entityLabel: `${before.code} ${before.nameTh}`,
    before: { code: before.code, nameTh: before.nameTh, nameEn: before.nameEn || '', credits: before.credits, creditHours: before.creditHours },
    after: {
      code: b.code ?? before.code,
      nameTh: b.nameTh ?? before.nameTh,
      nameEn: b.nameEn ?? before.nameEn,
      credits: b.credits ?? before.credits,
      creditHours: b.creditHours ?? before.creditHours,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin', 'committee']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const before: any = await UniCourse.findById(id).lean();
  if (!before) return NextResponse.json({ ok: true });

  const groupCount = await TransferGroup.countDocuments({ uniCourseId: id });
  const offeringCount = await CourseOffering.countDocuments({ uniCourseId: id });

  await TransferGroup.deleteMany({ uniCourseId: id });
  await CourseOffering.deleteMany({ uniCourseId: id });
  await UniCourse.findByIdAndDelete(id);

  await logAudit({
    session, request: req,
    action: 'unicourse.delete',
    entityType: 'UniCourse',
    entityId: String(id),
    entityLabel: `${before.code} ${before.nameTh}`,
    before: { code: before.code, nameTh: before.nameTh, nameEn: before.nameEn || '', credits: before.credits },
    metadata: { cascadeDeleted: { transferGroups: groupCount, offerings: offeringCount } },
  });

  return NextResponse.json({ ok: true });
}
