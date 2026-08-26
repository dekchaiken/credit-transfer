import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import { AcademicYear } from '@/models/AcademicYear';
import { CourseOffering } from '@/models/CourseOffering';
import { invalidateYears } from '@/lib/yearsCache';

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin', 'committee']);
  } catch (e: any) {
    return e;
  }

  await dbConnect();

  try {
    const body = await req.json();
    const { fromYear, toYear, programIds } = body; // programIds = array of yearId to copy

    if (!fromYear || !toYear) {
      return NextResponse.json(
        { error: 'fromYear และ toYear จำเป็นต้องระบุ' },
        { status: 400 }
      );
    }

    if (fromYear === toYear) {
      return NextResponse.json(
        { error: 'ไม่สามารถคัดลอกภายในปีเดียวกันได้' },
        { status: 400 }
      );
    }

    if (!programIds || !Array.isArray(programIds) || programIds.length === 0) {
      return NextResponse.json(
        { error: 'กรุณาเลือกสาขาที่ต้องการคัดลอก' },
        { status: 400 }
      );
    }

    // 1. หา AcademicYear ที่เลือกจากปีต้นทาง
    const sourceYears = await AcademicYear.find({
      _id: { $in: programIds },
      year: fromYear,
    })
      .populate('programId')
      .lean();

    if (sourceYears.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลในปีต้นทาง', copiedPrograms: 0, copiedCourses: 0 },
        { status: 404 }
      );
    }

    // 2. เช็คว่าปีปลายทางมีข้อมูลอยู่แล้วหรือไม่
    const existingYears = await AcademicYear.find({ year: toYear }).lean();
    if (existingYears.length > 0) {
      return NextResponse.json(
        {
          error: `ปี ${toYear} มีข้อมูลอยู่แล้ว (${existingYears.length} สาขา)`,
          suggestion: 'ใช้ฟีเจอร์ดึงรายวิชาแทน หรือลบข้อมูลปีนี้ก่อน',
        },
        { status: 400 }
      );
    }

    // 3. คัดลอก AcademicYear (สาขา) ทั้งหมด
    const newYearDocs = sourceYears.map((y) => ({
      year: toYear,
      programId: y.programId,
      level: y.level,
    }));

    const createdYears = await AcademicYear.insertMany(newYearDocs);

    // 4. สร้าง mapping: sourceYearId -> newYearId
    const yearIdMap = new Map<string, string>();
    sourceYears.forEach((sourceYear: any, index) => {
      yearIdMap.set(sourceYear._id.toString(), createdYears[index]._id.toString());
    });

    // 5. คัดลอก CourseOffering
    let copiedCoursesCount = 0;
    for (const sourceYear of sourceYears) {
      const sourceOfferings = await CourseOffering.find({
        yearId: (sourceYear as any)._id,
      }).lean();

      if (sourceOfferings.length > 0) {
        const newOfferings = sourceOfferings.map((offering: any) => ({
          uniCourseId: offering.uniCourseId,
          yearId: yearIdMap.get((sourceYear as any)._id.toString()),
          order: offering.order,
        }));

        await CourseOffering.insertMany(newOfferings);
        copiedCoursesCount += newOfferings.length;
      }
    }

    // Invalidate cache
    invalidateYears();

    return NextResponse.json({
      message: `คัดลอกปี ${fromYear} เป็นปี ${toYear} สำเร็จ`,
      copiedPrograms: createdYears.length,
      copiedCourses: copiedCoursesCount,
      details: createdYears.map((y: any) => ({
        program: y.programId?.nameTh || 'N/A',
        level: y.level,
      })),
    });
  } catch (error: any) {
    console.error('Error copying entire year:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการคัดลอกข้อมูลทั้งปี', details: error.message },
      { status: 500 }
    );
  }
}
