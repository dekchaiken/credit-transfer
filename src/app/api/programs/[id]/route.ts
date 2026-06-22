import { pick } from '@/lib/helpers';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Program } from '@/models/Program';
import { AcademicYear } from '@/models/AcademicYear';
import { CourseOffering } from '@/models/CourseOffering';
import { Student } from '@/models/Student';
import { TransferSheet } from '@/models/TransferSheet';
import { User } from '@/models/User';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin', 'teacher']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const rawB = await req.json();
  const b = pick(rawB, ['nameTh', 'nameEn', 'faculty']);
  if (!b.nameTh || !b.faculty) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }
  const before: any = await Program.findById(id).lean();
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await Program.findByIdAndUpdate(id, {
    nameTh: b.nameTh, nameEn: b.nameEn ?? '', faculty: b.faculty,
  });

  await logAudit({
    session, request: req,
    action: 'program.update',
    entityType: 'Program',
    entityId: String(id),
    entityLabel: `${b.nameTh}${before.code ? ` (${before.code})` : ''}`,
    before: { nameTh: before.nameTh, nameEn: before.nameEn || '', faculty: before.faculty || '' },
    after: { nameTh: b.nameTh, nameEn: b.nameEn ?? '', faculty: b.faculty },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin', 'teacher']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const before: any = await Program.findById(id).lean();
  if (!before) return NextResponse.json({ ok: true });

  await Program.findByIdAndDelete(id);

  // Cascade: ลบ AcademicYear ทั้งหมดของ program นี้ + downstream
  const affectedYears: any[] = await AcademicYear.find({ programId: id }).select('_id').lean();
  for (const year of affectedYears) {
    const students: any[] = await Student.find({ yearId: year._id }).select('_id studentId').lean();
    for (const stu of students) {
      await TransferSheet.deleteMany({ studentId: stu._id });
      if (stu.studentId) await User.deleteOne({ role: 'student', studentId: stu.studentId });
    }
    await Student.deleteMany({ yearId: year._id });
    await CourseOffering.deleteMany({ yearId: year._id });
  }
  await AcademicYear.deleteMany({ programId: id });

  await logAudit({
    session, request: req,
    action: 'program.delete',
    entityType: 'Program',
    entityId: String(id),
    entityLabel: `${before.nameTh}${before.code ? ` (${before.code})` : ''}`,
    before: { nameTh: before.nameTh, nameEn: before.nameEn || '', code: before.code || '', faculty: before.faculty || '' },
  });

  return NextResponse.json({ ok: true });
}
