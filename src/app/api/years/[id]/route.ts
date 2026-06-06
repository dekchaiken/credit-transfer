import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { AcademicYear } from '@/models/AcademicYear';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const before: any = await AcademicYear.findById(id).populate('programId').lean();
  if (!before) return NextResponse.json({ ok: true });

  await AcademicYear.findByIdAndDelete(id);

  await logAudit({
    session, request: req,
    action: 'year.delete',
    entityType: 'AcademicYear',
    entityId: String(id),
    entityLabel: `ปี ${before.year} — ${(before.programId as any)?.nameTh || '-'}`,
    before: { year: before.year, programId: String(before.programId?._id || before.programId), level: before.level },
  });

  return NextResponse.json({ ok: true });
}
