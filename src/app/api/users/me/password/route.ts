import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db';
import { User } from '@/models/User';
import { getSession } from '@/lib/auth';
import { validatePassword } from '@/lib/helpers';

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await dbConnect();
  const userId = (session.user as any).userId;
  const { currentPassword, newPassword } = await req.json();
  const validation = validatePassword(newPassword || '');
  if (!validation.valid) return NextResponse.json({ error: validation.error }, { status: 400 });
  const user = await User.findById(userId);
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 });
  const ok = await bcrypt.compare(currentPassword || '', user.passwordHash);
  if (!ok) return NextResponse.json({ error: 'รหัสปัจจุบันไม่ถูกต้อง' }, { status: 400 });
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.mustChangePassword = false;
  await user.save();
  return NextResponse.json({ ok: true });
}
