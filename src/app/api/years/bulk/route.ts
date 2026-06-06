import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { AcademicYear } from '@/models/AcademicYear';
import { Program } from '@/models/Program';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/years/bulk
 * Open an academic year for ALL programs in the system at once.
 */
export async function POST(req: Request) {
  let session;
  try { session = await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();

  const b = await req.json();
  const year = Number(b?.year);
  const level = (b?.level || 'เทียบโอน') as string;

  if (!year || year < 2400 || year > 2700) {
    return NextResponse.json({ error: 'ปีไม่ถูกต้อง' }, { status: 400 });
  }

  const programs = await Program.find().select('_id').lean();
  if (programs.length === 0) {
    return NextResponse.json({ error: 'ยังไม่มีสาขาในระบบ' }, { status: 400 });
  }

  const docs = programs.map(p => ({ year, programId: p._id, level }));

  let created = 0;
  try {
    const r = await AcademicYear.insertMany(docs, { ordered: false });
    created = Array.isArray(r) ? r.length : 0;
  } catch (err: any) {
    if (err?.insertedDocs) created = err.insertedDocs.length;
    else if (err?.result?.insertedCount != null) created = err.result.insertedCount;
  }

  const skipped = programs.length - created;

  await logAudit({
    session, request: req,
    action: 'year.bulk_create',
    entityType: 'AcademicYear',
    entityLabel: `เปิดปี ${year} ทุกสาขา`,
    metadata: { year, level, created, skipped, totalPrograms: programs.length },
  });

  return NextResponse.json({
    created,
    skipped,
    total: programs.length,
    year,
  });
}
