import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Program } from '@/models/Program';
import { requireRole } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  const b = await req.json();
  if (!b.nameTh || !b.faculty) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }
  const r = await Program.findByIdAndUpdate(id, {
    nameTh: b.nameTh, nameEn: b.nameEn ?? '', faculty: b.faculty,
  });
  if (!r) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  await Program.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
