import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Program } from '@/models/Program';
import { requireRole } from '@/lib/auth';

export async function GET() {
  await dbConnect();
  return NextResponse.json(await Program.find().sort({ createdAt: -1 }).lean());
}

export async function POST(req: Request) {
  try { await requireRole(['admin', 'teacher']); } catch (e: any) { return e; }
  await dbConnect();
  const b = await req.json();
  if (!b.nameTh) return NextResponse.json({ error: 'missing' }, { status: 400 });
  const p = await Program.create(b);
  return NextResponse.json(p);
}
