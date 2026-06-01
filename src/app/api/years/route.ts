import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { AcademicYear } from '@/models/AcademicYear';
import { requireRole } from '@/lib/auth';

export async function GET() {
  await dbConnect();
  const list = await AcademicYear.find().populate('programId').sort({ year: -1 }).lean();
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  try { await requireRole(['admin', 'teacher', 'committee']); } catch (e: any) { return e; }
  await dbConnect();
  const b = await req.json();
  if (!b.year || !b.programId) return NextResponse.json({ error: 'missing' }, { status: 400 });
  const doc = await AcademicYear.create(b);
  return NextResponse.json(doc);
}
