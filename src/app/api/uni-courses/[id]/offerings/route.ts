import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { CourseOffering } from '@/models/CourseOffering';
import { AcademicYear } from '@/models/AcademicYear';
import { requireRole } from '@/lib/auth';

// GET — list offerings (program/year that this course is assigned to)
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const offerings: any[] = await CourseOffering.find({ uniCourseId: id })
    .populate({ path: 'yearId', populate: { path: 'programId' } })
    .lean();

  return NextResponse.json(
    offerings
      .filter(o => o.yearId)
      .map(o => ({
        _id: o._id,
        yearId: o.yearId._id,
        year: o.yearId.year,
        level: o.yearId.level,
        programId: o.yearId.programId?._id,
        programCode: o.yearId.programId?.code,
        programNameTh: o.yearId.programId?.nameTh,
        programFaculty: o.yearId.programId?.faculty,
        order: o.order,
      }))
      .sort((a, b) =>
        (b.year - a.year) ||
        String(a.programNameTh || '').localeCompare(String(b.programNameTh || ''))
      ),
  );
}

// PUT — bulk replace the set of offerings for this course.
// Body: { items: [{ yearId, order }] }. Anything missing in `items` gets deleted;
// anything new gets created; existing ones get their `order` updated.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  const body = await req.json();
  const items: { yearId: string; order?: number }[] = Array.isArray(body?.items) ? body.items : [];

  // Validate every yearId actually exists
  if (items.length > 0) {
    const ids = items.map(i => i.yearId);
    const existing = await AcademicYear.find({ _id: { $in: ids } }).select('_id').lean();
    if (existing.length !== new Set(ids).size) {
      return NextResponse.json({ error: 'invalid yearId in items' }, { status: 400 });
    }
  }

  const wantedYearIds = new Set(items.map(i => String(i.yearId)));

  // Delete offerings that aren't in the new set
  await CourseOffering.deleteMany({
    uniCourseId: id,
    yearId: { $nin: items.map(i => i.yearId) },
  });

  // Upsert each requested item
  for (const it of items) {
    await CourseOffering.updateOne(
      { uniCourseId: id, yearId: it.yearId },
      { $set: { order: typeof it.order === 'number' ? it.order : 0 } },
      { upsert: true },
    );
  }

  return NextResponse.json({ ok: true, count: wantedYearIds.size });
}
