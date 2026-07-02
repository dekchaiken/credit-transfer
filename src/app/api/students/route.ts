import { pick } from '@/lib/helpers';
import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Student } from '@/models/Student';
import { Program } from '@/models/Program';
import { AcademicYear } from '@/models/AcademicYear';
import { requireRole, getSession } from '@/lib/auth';
import { checkYearIdAccess, getAccessibleYearIds } from '@/lib/yearAccess';
import { ensureStudentUser } from '@/lib/studentUser';
import { getSetting, SETTING_KEYS } from '@/models/Settings';
import { logAudit } from '@/lib/audit';

export async function GET(req: Request) {
  await dbConnect();
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (role === 'student') return NextResponse.json([]);

  const url = new URL(req.url);
  const yearId = url.searchParams.get('yearId');
  const q: any = {};

  if (yearId) {
    const access = await checkYearIdAccess(yearId, session);
    if (!access.ok) return access.response;
    q.yearId = yearId;
  } else if (role !== 'admin') {
    const ids = await getAccessibleYearIds(session);
    if (ids.length === 0) return NextResponse.json([]);
    q.yearId = { $in: ids };
  }

  return NextResponse.json(await Student.find(q).populate('yearId').populate('programId').sort({ studentId: 1 }).lean());
}

export async function POST(req: Request) {
  let session;
  try { session = await requireRole(['admin', 'teacher']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const rawB = await req.json();
  const b = pick(rawB, ['studentId', 'fullName', 'yearId', 'programId', 'level', 'email']);
  // trim whitespace จาก studentId และ fullName ป้องกัน invisible space จาก copy-paste
  if (b.studentId) b.studentId = String(b.studentId).trim();
  if (b.fullName)  b.fullName  = String(b.fullName).trim();
  if (!b.studentId || !b.fullName || !b.yearId || !b.programId) return NextResponse.json({ error: 'missing' }, { status: 400 });

  const access = await checkYearIdAccess(b.yearId, session);
  if (!access.ok) return access.response;

  const exists = await Student.findOne({ studentId: b.studentId });
  if (exists) return NextResponse.json({ error: `รหัสนักศึกษา ${b.studentId} มีอยู่ในระบบแล้ว` }, { status: 400 });

  const program: any = await Program.findById(b.programId).lean();
  const faculty = program?.faculty || '';

  let email = b.email || '';
  if (!email) {
    const domain = await getSetting(SETTING_KEYS.STUDENT_EMAIL_DOMAIN, 'mail.rmutk.ac.th');
    email = `${b.studentId}@${domain}`;
  }

  const stu = await Student.create({
    ...b,
    faculty,
    email,
  });
  await ensureStudentUser(b.studentId, b.fullName);

  // resolve year label for human-readable log
  const yearDoc: any = await AcademicYear.findById(b.yearId).lean();
  await logAudit({
    session, request: req,
    action: 'student.create',
    entityType: 'Student',
    entityId: String(stu._id),
    entityLabel: `${b.studentId} ${b.fullName}`,
    after: {
      studentId: b.studentId,
      fullName: b.fullName,
      programId: String(b.programId),
      programName: program?.nameTh || '',
      yearId: String(b.yearId),
      year: yearDoc?.year || null,
      level: b.level || yearDoc?.level || '',
      faculty,
      email,
    },
  });

  return NextResponse.json(stu);
}
