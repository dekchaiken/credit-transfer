import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db';
import { User } from '@/models/User';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { validatePassword } from '@/lib/helpers';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const password = (body?.password || '').toString();
  const validation = validatePassword(password);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const u = await User.findByIdAndUpdate(
    id,
    { passwordHash, mustChangePassword: !!body?.mustChangePassword },
    { new: true },
  ).select('-passwordHash').lean() as any;
  if (!u) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await logAudit({
    session, request: req,
    action: 'user.reset_password',
    entityType: 'User',
    entityId: String(id),
    entityLabel: `${u.username} (${u.fullName || '-'})`,
    metadata: { mustChangePassword: !!body?.mustChangePassword },
  });

  return NextResponse.json({ ok: true });
}
