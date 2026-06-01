import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db';
import { User } from '@/models/User';
import { Student } from '@/models/Student';
import { requireRole } from '@/lib/auth';

export async function GET() {
  try { await requireRole(['admin']); } catch (e: any) { return e; }
  await dbConnect();
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).lean();

  // Populate student data for users with role=student
  const enriched = await Promise.all(users.map(async (u: any) => {
    if (u.role === 'student' && u.studentId) {
      const student = await Student.findOne({ studentId: u.studentId })
        .populate('programId')
        .populate('yearId')
        .lean();
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
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  try { await requireRole(['admin']); } catch (e: any) { return e; }
  await dbConnect();
  const body = await req.json();
  if (!body.username || !body.password || !body.role) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  const exists = await User.findOne({ username: body.username });
  if (exists) return NextResponse.json({ error: 'username exists' }, { status: 400 });
  const passwordHash = await bcrypt.hash(body.password, 10);
  const u = await User.create({
    username: body.username, passwordHash, fullName: body.fullName || '',
    role: body.role, studentId: body.studentId || null,
  });
  return NextResponse.json({ _id: u._id });
}
