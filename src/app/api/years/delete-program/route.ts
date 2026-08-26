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

    // Return plain object only - no nested Mongoose objects
    const response = {
      message: 'ลบสาขาสำเร็จ',
      deletedProgram: String((academicYear as any).programId?.nameTh || 'สาขา'),
      deletedCourses: Number(deletedOfferings.deletedCount || 0),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error deleting program:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบสาขา', details: error.message },
      { status: 500 }
    );
  }
}
