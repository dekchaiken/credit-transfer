import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { User } from '@/models/User';
import { requireRole, getSession } from '@/lib/auth';
import { logAudit, diffArray } from '@/lib/audit';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const selfId = (session.user as any)?.userId;
  if (selfId && String(selfId) === String(id)) {
    return NextResponse.json({ error: 'cannot delete yourself' }, { status: 400 });
  }
  const before: any = await User.findById(id).select('-passwordHash').lean();
  if (!before) return NextResponse.json({ ok: true });

  await User.findByIdAndDelete(id);

  await logAudit({
    session,
    request: req,
    action: 'user.delete',
    entityType: 'User',
    entityId: String(id),
    entityLabel: `${before.username} (${before.fullName || '-'})`,
    before,
  });

  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try { session = await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();
  const { id } = await params;
  const body = await req.json();
  const selfId = (session.user as any)?.userId;
  const isSelf = selfId && String(selfId) === String(id);

  // snapshot ก่อนแก้ — ใช้ diff ในตอนท้าย
  const before: any = await User.findById(id).select('-passwordHash').lean();
  if (!before) return NextResponse.json({ error: 'not found' }, { status: 404 });

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

  // assignedYears: เก็บเฉพาะ teacher/committee — role อื่นเคลียร์ทิ้ง
  if (Array.isArray(body.assignedYears)) {
    const targetRole = update.role || before.role;
    if (['teacher', 'committee'].includes(targetRole)) {
      const ay = body.assignedYears
        .map((y: any) => Number(y))
        .filter((y: number) => Number.isFinite(y) && y > 0);
      if (ay.length === 0) {
        return NextResponse.json(
          { error: 'teacher/committee ต้องระบุปีการศึกษาที่รับผิดชอบอย่างน้อย 1 ปี' },
          { status: 400 },
        );
      }
      update.assignedYears = ay;
    } else {
      update.assignedYears = [];
    }
  } else if (update.role && !['teacher', 'committee'].includes(update.role)) {
    update.assignedYears = [];
  } else if (update.role && ['teacher', 'committee'].includes(update.role)) {
    if (!Array.isArray(before.assignedYears) || before.assignedYears.length === 0) {
      return NextResponse.json(
        { error: 'teacher/committee ต้องระบุปีการศึกษาที่รับผิดชอบอย่างน้อย 1 ปี' },
        { status: 400 },
      );
    }
  }

  const u = await User.findByIdAndUpdate(id, update, { new: true }).select('-passwordHash').lean() as any;
  if (!u) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // === audit: log update + แตก event ของการเปลี่ยน role / assign-unassign ปี ===
  const label = `${u.username} (${u.fullName || '-'})`;

  await logAudit({
    session, request: req,
    action: 'user.update',
    entityType: 'User',
    entityId: String(id),
    entityLabel: label,
    before, after: u,
  });

  // role change → log แยก
  if (update.role && update.role !== before.role) {
    await logAudit({
      session, request: req,
      action: 'user.change_role',
      entityType: 'User',
      entityId: String(id),
      entityLabel: label,
      metadata: { from: before.role, to: update.role },
    });
  }

  // year assign/unassign → log แยก ทำให้ filter ดูง่าย
  if (update.assignedYears) {
    const { added, removed } = diffArray<number>(before.assignedYears || [], update.assignedYears);
    if (added.length > 0) {
      await logAudit({
        session, request: req,
        action: 'user.assign_year',
        entityType: 'User',
        entityId: String(id),
        entityLabel: label,
        metadata: { years: added, role: u.role },
      });
    }
    if (removed.length > 0) {
      await logAudit({
        session, request: req,
        action: 'user.unassign_year',
        entityType: 'User',
        entityId: String(id),
        entityLabel: label,
        metadata: { years: removed, role: u.role },
      });
    }
  }

  return NextResponse.json(u);
}
