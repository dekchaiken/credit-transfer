import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import { AcademicYear } from '@/models/AcademicYear';
import { CourseOffering } from '@/models/CourseOffering';
import { invalidateYears } from '@/lib/yearsCache';

export async function DELETE(req: NextRequest) {
  try {
    await requireRole(['admin', 'committee']);
  } catch (e: any) {
    return e;
  }

  await dbConnect();

  try {
    const { searchParams } = new URL(req.url);
    const yearId = searchParams.get('yearId');

    if (!yearId) {
      return NextResponse.json(
        { error: 'yearId จำเป็นต้องระบุ' },
        { status: 400 }
      );
    }

    // 1. หา AcademicYear
    const academicYear = await AcademicYear.findById(yearId).populate('programId').lean();

    if (!academicYear) {
      return NextResponse.json(
        { error: 'ไม่พบสาขานี้' },
        { status: 404 }
      );
    }

    // 2. ลบ CourseOffering ทั้งหมดของสาขานี้
    const deletedOfferings = await CourseOffering.deleteMany({
      yearId: yearId
    });

    // 3. ลบ AcademicYear
    await AcademicYear.findByIdAndDelete(yearId);

    // 4. Invalidate cache
    invalidateYears();

    return NextResponse.json({
      message: 'ลบสาขาสำเร็จ',
      deletedProgram: (academicYear as any).programId?.nameTh || 'N/A',
      deletedCourses: deletedOfferings.deletedCount,
    });
  } catch (error: any) {
    console.error('Error deleting program:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบสาขา', details: error.message },
      { status: 500 }
    );
  }
}
