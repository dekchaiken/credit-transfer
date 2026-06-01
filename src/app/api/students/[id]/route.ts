import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Student } from '@/models/Student';
import { TransferSheet } from '@/models/TransferSheet';
import { User } from '@/models/User';
import { requireRole } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  const b = await req.json();
  if (!b.studentId || !b.fullName) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }
  const cur: any = await Student.findById(id).lean();
  if (!cur) return NextResponse.json({ error: 'not found' }, { status: 404 });

  if (b.studentId !== cur.studentId) {
    const dup = await Student.findOne({ studentId: b.studentId, _id: { $ne: id } });
    if (dup) return NextResponse.json({ error: 'duplicate studentId' }, { status: 400 });
  }

  await Student.findByIdAndUpdate(id, {
    studentId: b.studentId,
    fullName: b.fullName,
    level: b.level ?? cur.level,
    email: b.email ?? cur.email,
    faculty: b.faculty ?? cur.faculty,
  });

  // Sync linked User row when studentId changes (username == studentId)
  if (b.studentId !== cur.studentId) {
    const userDup = await User.findOne({ username: b.studentId });
    if (userDup) {
      return NextResponse.json({ error: 'studentId conflicts with an existing user' }, { status: 400 });
    }
    await User.updateOne(
      { role: 'student', studentId: cur.studentId },
      { $set: { username: b.studentId, studentId: b.studentId } },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  const stu: any = await Student.findById(id).lean();
  await TransferSheet.deleteMany({ studentId: id });
  await Student.findByIdAndDelete(id);
  if (stu?.studentId) {
    await User.deleteOne({ role: 'student', studentId: stu.studentId });
  }
  return NextResponse.json({ ok: true });
}
