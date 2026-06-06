import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { dbConnect } from '@/lib/db';
import { getSetting, setSetting, SETTING_KEYS } from '@/models/Settings';
import { requireRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET() {
  await dbConnect();
  const studentEmailDomain = await getSetting(SETTING_KEYS.STUDENT_EMAIL_DOMAIN, 'mail.rmutk.ac.th');
  return NextResponse.json({ studentEmailDomain });
}

export async function PUT(req: Request) {
  let session;
  try { session = await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const body = await req.json();

  const before: Record<string, any> = {};
  const after: Record<string, any> = {};

  if (body.studentEmailDomain !== undefined) {
    before.studentEmailDomain = await getSetting(SETTING_KEYS.STUDENT_EMAIL_DOMAIN, 'mail.rmutk.ac.th');
    await setSetting(SETTING_KEYS.STUDENT_EMAIL_DOMAIN, body.studentEmailDomain);
    after.studentEmailDomain = body.studentEmailDomain;
  }

  if (Object.keys(after).length > 0) {
    await logAudit({
      session, request: req,
      action: 'settings.update',
      entityType: 'Settings',
      entityLabel: 'ตั้งค่าระบบ',
      before, after,
    });
  }

  return NextResponse.json({ ok: true });
}
