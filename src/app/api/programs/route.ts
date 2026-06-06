import { pick } from '@/lib/helpers';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Program } from '@/models/Program';
import { AcademicYear } from '@/models/AcademicYear';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET() {
  await dbConnect();
  return NextResponse.json(await Program.find().sort({ createdAt: -1 }).lean());
}

export async function POST(req: Request) {
  let session;
  try { session = await requireRole(['admin', 'teacher']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const rawB = await req.json();
  const b = pick(rawB, ['nameTh', 'nameEn', 'code', 'faculty']);
  if (!b.nameTh) return NextResponse.json({ error: 'missing' }, { status: 400 });
  const p = await Program.create(b);

  let linkedYears = 0;
  try {
    const distinctYears: number[] = await AcademicYear.distinct('year');
    if (distinctYears.length > 0) {
      const docs = distinctYears.map(year => ({
        year,
        programId: p._id,
        level: 'เทียบโอน',
      }));
      try {
        const r = await AcademicYear.insertMany(docs, { ordered: false });
        linkedYears = Array.isArray(r) ? r.length : 0;
      } catch (err: any) {
        if (err?.insertedDocs) linkedYears = err.insertedDocs.length;
        else if (err?.result?.insertedCount != null) linkedYears = err.result.insertedCount;
      }
    }
  } catch {
    // Don't fail program creation if year-linking fails
  }

  await logAudit({
    session, request: req,
    action: 'program.create',
    entityType: 'Program',
    entityId: String(p._id),
    entityLabel: `${b.nameTh}${b.code ? ` (${b.code})` : ''}`,
    after: { nameTh: b.nameTh, nameEn: b.nameEn || '', code: b.code || '', faculty: b.faculty || '' },
    metadata: { linkedYears },
  });

  return NextResponse.json({ ...p.toObject(), linkedYears });
}
