import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { CourseOffering } from '@/models/CourseOffering';
import { AcademicYear } from '@/models/AcademicYear';
import { UniCourse } from '@/models/UniCourse';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

// GET — list offerings
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

// PUT — bulk replace the set of offerings
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const body = await req.json();
  const items: { yearId: string; order?: number }[] = Array.isArray(body?.items) ? body.items : [];

  if (items.length > 0) {
    const ids = items.map(i => i.yearId);
    const existing = await AcademicYear.find({ _id: { $in: ids } }).select('_id').lean();
    if (existing.length !== new Set(ids).size) {
      return NextResponse.json({ error: 'invalid yearId in items' }, { status: 400 });
    }
  }

  const wantedYearIds = new Set(items.map(i => String(i.yearId)));
  const beforeOfferings: any[] = await CourseOffering.find({ uniCourseId: id }).lean();
  const beforeIds = new Set(beforeOfferings.map(o => String(o.yearId)));

  await CourseOffering.deleteMany({
    uniCourseId: id,
    yearId: { $nin: items.map(i => i.yearId) },
  });

  for (const it of items) {
    await CourseOffering.updateOne(
      { uniCourseId: id, yearId: it.yearId },
      { $set: { order: typeof it.order === 'number' ? it.order : 0 } },
      { upsert: true },
    );
  }

  const added = items.filter(i => !beforeIds.has(String(i.yearId))).map(i => String(i.yearId));
  const removed = Array.from(beforeIds).filter(yId => !wantedYearIds.has(yId));

  if (added.length > 0 || removed.length > 0) {
    const course: any = await UniCourse.findById(id).select('code nameTh').lean();
    await logAudit({
      session, request: req,
      action: 'unicourse.update_offerings',
      entityType: 'UniCourse',
      entityId: String(id),
      entityLabel: course ? `${course.code} ${course.nameTh}` : String(id),
      metadata: { added, removed, finalCount: wantedYearIds.size },
    });
  }

  return NextResponse.json({ ok: true, count: wantedYearIds.size });
}
