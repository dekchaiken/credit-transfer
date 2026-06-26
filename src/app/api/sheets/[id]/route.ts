import { pick } from '@/lib/helpers';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { TransferSheet } from '@/models/TransferSheet';
import { Student } from '@/models/Student';
import { TransferGroup } from '@/models/TransferGroup';
import { requireRole, getSession } from '@/lib/auth';
import { checkYearIdAccess } from '@/lib/yearAccess';
import { findCoursesByYearId } from '@/lib/courseQueries';
import { logAudit, type AuditAction } from '@/lib/audit';

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

  // permission
  const session = await getSession();
  const role = (session?.user as any)?.role;
  if (role === 'student') {
    const sid = (session?.user as any)?.studentId;
    if (!student || student.studentId !== sid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  } else {
    const stuYearId = (student?.yearId?._id) || student?.yearId;
    const access = await checkYearIdAccess(String(stuYearId), session);
    if (!access.ok) return access.response;
  }

  const yearIdRaw = (student?.yearId?._id) || student?.yearId;
  const courses = await findCoursesByYearId(String(yearIdRaw));
  const groups = await TransferGroup.find({ uniCourseId: { $in: courses.map((c: any) => c._id) } }).sort({ groupNo: 1 }).lean();

  return NextResponse.json({ sheet, student, courses, groups });
}

// PATCH = update selections / committee / signMonthYear / status
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin', 'teacher', 'committee']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const url = new URL(req.url);
  const byStudent = url.searchParams.get('byStudent') === '1';
  const rawBody = await req.json();
  const body = pick(rawBody, ['selections', 'committee', 'signMonthYear', 'status', 'remark']);
  const role = (session.user as any).role;

  // เกรดต่ำกว่า 2 เทียบโอนไม่ได้ → บังคับ selected:false (defense-in-depth กัน client เก่า/data เดิม)
  if (Array.isArray(body.selections)) {
    body.selections = body.selections.map((s: any) => {
      const g = parseFloat(s?.grade);
      return !isNaN(g) && g < 2 ? { ...s, selected: false } : s;
    });
  }

  if (role === 'committee' && body.status && !['pending_review', 'finalized', 'draft'].includes(body.status)) {
    return NextResponse.json({ error: 'forbidden status transition' }, { status: 403 });
  }

  let sheet: any;
  let prevStatus: string | undefined;
  let studentLabel = '';

  if (byStudent) {
    const stu = await Student.findById(id);
    if (!stu) return NextResponse.json({ error: 'no student' }, { status: 404 });
    studentLabel = `${(stu as any).studentId} ${(stu as any).fullName}`;

    const access = await checkYearIdAccess(String(stu.yearId), session);
    if (!access.ok) return access.response;

    const existing: any = await TransferSheet.findOne({ studentId: stu._id }).lean();
    prevStatus = existing?.status;
    if (role === 'committee' && existing && !['pending_review', 'finalized'].includes(existing.status)) {
      return NextResponse.json({ error: 'forbidden: not pending_review' }, { status: 403 });
    }
    sheet = await TransferSheet.findOneAndUpdate(
      { studentId: stu._id },
      { ...body, studentId: stu._id, yearId: stu.yearId },
      { upsert: true, new: true }
    );
  } else {
    const existing: any = await TransferSheet.findById(id).lean();
    if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
    prevStatus = existing.status;

    const access = await checkYearIdAccess(String(existing.yearId), session);
    if (!access.ok) return access.response;

    if (role === 'committee' && existing.status !== 'pending_review') {
      return NextResponse.json({ error: 'forbidden: not pending_review' }, { status: 403 });
    }
    sheet = await TransferSheet.findByIdAndUpdate(id, body, { new: true });

    const stu: any = await Student.findById(existing.studentId).select('studentId fullName').lean();
    if (stu) studentLabel = `${stu.studentId} ${stu.fullName}`;
  }

  // === audit: log status transitions เป็น event แยกเฉพาะตัว ===
  const newStatus = sheet?.status;
  if (body.status && prevStatus !== newStatus) {
    let action: AuditAction = 'sheet.update';
    if (prevStatus === 'draft' && newStatus === 'pending_review') action = 'sheet.submit_review';
    else if (prevStatus === 'pending_review' && newStatus === 'finalized') action = 'sheet.finalize';
    else if (prevStatus === 'finalized' && newStatus === 'pending_review') action = 'sheet.unfinalize';
    else if (prevStatus === 'pending_review' && newStatus === 'draft') action = 'sheet.recall';

    await logAudit({
      session, request: req,
      action,
      entityType: 'TransferSheet',
      entityId: String(sheet._id),
      entityLabel: studentLabel || `ใบเทียบ ${sheet._id}`,
      metadata: { from: prevStatus || null, to: newStatus },
    });
  }

  return NextResponse.json(sheet);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin', 'teacher']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const existing: any = await TransferSheet.findById(id).lean();
  if (!existing) return NextResponse.json({ ok: true });

  const access = await checkYearIdAccess(String(existing.yearId), session);
  if (!access.ok) return access.response;

  await TransferSheet.findByIdAndDelete(id);

  const stu: any = await Student.findById(existing.studentId).select('studentId fullName').lean();
  await logAudit({
    session, request: req,
    action: 'sheet.delete',
    entityType: 'TransferSheet',
    entityId: String(id),
    entityLabel: stu ? `${stu.studentId} ${stu.fullName}` : `ใบเทียบ ${id}`,
    before: { status: existing.status, yearId: String(existing.yearId), studentId: String(existing.studentId) },
  });

  return NextResponse.json({ ok: true });
}
