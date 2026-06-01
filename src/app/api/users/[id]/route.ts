import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { User } from '@/models/User';
import { requireRole, getSession } from '@/lib/auth';

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  const session = await getSession();
  const selfId = (session?.user as any)?.userId;
  if (selfId && String(selfId) === String(id)) {
    return NextResponse.json({ error: 'cannot delete yourself' }, { status: 400 });
  }
  await User.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireRole(['admin']); } catch (e: any) { return e; }
  await dbConnect();
  const { id } = await params;
  const body = await req.json();
  const session = await getSession();
  const selfId = (session?.user as any)?.userId;
  const isSelf = selfId && String(selfId) === String(id);

  const update: Record<string, any> = {};
  if (typeof body.fullName === 'string') update.fullName = body.fullName;
  if (typeof body.studentId === 'string' || body.studentId === null) update.studentId = body.studentId || null;
  if (typeof body.role === 'string') {
    const allowed = ['admin', 'teacher', 'committee', 'student'];
    if (!allowed.includes(body.role)) {
      return NextResponse.json({ error: 'invalid role' }, { status: 400 });
    }
    if (isSelf && body.role !== 'admin') {
      return NextResponse.json({ error: 'cannot demote yourself' }, { status: 400 });
    }
    update.role = body.role;
  }

  const u = await User.findByIdAndUpdate(id, update, { new: true }).select('-passwordHash').lean();
  if (!u) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(u);
}
