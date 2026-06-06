'use client';
import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/Toast';

type AuditEntry = {
  _id: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  actorUsername?: string;
  actorRole?: string;
  ip?: string;
  before?: any;
  after?: any;
  metadata?: any;
  createdAt: string;
};

type ListResp = {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const ACTION_LABELS: Record<string, string> = {
  // user
  'user.create': 'สร้างผู้ใช้',
  'user.update': 'แก้ไขผู้ใช้',
  'user.delete': 'ลบผู้ใช้',
  'user.reset_password': 'รีเซ็ตรหัสผ่าน',
  'user.assign_year': 'มอบหมายปี',
  'user.unassign_year': 'ถอนปีที่มอบหมาย',
  // year
  'year.create': 'สร้างปีการศึกษา',
  'year.update': 'แก้ไขปีการศึกษา',
  'year.delete': 'ลบปีการศึกษา',
  'year.bulk_create': 'สร้างปีแบบกลุ่ม',
  'year.set_active': 'เปลี่ยนปีปัจจุบัน',
  // faculty / program
  'faculty.create': 'สร้างคณะ',
  'faculty.update': 'แก้ไขคณะ',
  'faculty.delete': 'ลบคณะ',
  'program.create': 'สร้างสาขา',
  'program.update': 'แก้ไขสาขา',
  'program.delete': 'ลบสาขา',
  // courses
  'unicourse.create': 'สร้างวิชา',
  'unicourse.update': 'แก้ไขวิชา',
  'unicourse.delete': 'ลบวิชา',
  'offering.create': 'เปิดสอนวิชาในปี',
  'offering.update': 'แก้ไขการเปิดสอน',
  'offering.delete': 'ลบการเปิดสอน',
  'transfer_group.create': 'สร้างกลุ่มเทียบโอน',
  'transfer_group.update': 'แก้ไขกลุ่มเทียบโอน',
  'transfer_group.delete': 'ลบกลุ่มเทียบโอน',
  // student
  'student.create': 'เพิ่มนักศึกษา',
  'student.update': 'แก้ไขนักศึกษา',
  'student.delete': 'ลบนักศึกษา',
  'student.import': 'นำเข้านักศึกษา (CSV)',
  // sheet
  'sheet.update': 'แก้ไขใบเทียบ',
  'sheet.submit_review': 'ส่งใบเทียบให้ตรวจ',
  'sheet.finalize': 'ลงนามใบเทียบ',
  'sheet.unfinalize': 'ยกเลิกการลงนาม',
  'sheet.recall': 'ดึงใบเทียบกลับ',
  'sheet.delete': 'ลบใบเทียบ',
  // settings
  'settings.update': 'แก้ไขตั้งค่าระบบ',
};

const ACTION_GROUPS = [
  { value: '', label: '— ทุกประเภท —' },
  { value: 'user', label: '👤 ผู้ใช้' },
  { value: 'year', label: '📅 ปีการศึกษา' },
  { value: 'faculty', label: '🏛️ คณะ' },
  { value: 'program', label: '📚 สาขา' },
  { value: 'unicourse', label: '📖 วิชา' },
  { value: 'offering', label: '📝 เปิดสอน' },
  { value: 'transfer_group', label: '🔗 กลุ่มเทียบ' },
  { value: 'student', label: '🎓 นักศึกษา' },
  { value: 'sheet', label: '📄 ใบเทียบ' },
  { value: 'settings', label: '⚙️ ตั้งค่า' },
];

function actionBadgeColor(action: string) {
  if (action.endsWith('.delete')) return 'bg-red-50 text-red-700 border-red-200';
  if (action.endsWith('.create') || action.endsWith('.bulk_create')) return 'bg-green-50 text-green-700 border-green-200';
  if (action.endsWith('.update') || action.includes('assign')) return 'bg-blue-50 text-blue-700 border-blue-200';
  if (action.startsWith('sheet.')) return 'bg-purple-50 text-purple-700 border-purple-200';
  if (action === 'user.reset_password') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' });
}

export default function AuditLogPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ListResp | null>(null);

  const [actionPrefix, setActionPrefix] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (actionPrefix) sp.set('actionPrefix', actionPrefix);
      if (q.trim()) sp.set('q', q.trim());
      if (from) sp.set('from', from);
      if (to) sp.set('to', to);
      sp.set('page', String(page));
      sp.set('pageSize', String(pageSize));
      const r = await fetch(`/api/audit-log?${sp.toString()}`);
      if (!r.ok) {
        toast({ type: 'error', message: 'โหลดข้อมูลไม่สำเร็จ' });
        return;
      }
      setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, [actionPrefix, q, from, to, page, toast]);

  useEffect(() => { load(); }, [load]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  function clearFilters() {
    setActionPrefix(''); setQ(''); setFrom(''); setTo(''); setPage(1);
  }

  function exportCsv() {
    const sp = new URLSearchParams();
    if (actionPrefix) sp.set('actionPrefix', actionPrefix);
    if (q.trim()) sp.set('q', q.trim());
    if (from) sp.set('from', from);
    if (to) sp.set('to', to);
    sp.set('format', 'csv');
    window.location.href = `/api/audit-log?${sp.toString()}`;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Hero */}
      <section className="page-hero surface-pad-lg">
        <div className="page-eyebrow">📜 ตรวจสอบย้อนหลัง</div>
        <h1 className="page-title">บันทึกการกระทำ (Audit Log)</h1>
        <p className="text-sm text-slate-600 mt-2">
          ดูประวัติการกระทำทั้งหมดในระบบ — ใครทำอะไร เมื่อไหร่ มีรายละเอียดอะไรบ้าง
        </p>
      </section>

      {/* Filters */}
      <section className="surface surface-pad">
        <form onSubmit={applyFilters} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3">
            <label className="label">ประเภท</label>
            <select className="input" value={actionPrefix} onChange={e => setActionPrefix(e.target.value)}>
              {ACTION_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="label">ค้นหา (ชื่อ entity / username)</label>
            <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="เช่น 65123456 หรือ admin" />
          </div>
          <div className="md:col-span-2">
            <label className="label">จากวันที่</label>
            <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">ถึงวันที่</label>
            <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex items-end gap-2">
            <button type="submit" className="btn btn-primary flex-1">🔍 ค้นหา</button>
            <button type="button" onClick={clearFilters} className="btn">↺</button>
          </div>
        </form>
        <div className="flex justify-end mt-3">
          <button type="button" onClick={exportCsv} className="btn btn-sm">⬇️ ส่งออก CSV</button>
        </div>
      </section>

      {/* Table */}
      <section className="surface surface-pad">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">
            ผลการค้นหา {data ? <span className="text-sm font-normal text-slate-500">({data.total.toLocaleString()} รายการ)</span> : null}
          </h2>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-2">📭</div>
            <div>ไม่พบรายการตามเงื่อนไขที่เลือก</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b bg-slate-50/60">
                    <th className="px-4 py-2.5 whitespace-nowrap font-medium" style={{ width: '180px' }}>เวลา</th>
                    <th className="px-4 py-2.5 whitespace-nowrap font-medium" style={{ width: '180px' }}>ผู้ใช้</th>
                    <th className="px-4 py-2.5 whitespace-nowrap font-medium" style={{ width: '200px' }}>การกระทำ</th>
                    <th className="px-4 py-2.5 font-medium">เป้าหมาย</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap font-medium" style={{ width: '100px' }}>รายละเอียด</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map(it => (
                    <tr key={it._id} className="border-b hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 align-top">{fmtDate(it.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <div className="font-medium">{it.actorUsername || '-'}</div>
                        <div className="text-xs text-slate-500">{it.actorRole || ''}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`inline-block px-2 py-0.5 text-xs border rounded ${actionBadgeColor(it.action)}`}>
                          {ACTION_LABELS[it.action] || it.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-xs text-slate-500">{it.entityType}</div>
                        <div>{it.entityLabel || it.entityId || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <button type="button" className="btn btn-sm" onClick={() => setSelected(it)}>
                          ดู
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 text-sm">
              <div className="text-slate-500">
                หน้า {data.page} / {data.totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={data.page <= 1}
                >← ก่อนหน้า</button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={data.page >= data.totalPages}
                >ถัดไป →</button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Detail modal */}
      {selected && <DetailModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DetailModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">{fmtDate(entry.createdAt)}</div>
            <h3 className="text-lg font-semibold">
              <span className={`inline-block px-2 py-0.5 text-xs border rounded mr-2 ${actionBadgeColor(entry.action)}`}>
                {ACTION_LABELS[entry.action] || entry.action}
              </span>
              {entry.entityLabel || entry.entityId || entry.entityType}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm">ปิด ✕</button>
        </div>

        <div className="p-5 space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <KV label="ผู้ใช้" value={`${entry.actorUsername || '-'} (${entry.actorRole || '-'})`} />
            <KV label="IP" value={entry.ip || '-'} />
            <KV label="Action" value={<code className="bg-soft px-1.5 py-0.5 rounded">{entry.action}</code>} />
            <KV label="Entity" value={`${entry.entityType}${entry.entityId ? ` · ${entry.entityId}` : ''}`} />
          </div>

          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <Section title="ข้อมูลเพิ่มเติม">
              <JsonBlock data={entry.metadata} />
            </Section>
          )}

          {entry.before && Object.keys(entry.before).length > 0 && (
            <Section title="ก่อนเปลี่ยน">
              <JsonBlock data={entry.before} accent="red" />
            </Section>
          )}

          {entry.after && Object.keys(entry.after).length > 0 && (
            <Section title={entry.before ? 'หลังเปลี่ยน' : 'ข้อมูล'}>
              <JsonBlock data={entry.after} accent="green" />
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-semibold mb-2 text-slate-700">{title}</h4>
      {children}
    </div>
  );
}

function JsonBlock({ data, accent }: { data: any; accent?: 'red' | 'green' }) {
  const cls = accent === 'red' ? 'bg-red-50 border-red-200'
    : accent === 'green' ? 'bg-green-50 border-green-200'
    : 'bg-slate-50 border-slate-200';
  // pretty key/value table for objects, fall back to JSON for arrays/primitives
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return (
      <div className={`border rounded ${cls} divide-y divide-current/10`}>
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-2 px-3 py-2 text-xs">
            <div className="font-medium text-slate-700">{k}</div>
            <div className="col-span-2 break-all">
              {typeof v === 'object' && v !== null ? <code>{JSON.stringify(v)}</code> : String(v ?? '—')}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <pre className={`border rounded p-3 text-xs overflow-x-auto ${cls}`}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
