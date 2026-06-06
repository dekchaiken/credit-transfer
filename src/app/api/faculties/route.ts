import { pick } from '@/lib/helpers';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Faculty } from '@/models/Faculty';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET() {
  await dbConnect();
  return NextResponse.json(await Faculty.find().sort({ nameTh: 1 }).lean());
}

export async function POST(req: Request) {
  let session;
  try { session = await requireRole(['admin', 'teacher']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const rawB = await req.json();
  const b = pick(rawB, ['nameTh', 'nameEn']);
  if (!b.nameTh) return NextResponse.json({ error: 'missing nameTh' }, { status: 400 });
  const exists = await Faculty.findOne({ nameTh: b.nameTh });
  if (exists) return NextResponse.json({ error: 'duplicate' }, { status: 400 });
  const created = await Faculty.create(b);

  await logAudit({
    session, request: req,
    action: 'faculty.create',
    entityType: 'Faculty',
    entityId: String(created._id),
    entityLabel: b.nameTh,
    after: { nameTh: b.nameTh, nameEn: b.nameEn || '' },
  });

  return NextResponse.json(created);
}
