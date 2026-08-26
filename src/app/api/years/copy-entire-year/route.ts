import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { dbConnect } from '@/lib/db';
import { AcademicYear } from '@/models/AcademicYear';
import { CourseOffering } from '@/models/CourseOffering';
import { invalidateYears } from '@/lib/yearsCache';
import { Types } from 'mongoose';

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

    // Validate all programIds are valid ObjectIds
    const invalidIds = programIds.filter(id => !Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `programIds ไม่ถูกต้อง: ${invalidIds.join(', ')}` },
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

    console.log('Copy entire year - programIds:', programIds);
    console.log('Copy entire year - sourceYears found:', sourceYears.length);

    if (sourceYears.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลในปีต้นทาง', copiedPrograms: 0, copiedCourses: 0 },
        { status: 404 }
      );
    }

    // 2. เช็คว่าสาขาไหนมีในปีปลายทางแล้วบ้าง
    const existingYears = await AcademicYear.find({ year: toYear }).lean();
    const existingProgramIds = new Set(
      existingYears.map((y: any) => (y.programId?._id || y.programId).toString())
    );

    // 3. กรองเฉพาะสาขาที่ยังไม่มีในปีปลายทาง
    const newSourceYears = sourceYears.filter((y: any) => {
      const progId = (y.programId?._id || y.programId).toString();
      return !existingProgramIds.has(progId);
    });

    console.log('Copy entire year - existingProgramIds:', Array.from(existingProgramIds));
    console.log('Copy entire year - newSourceYears after filter:', newSourceYears.length);

    if (newSourceYears.length === 0) {
      return NextResponse.json(
        {
          message: 'สาขาที่เลือกมีในปีปลายทางแล้วทั้งหมด',
          copiedPrograms: 0,
          copiedCourses: 0,
          skippedPrograms: sourceYears.length,
        },
        { status: 200 }
      );
    }

    // 4. คัดลอก AcademicYear (สาขา) ที่ยังไม่มี
    const newYearDocs = newSourceYears.map((y: any) => {
      // Extract programId properly from populated or non-populated object
      let programId = y.programId;
      if (programId && typeof programId === 'object' && programId._id) {
        programId = programId._id;
      }

      return {
        year: toYear,
        programId: programId,
        level: y.level,
      };
    });

    const createdYears = await AcademicYear.insertMany(newYearDocs);

    // 5. สร้าง mapping: sourceYearId -> newYearId
    const yearIdMap = new Map<string, string>();
    newSourceYears.forEach((sourceYear: any, index) => {
      yearIdMap.set(sourceYear._id.toString(), createdYears[index]._id.toString());
    });

    // 6. คัดลอก CourseOffering
    let copiedCoursesCount = 0;
    for (const sourceYear of newSourceYears) {
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
      skippedPrograms: sourceYears.length - newSourceYears.length,
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
