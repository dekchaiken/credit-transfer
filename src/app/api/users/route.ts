import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db';
import { User } from '@/models/User';
import { Student } from '@/models/Student';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET() {
  try { await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).lean();

  // Batch query: collect all studentIds, single query, then map
  const studentIds = users
    .filter((u: any) => u.role === 'student' && u.studentId)
    .map((u: any) => u.studentId);

  const studentMap = new Map<string, any>();
  if (studentIds.length > 0) {
    const students = await Student.find({ studentId: { $in: studentIds } })
      .populate('programId')
      .populate('yearId')
      .lean();
    for (const s of students) {
      studentMap.set((s as any).studentId, s);
    }
  }

  const enriched = users.map((u: any) => {
    if (u.role === 'student' && u.studentId) {
      const student = studentMap.get(u.studentId);
      if (student) {
        return {
          ...u,
          studentData: {
            faculty: (student as any).faculty,
            email: (student as any).email,
            programId: (student as any).programId,
            yearId: (student as any).yearId,
          },
        };
      }
    }
    return u;
  });

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  try { await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const body = await req.json();
  if (!body.username || !body.role) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  const exists = await User.findOne({ username: body.username });
  if (exists) return NextResponse.json({ error: 'username exists' }, { status: 400 });

  // teacher/committee → ไม่ต้องส่ง password มา ใช้ default 1234 + บังคับเปลี่ยนรอบแรก
  // role อื่น (admin/student) → ต้องส่ง password มา
  let rawPassword = body.password as string | undefined;
  let mustChangePassword = false;
  if (['teacher', 'committee'].includes(body.role)) {
    if (!rawPassword) rawPassword = '1234';
    mustChangePassword = true;
  } else if (!rawPassword) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  // assignedYears เก็บเฉพาะ role teacher/committee เท่านั้น
  let assignedYears: number[] = [];
  if (['teacher', 'committee'].includes(body.role) && Array.isArray(body.assignedYears)) {
    assignedYears = body.assignedYears
      .map((y: any) => Number(y))
      .filter((y: number) => Number.isFinite(y) && y > 0);
  }
  // teacher/committee ต้องมีปีอย่างน้อย 1 ปี
  if (['teacher', 'committee'].includes(body.role) && assignedYears.length === 0) {
    return NextResponse.json(
      { error: 'teacher/committee ต้องระบุปีการศึกษาที่รับผิดชอบอย่างน้อย 1 ปี' },
      { status: 400 },
    );
  }

  const u = await User.create({
    username: body.username, passwordHash, fullName: body.fullName || '',
    role: body.role, studentId: body.studentId || null,
    assignedYears, mustChangePassword,
  });

  // === audit ===
  await logAudit({
    action: 'user.create',
    entityType: 'User',
    entityId: String(u._id),
    entityLabel: `${body.username} (${body.fullName || '-'})`,
    after: {
      username: body.username,
      fullName: body.fullName || '',
      role: body.role,
      studentId: body.studentId || null,
      assignedYears,
      mustChangePassword,
    },
    request: req,
  });

  return NextResponse.json({ _id: u._id });
}
