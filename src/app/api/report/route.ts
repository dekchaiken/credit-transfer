import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { TransferSheet } from '@/models/TransferSheet';
import { AcademicYear } from '@/models/AcademicYear';
import { requireRole, getSession } from '@/lib/auth';
import { getAssignedYears } from '@/lib/yearAccess';
import { TransferGroup } from '@/models/TransferGroup';
import { findCoursesByYearId } from '@/lib/courseQueries';

// GET /api/report?year=2569
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const role = (session.user as any)?.role;
  if (!role || role === 'student') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  try { await requireRole(['admin', 'teacher', 'committee']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();

  const year = Number(new URL(req.url).searchParams.get('year'));
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 });

  // Year-access check for non-admin roles
  if (role !== 'admin') {
    const assigned = await getAssignedYears(session);
    if (!assigned.includes(year)) {
      return NextResponse.json(
        { error: `ไม่มีสิทธิ์เข้าถึงปี ${year} — ปีที่คุณรับผิดชอบ: ${assigned.join(', ') || '(ไม่มี)'}` },
        { status: 403 },
      );
    }
  }

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
    const cs = await findCoursesByYearId(String(yid));
    for (const c of cs as any[]) courseMap.set(String(c._id), c);
  }
  const courses = [...courseMap.values()];
  const courseIds = courses.map((c: any) => c._id);

  // Fetch groups for requireAll logic
  const allGroups: any[] = await TransferGroup.find({ uniCourseId: { $in: courseIds } }).lean();
  const groupsByUni = new Map<string, any[]>();
  for (const g of allGroups) {
    const k = String(g.uniCourseId);
    if (!groupsByUni.has(k)) groupsByUni.set(k, []);
    groupsByUni.get(k)!.push(g);
  }

  function groupPasses(g: any, uniId: string, sels: any[]): boolean {
    const gSels = sels.filter((s: any) => String(s.uniCourseId) === uniId && s.groupNo === g.groupNo);
    const extSels = gSels.filter((s: any) => s.externalCourseCode);
    if (extSels.length === 0) return gSels.some((s: any) => s.selected);
    if (g.requireAll) return (g.externalCourses || []).every((ex: any) => extSels.find((s: any) => s.externalCourseCode === ex.code)?.selected === true);
    return extSels.some((s: any) => s.selected);
  }

  function coursePasses(uniId: string, sels: any[]): boolean {
    return (groupsByUni.get(uniId) || []).some(g => groupPasses(g, uniId, sels));
  }

  function bestGrade(uniId: string, sels: any[]): string {
    const passingSels = sels.filter((s: any) => String(s.uniCourseId) === uniId && s.selected && s.grade);
    return passingSels[0]?.grade || '';
  }

  // --- byCourse ---
  const courseStats = new Map<string, { code: string; nameTh: string; passed: number; failed: number; students: { studentId: string; fullName: string; grade: string; passed: boolean }[] }>();
  for (const c of courses) {
    courseStats.set(String(c._id), { code: c.code, nameTh: c.nameTh, passed: 0, failed: 0, students: [] });
  }

  for (const sheet of sheets) {
    const stu = sheet.studentId as any;
    const sels = sheet.selections || [];
    for (const c of courses) {
      const uniId = String(c._id);
      const hasSels = sels.some((s: any) => String(s.uniCourseId) === uniId && s.groupNo != null);
      if (!hasSels) continue;
      const stat = courseStats.get(uniId)!;
      const passed = coursePasses(uniId, sels);
      if (passed) stat.passed++; else stat.failed++;
      stat.students.push({ studentId: stu?.studentId, fullName: stu?.fullName, grade: bestGrade(uniId, sels), passed });
    }
  }

  // --- byStudent ---
  const byStudent = sheets.map(sheet => {
    const sels = sheet.selections || [];
    const stu = sheet.studentId as any;
    const passedSet = new Set<string>();
    const failedSet = new Set<string>();
    for (const c of courses) {
      const uniId = String(c._id);
      if (!sels.some((s: any) => String(s.uniCourseId) === uniId && s.groupNo != null)) continue;
      if (coursePasses(uniId, sels)) passedSet.add(uniId); else failedSet.add(uniId);
    }
    return {
      _id: String(sheet._id),
      studentId: stu?.studentId,
      fullName: stu?.fullName,
      program: stu?.programId?.nameTh,
      faculty: stu?.programId?.faculty,
      passed: passedSet.size,
      failed: failedSet.size,
      total: passedSet.size + failedSet.size,
    };
  });

  return NextResponse.json({
    byCourse: [...courseStats.values()].sort((a, b) => a.code.localeCompare(b.code)),
    byStudent: byStudent.sort((a, b) => (a.studentId || '').localeCompare(b.studentId || '')),
  });
}
