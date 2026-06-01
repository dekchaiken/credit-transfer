import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { UniCourse } from '@/models/UniCourse';
import { TransferGroup } from '@/models/TransferGroup';
import { CourseOffering } from '@/models/CourseOffering';
import { requireRole } from '@/lib/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  const b = await req.json();

  // Validate: รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)
  if (b.code && !/^[\d\s-]+$/.test(b.code)) {
    return NextResponse.json({ error: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }, { status: 400 });
  }

  // Catalog edit — affects every program/year that uses this course
  await UniCourse.findByIdAndUpdate(id, b);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  // Catalog delete: cascade everything that points at this course.
  await TransferGroup.deleteMany({ uniCourseId: id });
  await CourseOffering.deleteMany({ uniCourseId: id });
  await UniCourse.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
