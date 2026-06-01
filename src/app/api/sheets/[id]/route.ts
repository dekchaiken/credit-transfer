import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { TransferSheet } from '@/models/TransferSheet';
import { Student } from '@/models/Student';
import { TransferGroup } from '@/models/TransferGroup';
import { requireRole, getSession } from '@/lib/auth';
import { findCoursesByYearId } from '@/lib/courseQueries';

// GET /api/sheets/[idOrStudentId]?byStudent=1
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const url = new URL(req.url);
  const byStudent = url.searchParams.get('byStudent') === '1';

  let sheet: any;
  let student: any;
  if (byStudent) {
    student = await Student.findById(id).populate('yearId').populate('programId').lean();
    if (!student) return NextResponse.json({ error: 'student not found' }, { status: 404 });
    sheet = await TransferSheet.findOne({ studentId: student._id }).lean();
    if (!sheet) sheet = { studentId: student._id, yearId: student.yearId._id, selections: [], committee: [], status: 'draft' };
  } else {
    sheet = await TransferSheet.findById(id).lean();
    if (!sheet) return NextResponse.json({ error: 'not found' }, { status: 404 });
    student = await Student.findById(sheet.studentId).populate('yearId').populate('programId').lean();
  }

  // permission: student can only see own
  const session = await getSession();
  const role = (session?.user as any)?.role;
  if (role === 'student') {
    const sid = (session?.user as any)?.studentId;
    if (!student || student.studentId !== sid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const yearIdRaw = (student?.yearId?._id) || student?.yearId;
  const courses = await findCoursesByYearId(String(yearIdRaw));
  const groups = await TransferGroup.find({ uniCourseId: { $in: courses.map((c: any) => c._id) } }).sort({ groupNo: 1 }).lean();

  return NextResponse.json({ sheet, student, courses, groups });
}

// PATCH = update selections / committee / signMonthYear / status
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher', 'committee']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  const url = new URL(req.url);
  const byStudent = url.searchParams.get('byStudent') === '1';
  const body = await req.json();
  const session = await getSession();
  const role = (session?.user as any)?.role;

  // committee can only transition: pending_review → finalized or pending_review → draft
  if (role === 'committee' && body.status && !['pending_review', 'finalized', 'draft'].includes(body.status)) {
    return NextResponse.json({ error: 'forbidden status transition' }, { status: 403 });
  }

  let sheet;
  if (byStudent) {
    const stu = await Student.findById(id);
    if (!stu) return NextResponse.json({ error: 'no student' }, { status: 404 });
    const existing = await TransferSheet.findOne({ studentId: stu._id });
    if (role === 'committee' && existing && !['pending_review', 'finalized'].includes(existing.status)) {
      return NextResponse.json({ error: 'forbidden: not pending_review' }, { status: 403 });
    }
    sheet = await TransferSheet.findOneAndUpdate(
      { studentId: stu._id },
      { ...body, studentId: stu._id, yearId: stu.yearId },
      { upsert: true, new: true }
    );
  } else {
    const existing = await TransferSheet.findById(id);
    if (role === 'committee' && (!existing || existing.status !== 'pending_review')) {
      return NextResponse.json({ error: 'forbidden: not pending_review' }, { status: 403 });
    }
    sheet = await TransferSheet.findByIdAndUpdate(id, body, { new: true });
  }
  return NextResponse.json(sheet);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  await TransferSheet.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
