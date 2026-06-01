import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Student } from '@/models/Student';
import { Program } from '@/models/Program';
import { AcademicYear } from '@/models/AcademicYear';
import { requireRole } from '@/lib/auth';
import { ensureStudentUser } from '@/lib/studentUser';
import { getSetting, SETTING_KEYS } from '@/models/Settings';

export async function GET(req: Request) {
  await dbConnect();
  const url = new URL(req.url);
  const yearId = url.searchParams.get('yearId');
  const q: any = {};
  if (yearId) q.yearId = yearId;
  return NextResponse.json(await Student.find(q).populate('yearId').populate('programId').sort({ studentId: 1 }).lean());
}

export async function POST(req: Request) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const b = await req.json();
  if (!b.studentId || !b.fullName || !b.yearId || !b.programId) return NextResponse.json({ error: 'missing' }, { status: 400 });
  const exists = await Student.findOne({ studentId: b.studentId });
  if (exists) return NextResponse.json({ error: 'studentId exists' }, { status: 400 });

  // Auto-fill faculty from Program
  const program: any = await Program.findById(b.programId).lean();
  const faculty = program?.faculty || '';

  // Auto-generate email if not provided
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
  return NextResponse.json(stu);
}
