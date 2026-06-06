import { pick } from '@/lib/helpers';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Faculty } from '@/models/Faculty';
import { Program } from '@/models/Program';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin', 'teacher']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const rawB = await req.json();
  const b = pick(rawB, ['nameTh', 'nameEn']);
  if (!b.nameTh) return NextResponse.json({ error: 'missing nameTh' }, { status: 400 });
  const old: any = await Faculty.findById(id).lean();
  if (!old) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const dup = await Faculty.findOne({ nameTh: b.nameTh, _id: { $ne: id } });
  if (dup) return NextResponse.json({ error: 'duplicate' }, { status: 400 });
  await Faculty.findByIdAndUpdate(id, { nameTh: b.nameTh, nameEn: b.nameEn ?? '' });
  if (old.nameTh !== b.nameTh) {
    await Program.updateMany(
      { faculty: old.nameTh },
      { faculty: b.nameTh },
    );
  }

  await logAudit({
    session, request: req,
    action: 'faculty.update',
    entityType: 'Faculty',
    entityId: String(id),
    entityLabel: b.nameTh,
    before: { nameTh: old.nameTh, nameEn: old.nameEn || '' },
    after: { nameTh: b.nameTh, nameEn: b.nameEn ?? '' },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin', 'teacher']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const before: any = await Faculty.findById(id).lean();
  if (!before) return NextResponse.json({ ok: true });

  await Faculty.findByIdAndDelete(id);

  await logAudit({
    session, request: req,
    action: 'faculty.delete',
    entityType: 'Faculty',
    entityId: String(id),
    entityLabel: before.nameTh,
    before: { nameTh: before.nameTh, nameEn: before.nameEn || '' },
  });

  return NextResponse.json({ ok: true });
}
