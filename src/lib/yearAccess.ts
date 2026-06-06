import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { getSession } from '@/lib/auth';
import { User } from '@/models/User';
import { AcademicYear } from '@/models/AcademicYear';

/**
 * Year-based access control helpers.
 *
 * RULES:
 * - admin: full access to every year
 * - student: not subject to year-scoping (handled per-route by studentId match)
 * - teacher / committee: limited to years listed in their User.assignedYears
 *   - empty assignedYears = no year access (must be explicitly assigned)
 *
 * NOTE: assignedYears stores YEAR NUMBERS (e.g. [2569, 2570]),
 * NOT yearId ObjectIds. To check yearId access, we fetch the AcademicYear
 * and compare its `year` field.
 */

export type AccessSession = Awaited<ReturnType<typeof getSession>>;

/** Read assignedYears for the current session user. Returns [] if not set. */
export async function getAssignedYears(session: AccessSession): Promise<number[]> {
  const userId = (session?.user as any)?.userId as string | undefined;
  if (!userId) return [];
  const u: any = await User.findById(userId).select('assignedYears').lean();
  const list = Array.isArray(u?.assignedYears) ? u.assignedYears : [];
  return list.map((n: any) => Number(n)).filter((n: number) => !isNaN(n));
}

/**
 * Build a Mongo `$match` filter expression for AcademicYear queries
 * based on the current user's role.
 *  - admin → `{}`  (no restriction)
 *  - teacher/committee → `{ year: { $in: [...assignedYears] } }`
 *  - others (e.g. unauthenticated) → `{ _id: null }` (matches nothing)
 *
 * Returned object should be spread/merged into your existing query.
 */
export async function getYearFilterForSession(session: AccessSession): Promise<Record<string, any>> {
  const role = (session?.user as any)?.role;
  if (role === 'admin') return {};
  if (role === 'teacher' || role === 'committee') {
    const assigned = await getAssignedYears(session);
    if (assigned.length === 0) return { _id: null }; // matches nothing
    return { year: { $in: assigned } };
  }
  // student / unknown — caller should not be using this; lock down by default
  return { _id: null };
}

/**
 * Resolve a yearId (ObjectId string) → its `year` number.
 * Returns null if not found or invalid.
 */
export async function resolveYearNumber(yearId: string | undefined | null): Promise<number | null> {
  if (!yearId) return null;
  if (!Types.ObjectId.isValid(yearId)) return null;
  const ay: any = await AcademicYear.findById(yearId).select('year').lean();
  return ay?.year ?? null;
}

/**
 * Return the set of AcademicYear._id (as strings) the session user is allowed
 * to access. For admin: every year in the system. For teacher/committee: years
 * whose `year` is in assignedYears. For others: empty array.
 *
 * Useful for building `{ yearId: { $in: [...] } }` filters on year-scoped
 * collections (Student, Sheet, etc.).
 */
export async function getAccessibleYearIds(session: AccessSession): Promise<string[]> {
  const role = (session?.user as any)?.role;
  if (!role) return [];
  if (role === 'admin') {
    const all: any[] = await AcademicYear.find({}).select('_id').lean();
    return all.map(a => String(a._id));
  }
  if (role === 'teacher' || role === 'committee') {
    const assigned = await getAssignedYears(session);
    if (assigned.length === 0) return [];
    const ays: any[] = await AcademicYear.find({ year: { $in: assigned } }).select('_id').lean();
    return ays.map(a => String(a._id));
  }
  return [];
}

/**
 * Check whether the session user is allowed to access data scoped to `yearId`.
 *  - admin: always true
 *  - teacher/committee: true iff resolved year is in assignedYears
 *  - others: false
 *
 * Returns:
 *  - { ok: true, year: number } on success
 *  - { ok: false, response: NextResponse } on failure (return this from your route)
 */
export async function checkYearIdAccess(
  yearId: string | undefined | null,
  session: AccessSession,
): Promise<{ ok: true; year: number } | { ok: false; response: NextResponse }> {
  const role = (session?.user as any)?.role;
  if (!session || !role) {
    return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  const yearNum = await resolveYearNumber(yearId);
  if (yearNum == null) {
    return { ok: false, response: NextResponse.json({ error: 'invalid yearId' }, { status: 400 }) };
  }

  if (role === 'admin') return { ok: true, year: yearNum };

  if (role === 'teacher' || role === 'committee') {
    const assigned = await getAssignedYears(session);
    if (!assigned.includes(yearNum)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `ไม่มีสิทธิ์เข้าถึงปี ${yearNum} — ปีที่คุณรับผิดชอบ: ${assigned.join(', ') || '(ไม่มี)'}` },
          { status: 403 },
        ),
      };
    }
    return { ok: true, year: yearNum };
  }

  return { ok: false, response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
}

/**
 * Same as checkYearIdAccess but takes a raw year number directly.
 */
export function checkYearNumberAccess(
  yearNum: number,
  session: AccessSession,
  assignedYears: number[],
): { ok: true } | { ok: false; response: NextResponse } {
  const role = (session?.user as any)?.role;
  if (!session || !role) {
    return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }
  if (role === 'admin') return { ok: true };
  if (role === 'teacher' || role === 'committee') {
    if (!assignedYears.includes(yearNum)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `ไม่มีสิทธิ์เข้าถึงปี ${yearNum}` },
          { status: 403 },
        ),
      };
    }
    return { ok: true };
  }
  return { ok: false, response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
}
