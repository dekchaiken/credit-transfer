import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { TransferSheet } from '@/models/TransferSheet';
import { AcademicYear } from '@/models/AcademicYear';
import { requireRole } from '@/lib/auth';
import { findCoursesByYearId } from '@/lib/courseQueries';

// GET /api/report?year=2569
export async function GET(req: Request) {
  try { await requireRole(['admin', 'teacher', 'committee']); } catch (e: any) { return e; }
  await dbConnect();

  const year = Number(new URL(req.url).searchParams.get('year'));
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 });

  const academicYears = await AcademicYear.find({ year }).lean();
  if (!academicYears.length) return NextResponse.json({ byCourse: [], byStudent: [] });

  const yearIds = academicYears.map((y: any) => y._id);

  // All finalized sheets for this year
  const sheets = await TransferSheet.find({ yearId: { $in: yearIds }, status: 'finalized' })
    .populate({ path: 'studentId', populate: ['yearId', 'programId'] })
    .lean() as any[];

  // Courses for all yearIds (union, deduped by _id)
  const courseMap = new Map<string, any>();
  for (const yid of yearIds) {
    const courses = await findCoursesByYearId(String(yid));
    for (const c of courses as any[]) courseMap.set(String(c._id), c);
  }
  const courses = [...courseMap.values()];

  // --- byCourse ---
  const courseStats = new Map<string, { code: string; nameTh: string; passed: number; failed: number; students: { studentId: string; fullName: string; grade: string; passed: boolean }[] }>();
  for (const c of courses) {
    courseStats.set(String(c._id), { code: c.code, nameTh: c.nameTh, passed: 0, failed: 0, students: [] });
  }

  for (const sheet of sheets) {
    const stu = sheet.studentId as any;
    for (const sel of sheet.selections || []) {
      const key = String(sel.uniCourseId);
      const stat = courseStats.get(key);
      if (!stat) continue;
      const passed = sel.groupNo != null && sel.selected && (sel.grade || '').trim() !== '';
      if (passed) stat.passed++; else stat.failed++;
      stat.students.push({ studentId: stu?.studentId, fullName: stu?.fullName, grade: sel.grade || '', passed });
    }
  }

  // --- byStudent ---
  const byStudent = sheets.map(sheet => {
    const sels = sheet.selections || [];
    const passed = sels.filter((s: any) => s.groupNo != null && s.selected && (s.grade || '').trim() !== '').length;
    const failed = sels.filter((s: any) => s.groupNo != null && !(s.selected && (s.grade || '').trim() !== '')).length;
    const stu = sheet.studentId as any;
    return {
      _id: String(sheet._id),
      studentId: stu?.studentId,
      fullName: stu?.fullName,
      program: stu?.programId?.nameTh,
      faculty: stu?.programId?.faculty,
      passed,
      failed,
      total: sels.filter((s: any) => s.groupNo != null).length,
    };
  });

  return NextResponse.json({
    byCourse: [...courseStats.values()].sort((a, b) => a.code.localeCompare(b.code)),
    byStudent: byStudent.sort((a, b) => (a.studentId || '').localeCompare(b.studentId || '')),
  });
}
