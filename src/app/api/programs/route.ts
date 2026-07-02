import { pick } from '@/lib/helpers';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Program } from '@/models/Program';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET() {
  await dbConnect();
  return NextResponse.json(await Program.find().sort({ createdAt: -1 }).lean());
}

export async function POST(req: Request) {
  let session;
  try { session = await requireRole(['admin', 'committee']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const rawB = await req.json();
  const b = pick(rawB, ['nameTh', 'nameEn', 'code', 'faculty']);
  if (!b.nameTh) return NextResponse.json({ error: 'missing' }, { status: 400 });
  const p = await Program.create(b);

  await logAudit({
    session, request: req,
    action: 'program.create',
    entityType: 'Program',
    entityId: String(p._id),
    entityLabel: `${b.nameTh}${b.code ? ` (${b.code})` : ''}`,
    after: { nameTh: b.nameTh, nameEn: b.nameEn || '', code: b.code || '', faculty: b.faculty || '' },
  });

  return NextResponse.json(p.toObject());
}
