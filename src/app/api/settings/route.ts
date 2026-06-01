import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Settings, getSetting, setSetting, SETTING_KEYS } from '@/models/Settings';
import { requireRole } from '@/lib/auth';

export async function GET() {
  await dbConnect();
  const studentEmailDomain = await getSetting(SETTING_KEYS.STUDENT_EMAIL_DOMAIN, 'mail.rmutk.ac.th');
  return NextResponse.json({ studentEmailDomain });
}

export async function PUT(req: Request) {
  try { await requireRole(['admin']); } catch (e: any) { return e; }
  await dbConnect();
  const body = await req.json();

  if (body.studentEmailDomain !== undefined) {
    await setSetting(SETTING_KEYS.STUDENT_EMAIL_DOMAIN, body.studentEmailDomain);
  }

  return NextResponse.json({ ok: true });
}
