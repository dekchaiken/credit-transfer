import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Faculty } from '@/models/Faculty';
import { requireRole } from '@/lib/auth';

export async function GET() {
  await dbConnect();
  return NextResponse.json(await Faculty.find().sort({ nameTh: 1 }).lean());
}

export async function POST(req: Request) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const b = await req.json();
  if (!b.nameTh) return NextResponse.json({ error: 'missing nameTh' }, { status: 400 });
  const exists = await Faculty.findOne({ nameTh: b.nameTh });
  if (exists) return NextResponse.json({ error: 'duplicate' }, { status: 400 });
  return NextResponse.json(await Faculty.create(b));
}
