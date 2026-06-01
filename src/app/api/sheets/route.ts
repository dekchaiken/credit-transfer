import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { TransferSheet } from '@/models/TransferSheet';
import { Student } from '@/models/Student';
import { requireRole, getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json([], { status: 401 });
  await dbConnect();
  const role = (session.user as any).role;
  if (role === 'student') {
    const sid = (session.user as any).studentId;
    const stu = await Student.findOne({ studentId: sid });
    if (!stu) return NextResponse.json([]);
    return NextResponse.json(await TransferSheet.find({ studentId: stu._id }).populate({ path: 'studentId', populate: ['yearId','programId'] }).lean());
  }
  if (role === 'committee') {
    return NextResponse.json(await TransferSheet.find({ status: { $in: ['pending_review', 'finalized'] } }).populate({ path: 'studentId', populate: ['yearId','programId'] }).sort({ updatedAt: -1 }).lean());
  }
  return NextResponse.json(await TransferSheet.find().populate({ path: 'studentId', populate: ['yearId','programId'] }).sort({ updatedAt: -1 }).lean());
}

export async function POST(req: Request) {
  try { await requireRole(['admin', 'teacher', 'committee']); } catch (e: any) { return e; }
  await dbConnect();
  const { studentId } = await req.json();
  const stu = await Student.findById(studentId);
  if (!stu) return NextResponse.json({ error: 'student not found' }, { status: 404 });
  let sheet = await TransferSheet.findOne({ studentId: stu._id });
  if (!sheet) sheet = await TransferSheet.create({ studentId: stu._id, yearId: stu.yearId });
  return NextResponse.json(sheet);
}
