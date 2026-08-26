import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import dbConnect from '@/lib/db';
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
    const { fromYearId, toYearId, programId } = body;

    if (!fromYearId || !toYearId) {
      return NextResponse.json(
        { error: 'fromYearId และ toYearId จำเป็นต้องระบุ' },
        { status: 400 }
      );
    }

    if (fromYearId === toYearId) {
      return NextResponse.json(
        { error: 'ไม่สามารถคัดลอกภายในปีเดียวกันได้' },
        { status: 400 }
      );
    }

    // หา CourseOffering ทั้งหมดของปีต้นทาง
    const query: any = { yearId: fromYearId };
    if (programId) {
      // Note: CourseOffering ไม่มี programId, ต้อง filter ผ่าน AcademicYear
      // แต่เพื่อความเรียบง่าย เราจะคัดลอกทั้งหมดของปีนั้น
    }

    const sourceOfferings = await CourseOffering.find(query).lean();

    if (sourceOfferings.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบรายวิชาในปีต้นทาง', copiedCount: 0 },
        { status: 404 }
      );
    }

    // เช็คว่ามีรายวิชาในปีปลายทางอยู่แล้วหรือไม่
    const existingOfferings = await CourseOffering.find({
      yearId: toYearId,
    }).lean();

    const existingCourseIds = new Set(
      existingOfferings.map((o) => o.uniCourseId.toString())
    );

    // คัดลอกเฉพาะรายวิชาที่ยังไม่มีในปีปลายทาง
    const offeringsToCreate = sourceOfferings
      .filter((o) => !existingCourseIds.has(o.uniCourseId.toString()))
      .map((offering) => ({
        uniCourseId: offering.uniCourseId,
        yearId: toYearId,
        order: offering.order,
      }));

    if (offeringsToCreate.length === 0) {
      return NextResponse.json({
        message: 'รายวิชาทั้งหมดมีอยู่ในปีปลายทางแล้ว',
        copiedCount: 0,
        skippedCount: sourceOfferings.length,
      });
    }

    // สร้าง CourseOffering ใหม่
    await CourseOffering.insertMany(offeringsToCreate);

    // Invalidate cache
    invalidateYears();

    return NextResponse.json({
      message: 'คัดลอกรายวิชาสำเร็จ',
      copiedCount: offeringsToCreate.length,
      skippedCount: sourceOfferings.length - offeringsToCreate.length,
      totalInSource: sourceOfferings.length,
    });
  } catch (error: any) {
    console.error('Error copying courses:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการคัดลอกรายวิชา', details: error.message },
      { status: 500 }
    );
  }
}
