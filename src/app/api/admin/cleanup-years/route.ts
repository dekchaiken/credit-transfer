import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { AcademicYear } from '@/models/AcademicYear';
import { Student } from '@/models/Student';
import { TransferSheet } from '@/models/TransferSheet';
import { User } from '@/models/User';
import { CourseOffering } from '@/models/CourseOffering';
import { Year } from '@/models/Year';
import { requireRole } from '@/lib/auth';

/**
 * ONE-TIME cleanup: ลบทุกอย่างที่ไม่ใช่ปี 2569
 * อัปเดต assignedYears=[2569] ให้ทุก teacher/committee
 * DELETE /api/admin/cleanup-years
 */
export async function DELETE(req: Request) {
  try { await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();

  const KEEP_YEAR = 2569;

  const yearsToDelete: any[] = await AcademicYear.find({ year: { $ne: KEEP_YEAR } }).select('_id year').lean();
  const yearIds = yearsToDelete.map(y => y._id);

  let students = 0, sheets = 0, users = 0, offerings = 0, standaloneYears = 0, teachersUpdated = 0;

  if (yearIds.length > 0) {
    const studs: any[] = await Student.find({ yearId: { $in: yearIds } }).select('_id studentId').lean();
    for (const s of studs) {
      sheets += (await TransferSheet.deleteMany({ studentId: s._id })).deletedCount;
      if (s.studentId) await User.deleteOne({ role: 'student', studentId: s.studentId });
      users++;
    }
    students = (await Student.deleteMany({ yearId: { $in: yearIds } })).deletedCount;
    offerings = (await CourseOffering.deleteMany({ yearId: { $in: yearIds } })).deletedCount;
    await AcademicYear.deleteMany({ year: { $ne: KEEP_YEAR } });
  }

  // ลบ standalone Year docs ที่ไม่ใช่ปี 2569
  standaloneYears = (await Year.deleteMany({ year: { $ne: KEEP_YEAR } })).deletedCount;

  // อัปเดต assignedYears ของทุก teacher/committee → [2569]
  const r = await User.updateMany(
    { role: { $in: ['teacher', 'committee'] } },
    { $set: { assignedYears: [KEEP_YEAR] } },
  );
  teachersUpdated = r.modifiedCount;

  return NextResponse.json({
    deletedYears: yearsToDelete.map(y => y.year),
    deletedStandaloneYears: standaloneYears,
    deletedStudents: students,
    deletedSheets: sheets,
    deletedUsers: users,
    deletedOfferings: offerings,
    teachersUpdated,
  });
}
