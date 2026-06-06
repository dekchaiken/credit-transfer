import { pick } from '@/lib/helpers';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { TransferGroup } from '@/models/TransferGroup';
import { UniCourse } from '@/models/UniCourse';
import { requireRole, getSession } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await dbConnect();
  const uniId = new URL(req.url).searchParams.get('uniCourseId');
  const q = uniId ? { uniCourseId: uniId } : {};
  return NextResponse.json(await TransferGroup.find(q).sort({ groupNo: 1 }).lean());
}

export async function POST(req: Request) {
  let session;
  try { session = await requireRole(['admin', 'teacher']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const rawB = await req.json();
  const b = pick(rawB, ['uniCourseId', 'groupNo', 'externalCourses']);
  if (!b.uniCourseId || !b.groupNo) return NextResponse.json({ error: 'missing' }, { status: 400 });

  if (b.externalCourses && Array.isArray(b.externalCourses)) {
    const invalidCodes = b.externalCourses.filter((ex: any) => ex.code && !/^[\d\s-]+$/.test(ex.code));
    if (invalidCodes.length > 0) {
      return NextResponse.json({ error: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }, { status: 400 });
    }
  }

  const doc = await TransferGroup.create(b);

  const course: any = await UniCourse.findById(b.uniCourseId).select('code nameTh').lean();
  await logAudit({
    session, request: req,
    action: 'transfergroup.create',
    entityType: 'TransferGroup',
    entityId: String(doc._id),
    entityLabel: course ? `${course.code} ${course.nameTh} • กลุ่ม ${b.groupNo}` : `กลุ่ม ${b.groupNo}`,
    after: {
      uniCourseId: String(b.uniCourseId),
      groupNo: b.groupNo,
      externalCoursesCount: Array.isArray(b.externalCourses) ? b.externalCourses.length : 0,
    },
  });

  return NextResponse.json(doc);
}
