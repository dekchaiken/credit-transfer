import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { dbConnect } from '@/lib/db';
import { Student } from '@/models/Student';
import { AcademicYear } from '@/models/AcademicYear';
import { Program } from '@/models/Program';
import { requireRole } from '@/lib/auth';
import { checkYearIdAccess } from '@/lib/yearAccess';
import { ensureStudentUser } from '@/lib/studentUser';
import { getSetting, SETTING_KEYS } from '@/models/Settings';
import { logAudit } from '@/lib/audit';

/**
 * POST /api/students/import?yearId=xxx
 *
 * รับ CSV ที่มีคอลัมน์: studentId, fullName, programCode, email (optional)
 */
export async function POST(req: Request) {
  let session;
  try { session = await requireRole(['admin', 'teacher']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();

  const url = new URL(req.url);
  const yearId = url.searchParams.get('yearId');
  if (!yearId) return NextResponse.json({ error: 'ต้องระบุ yearId — เลือกปีการศึกษาก่อนนำเข้า' }, { status: 400 });

  const access = await checkYearIdAccess(yearId, session);
  if (!access.ok) return access.response;

  const yearDoc = await AcademicYear.findById(yearId).populate('programId');
  if (!yearDoc) return NextResponse.json({ error: 'ไม่พบปีการศึกษาที่เลือก' }, { status: 404 });
  const defaultLevel = (yearDoc as any).level || 'เทียบโอน';

  const emailDomain = await getSetting(SETTING_KEYS.STUDENT_EMAIL_DOMAIN, 'mail.rmutk.ac.th');

  const text = await req.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const rows = parsed.data as any[];

  if (rows.length > 500) {
    return NextResponse.json({ error: `CSV มีข้อมูลมากเกินไป (${rows.length} แถว) — สูงสุด 500 แถวต่อครั้ง` }, { status: 400 });
  }

  let added = 0, skipped = 0, usersCreated = 0;
  const errors: string[] = [];

  for (const r of rows) {
    const studentId = String(r.studentId || '').trim();
    const fullName = String(r.fullName || '').trim();
    const programCode = String(r.programCode || '').trim();
    const email = String(r.email || '').trim();
    if (!studentId || !fullName || !programCode) {
      skipped++; errors.push(`ข้อมูลไม่ครบ: ${JSON.stringify(r)}`); continue;
    }
    const program: any = await Program.findOne({ code: programCode }).lean();
    if (!program) { skipped++; errors.push(`ไม่พบสาขา: ${programCode}`); continue; }

    const exists = await Student.findOne({ studentId });
    if (!exists) {
      await Student.create({
        studentId, fullName,
        programId: program._id,
        yearId: yearDoc._id,
        level: defaultLevel,
        faculty: program.faculty || '',
        email: email || `${studentId}@${emailDomain}`,
      });
      added++;
    } else { skipped++; }

    const u = await ensureStudentUser(studentId, fullName);
    if (u.created) usersCreated++;
  }

  await logAudit({
    session, request: req,
    action: 'student.import',
    entityType: 'Student',
    entityLabel: `นำเข้าปี ${(yearDoc as any).year} (${(yearDoc as any).programId?.nameTh || '-'})`,
    metadata: {
      yearId: String(yearDoc._id),
      year: (yearDoc as any).year,
      totalRows: rows.length,
      added, skipped, usersCreated,
      errorCount: errors.length,
    },
  });

  return NextResponse.json({ added, skipped, usersCreated, errors: errors.slice(0, 20) });
}
