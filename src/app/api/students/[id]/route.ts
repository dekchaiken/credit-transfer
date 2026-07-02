import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Student } from '@/models/Student';
import { TransferSheet } from '@/models/TransferSheet';
import { User } from '@/models/User';
import { requireRole } from '@/lib/auth';
import { checkYearIdAccess } from '@/lib/yearAccess';
import { logAudit } from '@/lib/audit';
import { pick } from '@/lib/helpers';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin', 'committee']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const rawB = await req.json();
  const b = pick(rawB, ['studentId', 'fullName', 'level', 'email', 'faculty']);
  if (!b.studentId || !b.fullName) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 });
  }
  const cur: any = await Student.findById(id).lean();
  if (!cur) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const access = await checkYearIdAccess(String(cur.yearId), session);
  if (!access.ok) return access.response;

  if (b.studentId !== cur.studentId) {
    const dup = await Student.findOne({ studentId: b.studentId, _id: { $ne: id } });
    if (dup) return NextResponse.json({ error: 'duplicate studentId' }, { status: 400 });

    // Check User conflict BEFORE updating anything
    const userDup = await User.findOne({ username: b.studentId });
    if (userDup) {
      return NextResponse.json({ error: 'studentId conflicts with an existing user' }, { status: 400 });
    }
  }

  const updateBody: any = {
    studentId: b.studentId,
    fullName: b.fullName,
    level: b.level ?? cur.level,
    email: b.email ?? cur.email,
    faculty: b.faculty ?? cur.faculty,
  };

  await Student.findByIdAndUpdate(id, updateBody);

  if (b.studentId !== cur.studentId) {
    await User.updateOne(
      { role: 'student', studentId: cur.studentId },
      { $set: { username: b.studentId, studentId: b.studentId } },
    );
  }

  await logAudit({
    session, request: req,
    action: 'student.update',
    entityType: 'Student',
    entityId: String(id),
    entityLabel: `${b.studentId} ${b.fullName}`,
    before: {
      studentId: cur.studentId,
      fullName: cur.fullName,
      level: cur.level || '',
      email: cur.email || '',
      faculty: cur.faculty || '',
    },
    after: updateBody,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin', 'committee']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const stu: any = await Student.findById(id).lean();
  if (!stu) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const access = await checkYearIdAccess(String(stu.yearId), session);
  if (!access.ok) return access.response;

  const sheetCount = await TransferSheet.countDocuments({ studentId: id });
  await TransferSheet.deleteMany({ studentId: id });
  await Student.findByIdAndDelete(id);
  if (stu?.studentId) {
    await User.deleteOne({ role: 'student', studentId: stu.studentId });
  }

  await logAudit({
    session, request: req,
    action: 'student.delete',
    entityType: 'Student',
    entityId: String(id),
    entityLabel: `${stu.studentId} ${stu.fullName}`,
    before: {
      studentId: stu.studentId,
      fullName: stu.fullName,
      yearId: String(stu.yearId),
      programId: String(stu.programId),
    },
    metadata: { cascadeDeleted: { transferSheets: sheetCount, userAccount: !!stu?.studentId } },
  });

  return NextResponse.json({ ok: true });
}
