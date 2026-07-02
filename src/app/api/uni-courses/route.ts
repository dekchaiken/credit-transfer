import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { UniCourse } from '@/models/UniCourse';
import { CourseOffering } from '@/models/CourseOffering';
import { requireRole, getSession } from '@/lib/auth';
import { checkYearIdAccess } from '@/lib/yearAccess';
import { findCoursesByYearId, findOrCreateCatalogCourse } from '@/lib/courseQueries';
import { logAudit } from '@/lib/audit';

export async function GET(req: Request) {
  await dbConnect();
  const yearId = new URL(req.url).searchParams.get('yearId');
  if (yearId) {
    const session = await getSession();
    const access = await checkYearIdAccess(yearId, session);
    if (!access.ok) return access.response;
    return NextResponse.json(await findCoursesByYearId(yearId));
  }
  const courses: any[] = await UniCourse.find({}).sort({ code: 1 }).lean();
  const counts: { _id: any; n: number }[] = await CourseOffering.aggregate([
    { $group: { _id: '$uniCourseId', n: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map(c => [String(c._id), c.n]));
  return NextResponse.json(
    courses.map(c => ({ ...c, offeringCount: countMap.get(String(c._id)) ?? 0 })),
  );
}

export async function POST(req: Request) {
  let session;
  try { session = await requireRole(['admin', 'committee']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const b = await req.json();
  if (!b.code || !b.nameTh) return NextResponse.json({ error: 'missing' }, { status: 400 });

  if (!/^[\d\s-]+$/.test(b.code)) {
    return NextResponse.json({ error: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }, { status: 400 });
  }

  if (b.yearId) {
    const access = await checkYearIdAccess(b.yearId, session);
    if (!access.ok) return access.response;
  }

  let course;
  let createdNew = false;
  try {
    const r = await findOrCreateCatalogCourse({
      code: b.code, nameTh: b.nameTh, nameEn: b.nameEn,
      credits: b.credits, creditHours: b.creditHours,
      yearId: b.yearId, order: b.order,
    });
    course = r.course;
    createdNew = !!r.isNew;
  } catch (e: any) {
    if (e.code === 'NAME_CONFLICT') return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }

  if (b.yearId) {
    const maxOrder = await CourseOffering
      .find({ yearId: b.yearId }).sort({ order: -1 }).limit(1).lean()
      .then((rows: any[]) => rows[0]?.order ?? 0);

    const existing: any = await CourseOffering.findOne({ uniCourseId: course._id, yearId: b.yearId }).lean();
    if (!existing) {
      await CourseOffering.create({ uniCourseId: course._id, yearId: b.yearId, order: maxOrder + 1 });
    }
  }

  if (createdNew) {
    await logAudit({
      session, request: req,
      action: 'unicourse.create',
      entityType: 'UniCourse',
      entityId: String(course._id),
      entityLabel: `${b.code} ${b.nameTh}`,
      after: { code: b.code, nameTh: b.nameTh, nameEn: b.nameEn || '', credits: b.credits, creditHours: b.creditHours },
      metadata: b.yearId ? { offeringCreatedFor: String(b.yearId) } : undefined,
    });
  }

  return NextResponse.json(course);
}
