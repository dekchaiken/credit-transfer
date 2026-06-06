import { NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { AuditLog } from '@/models/AuditLog';
import { requireRole } from '@/lib/auth';
import { escapeRegex } from '@/lib/helpers';

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

/**
 * GET /api/audit-log
 *   ?action=user.create        // exact match
 *   ?actionPrefix=user         // prefix match (e.g. "user.*")
 *   ?entityType=Student
 *   ?entityId=...
 *   ?actor=<userId>
 *   ?from=2025-01-01           // ISO date inclusive
 *   ?to=2025-12-31             // ISO date inclusive (until end of day)
 *   ?q=keyword                 // search in entityLabel, actorUsername
 *   ?page=1
 *   ?pageSize=50
 *   ?format=csv                // download CSV (no pagination, max 5000 rows)
 *
 * Admin only.
 */
export async function GET(req: Request) {
  try { await requireRole(['admin']); } catch (e: unknown) { if (e instanceof Response) return e; throw e; }
  await dbConnect();

  const url = new URL(req.url);
  const sp = url.searchParams;

  const filter: any = {};
  if (sp.get('action')) filter.action = sp.get('action');
  if (sp.get('actionPrefix')) filter.action = { $regex: `^${escapeRegex(sp.get('actionPrefix')!)}` };
  if (sp.get('entityType')) filter.entityType = sp.get('entityType');
  if (sp.get('entityId')) filter.entityId = sp.get('entityId');
  if (sp.get('actor')) filter.actorUserId = sp.get('actor');

  const from = sp.get('from'); const to = sp.get('to');
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  const q = sp.get('q')?.trim();
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { entityLabel: regex },
      { actorUsername: regex },
    ];
  }

  // CSV export branch
  if (sp.get('format') === 'csv') {
    const rows: any[] = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
    const header = ['createdAt', 'actorUsername', 'actorRole', 'action', 'entityType', 'entityId', 'entityLabel', 'ip'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const cells = [
        new Date(r.createdAt).toISOString(),
        r.actorUsername || '',
        r.actorRole || '',
        r.action,
        r.entityType,
        r.entityId || '',
        r.entityLabel || '',
        r.ip || '',
      ].map(csvEscape);
      lines.push(cells.join(','));
    }
    const csv = '\uFEFF' + lines.join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
  const requested = parseInt(sp.get('pageSize') || String(PAGE_SIZE_DEFAULT), 10);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, requested));

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return NextResponse.json({
    items, total, page, pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

function csvEscape(v: any): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
