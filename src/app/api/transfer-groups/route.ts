import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { TransferGroup } from '@/models/TransferGroup';
import { requireRole } from '@/lib/auth';

export async function GET(req: Request) {
  await dbConnect();
  const uniId = new URL(req.url).searchParams.get('uniCourseId');
  const q = uniId ? { uniCourseId: uniId } : {};
  return NextResponse.json(await TransferGroup.find(q).sort({ groupNo: 1 }).lean());
}

export async function POST(req: Request) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const b = await req.json();
  if (!b.uniCourseId || !b.groupNo) return NextResponse.json({ error: 'missing' }, { status: 400 });

  // Validate: รหัสวิชาย่อยต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)
  if (b.externalCourses && Array.isArray(b.externalCourses)) {
    const invalidCodes = b.externalCourses.filter((ex: any) => ex.code && !/^[\d\s-]+$/.test(ex.code));
    if (invalidCodes.length > 0) {
      return NextResponse.json({ error: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }, { status: 400 });
    }
  }

  const doc = await TransferGroup.create(b);
  return NextResponse.json(doc);
}
