import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { TransferGroup } from '@/models/TransferGroup';
import { requireRole } from '@/lib/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  const b = await req.json();

  // Validate: รหัสวิชาย่อยต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)
  if (b.externalCourses && Array.isArray(b.externalCourses)) {
    const invalidCodes = b.externalCourses.filter((ex: any) => ex.code && !/^[\d\s-]+$/.test(ex.code));
    if (invalidCodes.length > 0) {
      return NextResponse.json({ error: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }, { status: 400 });
    }
  }

  await TransferGroup.findByIdAndUpdate(id, b);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  await TransferGroup.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
