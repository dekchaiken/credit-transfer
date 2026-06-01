import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Faculty } from '@/models/Faculty';
import { Program } from '@/models/Program';
import { requireRole } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  const b = await req.json();
  if (!b.nameTh) return NextResponse.json({ error: 'missing nameTh' }, { status: 400 });
  const old = await Faculty.findById(id).lean() as any;
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
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  await Faculty.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
