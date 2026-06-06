import { pick } from '@/lib/helpers';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { AcademicYear } from '@/models/AcademicYear';
import { Program } from '@/models/Program';
import { requireRole, getSession } from '@/lib/auth';
import { getAssignedYears } from '@/lib/yearAccess';
import { logAudit } from '@/lib/audit';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json([], { status: 401 });
  await dbConnect();
  const role = (session.user as any)?.role;

  if (role === 'student') return NextResponse.json([]);

  const list: any[] = await AcademicYear.find({}).populate('programId').sort({ year: -1 }).lean();

  if (role === 'admin') {
    return NextResponse.json(list.map(y => ({ ...y, _accessible: true })));
  }

  const assigned = await getAssignedYears(session);
  const assignedSet = new Set(assigned);
  return NextResponse.json(
    list.map(y => ({ ...y, _accessible: assignedSet.has(y.year) })),
  );
}

export async function POST(req: Request) {
  let session;
  try { session = await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const rawB = await req.json();
  const b = pick(rawB, ['year', 'programId', 'level']);
  if (!b.year || !b.programId) return NextResponse.json({ error: 'missing' }, { status: 400 });
  const doc = await AcademicYear.create(b);

  const program: any = await Program.findById(b.programId).select('nameTh code').lean();
  await logAudit({
    session, request: req,
    action: 'year.create',
    entityType: 'AcademicYear',
    entityId: String(doc._id),
    entityLabel: `ปี ${b.year} — ${program?.nameTh || program?.code || b.programId}`,
    after: { year: b.year, programId: String(b.programId), level: b.level || 'เทียบโอน' },
  });

  return NextResponse.json(doc);
}
