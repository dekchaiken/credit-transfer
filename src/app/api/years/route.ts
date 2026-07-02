import { pick } from '@/lib/helpers';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { AcademicYear } from '@/models/AcademicYear';
import { Program } from '@/models/Program';
import { Year } from '@/models/Year';
import { CourseOffering } from '@/models/CourseOffering';
import { requireRole, getSession } from '@/lib/auth';
import { getAssignedYears } from '@/lib/yearAccess';
import { logAudit } from '@/lib/audit';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json([], { status: 401 });
  await dbConnect();
  const role = (session.user as any)?.role;
  if (role === 'student') return NextResponse.json([]);

  const [rawList, standaloneYears]: [any[], any[]] = await Promise.all([
    AcademicYear.find({}).populate('programId').sort({ year: -1 }).lean(),
    Year.find({}).lean(),
  ]);
  // filter out orphaned AcademicYear docs (programId ref points to a deleted Program)
  const list = rawList.filter((y: any) => y.programId != null);

  // Inject standalone-year entries so empty years appear in the picker
  const yearNums = new Set(list.map((y: any) => y.year));
  for (const sy of standaloneYears) {
    if (!yearNums.has(sy.year)) {
      list.push({ _id: `standalone-${sy.year}`, year: sy.year, programId: null, level: '', _standalone: true });
    }
  }
  list.sort((a: any, b: any) => b.year - a.year);

  if (role === 'admin') return NextResponse.json(list.map((y: any) => ({ ...y, _accessible: true })));

  const assigned = await getAssignedYears(session);
  const assignedSet = new Set(assigned);
  return NextResponse.json(list.map((y: any) => ({ ...y, _accessible: assignedSet.has(y.year) })));
}

export async function POST(req: Request) {
  let session;
  try { session = await requireRole(['admin', 'committee']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const rawB = await req.json();
  const b = pick(rawB, ['year', 'programId', 'level']);
  if (!b.year) return NextResponse.json({ error: 'missing year' }, { status: 400 });

  // เพิ่มปีเปล่า — ไม่มี programId
  if (!b.programId) {
    await Year.findOneAndUpdate({ year: Number(b.year) }, { year: Number(b.year) }, { upsert: true });
    await logAudit({ session, request: req, action: 'year.create_empty', entityType: 'Year', entityLabel: `ปีเปล่า ${b.year}`, after: { year: b.year } });
    return NextResponse.json({ year: b.year, standalone: true });
  }

  const doc = await AcademicYear.create(b);
  const program: any = await Program.findById(b.programId).select('nameTh code').lean();
  await logAudit({ session, request: req, action: 'year.create', entityType: 'AcademicYear', entityId: String(doc._id), entityLabel: `ปี ${b.year} — ${program?.nameTh || program?.code || b.programId}`, after: { year: b.year, programId: String(b.programId), level: b.level || 'เทียบโอน' } });
  return NextResponse.json(doc);
}

/**
 * DELETE /api/years?yearNum=2569
 * ลบปีการศึกษาทั้งหมด (ทุก AcademicYear + standalone Year doc + cascade CourseOffering)
 * เฉพาะ admin เท่านั้น
 */
export async function DELETE(req: Request) {
  let session;
  try { session = await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();

  const url = new URL(req.url);
  const yearNum = url.searchParams.get('yearNum');
  if (!yearNum) return NextResponse.json({ error: 'missing yearNum' }, { status: 400 });

  const year = Number(yearNum);
  if (!year || year < 2400 || year > 2700) {
    return NextResponse.json({ error: 'ปีไม่ถูกต้อง' }, { status: 400 });
  }

  // หา AcademicYear IDs ทั้งหมดสำหรับปีนี้ เพื่อ cascade ลบ CourseOffering
  const academicYears = await AcademicYear.find({ year }).select('_id').lean();
  const academicYearIds = academicYears.map((y: any) => y._id);

  // Cascade: ลบ CourseOffering ที่อ้างอิงปีนี้
  let offeringCount = 0;
  if (academicYearIds.length > 0) {
    const offeringResult = await CourseOffering.deleteMany({ yearId: { $in: academicYearIds } });
    offeringCount = offeringResult.deletedCount;
  }

  // ลบ AcademicYear ทั้งหมดของปีนี้
  const yearResult = await AcademicYear.deleteMany({ year });

  // ลบ standalone Year doc (ถ้ามี)
  await Year.deleteOne({ year });

  await logAudit({
    session, request: req,
    action: 'year.delete_all',
    entityType: 'AcademicYear',
    entityLabel: `ลบปีการศึกษา ${year} ทั้งหมด`,
    metadata: { year, deletedAcademicYears: yearResult.deletedCount, deletedOfferings: offeringCount },
  });

  return NextResponse.json({ ok: true, deleted: yearResult.deletedCount, offeringsDeleted: offeringCount });
}
