import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Student } from '@/models/Student';
import { AcademicYear } from '@/models/AcademicYear';
import { requireRole } from '@/lib/auth';
import { checkYearIdAccess } from '@/lib/yearAccess';
import { ensureStudentUser } from '@/lib/studentUser';
import { getSetting, SETTING_KEYS } from '@/models/Settings';
import { logAudit } from '@/lib/audit';
import { parseStudentFile } from '@/lib/parseStudentFile';

/**
 * POST /api/students/import?yearId=xxx
 *
 * รับไฟล์รายชื่อนักศึกษา (binary) รองรับ 2 รูปแบบ:
 *  - CSV (studentId, fullName, [programCode])
 *  - .xls ของระบบทะเบียน RMUTK (HTML table, windows-874)
 *
 * สาขา (program) เอามาจากปีการศึกษาที่เลือก (yearId) ไม่ต้องมีคอลัมน์ programCode
 * ในไฟล์ — ถ้าไฟล์มี programCode มาจะถูกเพิกเฉย
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

  // สาขาเอาจากปีการศึกษาที่เลือก
  const program: any = (yearDoc as any).programId;
  if (!program?._id) {
    return NextResponse.json({ error: 'ปีการศึกษานี้ยังไม่ได้ผูกกับสาขา — ตรวจสอบข้อมูลปีการศึกษา' }, { status: 400 });
  }

  const emailDomain = await getSetting(SETTING_KEYS.STUDENT_EMAIL_DOMAIN, 'mail.rmutk.ac.th');

  // อ่านไฟล์เป็น binary เพื่อ decode encoding ได้ถูกต้อง (windows-874 / utf-8)
  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength === 0) {
    return NextResponse.json({ error: 'ไฟล์ว่าง — ไม่พบข้อมูล' }, { status: 400 });
  }

  const { rows, garbledNames, format } = parseStudentFile(buf);

  if (rows.length === 0) {
    return NextResponse.json({ error: 'อ่านไฟล์ไม่พบรายชื่อนักศึกษา — ตรวจสอบว่าไฟล์มีคอลัมน์รหัสประจำตัวและชื่อ-สกุล' }, { status: 400 });
  }

  if (rows.length > 500) {
    return NextResponse.json({ error: `ไฟล์มีข้อมูลมากเกินไป (${rows.length} แถว) — สูงสุด 500 แถวต่อครั้ง` }, { status: 400 });
  }

  let added = 0, skipped = 0, usersCreated = 0;
  const errors: string[] = [];

  for (const r of rows) {
    const studentId = r.studentId.trim();
    const fullName = r.fullName.trim();
    if (!studentId) { skipped++; errors.push(`ไม่มีรหัสประจำตัว: ${JSON.stringify(r)}`); continue; }
    if (!fullName) { skipped++; errors.push(`ไม่มีชื่อ-สกุล (รหัส ${studentId})`); continue; }

    const exists = await Student.findOne({ studentId });
    if (!exists) {
      await Student.create({
        studentId, fullName,
        programId: program._id,
        yearId: yearDoc._id,
        level: defaultLevel,
        faculty: program.faculty || '',
        email: `${studentId}@${emailDomain}`,
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
    entityLabel: `นำเข้าปี ${(yearDoc as any).year} (${program?.nameTh || '-'})`,
    metadata: {
      yearId: String(yearDoc._id),
      year: (yearDoc as any).year,
      format,
      totalRows: rows.length,
      added, skipped, usersCreated,
      garbledNames,
      errorCount: errors.length,
    },
  });

  return NextResponse.json({ added, skipped, usersCreated, garbledNames, format, errors: errors.slice(0, 20) });
}
