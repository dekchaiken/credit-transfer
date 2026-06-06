import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { User } from '@/models/User';
import { getSession } from '@/lib/auth';

/**
 * GET /api/users/committee?year=2569
 * คืนรายชื่อกรรมการ (role=committee) ที่ assignedYears ครอบคลุมปีที่ระบุ
 * ใช้สำหรับ auto-populate ฟอร์มกรรมการในใบเทียบโอน
 *
 * Auth: ทุก role ที่ login แล้วเรียกได้ (teacher/committee/admin/student)
 *       — student ก็เห็นได้เพื่อให้ PDF render ฝั่ง client หากต้องการ
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const yearStr = searchParams.get('year');
  const year = yearStr ? Number(yearStr) : NaN;
  if (!Number.isFinite(year) || year <= 0) {
    return NextResponse.json({ error: 'missing or invalid year' }, { status: 400 });
  }

  await dbConnect();
  const committees = await User.find({
    role: 'committee',
    assignedYears: year,
  })
    .select('_id fullName username assignedYears')
    .sort({ fullName: 1, username: 1 })
    .lean();

  return NextResponse.json(
    committees.map((u: any) => ({
      _id: String(u._id),
      fullName: u.fullName || u.username,
      username: u.username,
    })),
  );
}
