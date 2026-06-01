import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { UniCourse } from '@/models/UniCourse';
import { CourseOffering } from '@/models/CourseOffering';
import { requireRole } from '@/lib/auth';
import { findCoursesByYearId, findOrCreateCatalogCourse } from '@/lib/courseQueries';

export async function GET(req: Request) {
  await dbConnect();
  const yearId = new URL(req.url).searchParams.get('yearId');
  // Year-scoped: list courses offered in that AcademicYear (via CourseOffering)
  if (yearId) {
    return NextResponse.json(await findCoursesByYearId(yearId));
  }
  // Catalog mode: list every course + offeringCount (how many program/years use it)
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
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const b = await req.json();
  if (!b.code || !b.nameTh) return NextResponse.json({ error: 'missing' }, { status: 400 });

  // Validate: รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)
  if (!/^[\d\s-]+$/.test(b.code)) {
    return NextResponse.json({ error: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }, { status: 400 });
  }

  // Find-or-create catalog entry. yearId is OPTIONAL now — when provided,
  // also auto-create an offering in that year (legacy compatibility).
  let course;
  try {
    const r = await findOrCreateCatalogCourse({
      code: b.code, nameTh: b.nameTh, nameEn: b.nameEn,
      credits: b.credits, creditHours: b.creditHours,
      yearId: b.yearId, order: b.order,
    });
    course = r.course;
  } catch (e: any) {
    if (e.code === 'NAME_CONFLICT') return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }

  if (b.yearId) {
    // Determine per-year order: append after current max
    const maxOrder = await CourseOffering
      .find({ yearId: b.yearId }).sort({ order: -1 }).limit(1).lean()
      .then((rows: any[]) => rows[0]?.order ?? 0);

    const existing: any = await CourseOffering.findOne({ uniCourseId: course._id, yearId: b.yearId }).lean();
    if (!existing) {
      await CourseOffering.create({ uniCourseId: course._id, yearId: b.yearId, order: maxOrder + 1 });
    }
  }

  return NextResponse.json(course);
}
