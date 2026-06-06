'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/components/Toast';
import ConfirmDialog, { type ConfirmOptions } from '@/components/ConfirmDialog';
import YearPickerModal from '@/components/YearPickerModal';
import { invalidateYears } from '@/lib/yearsCache';

type P = { _id: string; code: string; nameTh: string; faculty: string };
type Y = { _id: string; year: number; level: string; programId: P };
type AssignableUser = { _id: string; username: string; fullName: string; role: string; assignedYears?: number[] };

function AdminYearsPageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [years, setYears] = useState<Y[]>([]);
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  function askConfirm(opts: ConfirmOptions, action: () => void) {
    setConfirmOpts(opts); setConfirmAction(() => action); setConfirmOpen(true);
  }

  const yearParam = sp.get('year');
  const selectedYear = yearParam ? Number(yearParam) : null;

  async function load() {
    setLoading(true);
    try {
      const [ys, us] = await Promise.all([
        fetch('/api/years').then(r => r.json()),
        fetch('/api/users').then(r => r.json()).catch(() => []),
      ]);
      setYears(Array.isArray(ys) ? ys : []);
      setUsers(Array.isArray(us) ? (us as AssignableUser[]).filter(u => ['teacher', 'committee'].includes(u.role)) : []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const yearGroups = useMemo(() => {
    const map = new Map<number, Y[]>();
    years.forEach(y => {
      const arr = map.get(y.year) || [];
      arr.push(y);
      map.set(y.year, arr);
    });
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [years]);

  const yearOptions = yearGroups.map(([year, items]) => ({ year, programCount: items.length }));
  const selectedItems = selectedYear != null ? years.filter(y => y.year === selectedYear) : [];
  const selectedYearExists = selectedYear != null && yearGroups.some(([y]) => y === selectedYear);

  useEffect(() => {
    if (loading) return;
    if (!selectedYear || !selectedYearExists) {
      setPickerOpen(true);
    }
  }, [loading, selectedYear, selectedYearExists]);

  function pickYear(year: number) {
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.set('year', String(year));
    router.replace(`${pathname}?${params.toString()}`);
    setPickerOpen(false);
  }

  function delYear(id: string, year: number, prog: string) {
    askConfirm({
      title: `ลบปี ${year}?`,
      message: `สาขา ${prog}\nข้อมูลวิชา/กลุ่มเทียบ/นักศึกษาในปีนี้อาจอ้างอิงไม่ได้`,
      confirmText: '🗑 ลบปี', cancelText: 'ยกเลิก', variant: 'danger',
    }, async () => {
      const r = await fetch(`/api/years/${id}`, { method: 'DELETE' });
      if (!r.ok) { toast({ type: 'error', message: r.status === 401 ? 'ไม่มีสิทธิ์' : 'ลบไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: 'ลบแล้ว' });
      invalidateYears();
      load();
    });
  }

  // Helpers for "who is responsible for which year"
  const usersByYear = useMemo(() => {
    const map = new Map<number, AssignableUser[]>();
    users.forEach(u => {
      (u.assignedYears || []).forEach(y => {
        const arr = map.get(y) || [];
        arr.push(u);
        map.set(y, arr);
      });
    });
    return map;
  }, [users]);

  // Toggle one user's assignment for the currently-selected year
  async function toggleAssign(u: AssignableUser, year: number) {
    const cur = u.assignedYears || [];
    const has = cur.includes(year);
    const next = has ? cur.filter(y => y !== year) : [...cur, year];
    const r = await fetch(`/api/users/${u._id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: u.fullName,
        role: u.role,
        assignedYears: next,
      }),
    });
    if (!r.ok) {
      toast({ type: 'error', message: (await r.json().catch(() => ({})))?.error || 'อัปเดตไม่สำเร็จ' });
      return;
    }
    toast({ type: 'success', message: has ? `เอา ${u.username} ออกจากปี ${year}` : `เพิ่ม ${u.username} ให้ปี ${year}` });
    load();
  }

  const canClosePicker = selectedYear != null && selectedYearExists;

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* === Hero === */}
      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="page-eyebrow">📅 ปีการศึกษา (Admin)</div>
            {selectedYear && selectedYearExists ? (
              <>
                <h1 className="page-title flex items-center gap-3 flex-wrap">
                  ปีการศึกษา <span className="text-brand-600">{selectedYear}</span>
                </h1>
                <p className="text-sm text-slate-600 mt-2">
                  จัดการสาขา {selectedItems.length} รายการในปีนี้
                </p>
              </>
            ) : (
              <>
                <h1 className="page-title">จัดการปีการศึกษา</h1>
                <p className="text-sm text-slate-600 mt-2 max-w-xl">
                  เปิด/ปิดปีการศึกษาและสาขาในแต่ละปี — เฉพาะ admin
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedYear && selectedYearExists && (
              <button onClick={() => setPickerOpen(true)} className="btn">
                🔄 เปลี่ยนปี
              </button>
            )}
          </div>
        </div>
      </section>

      {/* === Detail panel for selected year === */}
      {!loading && selectedYear && selectedYearExists && (
        <>
          {/* Assignees panel */}
          <section className="surface surface-pad animate-slideUp">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="section-title">👥 ผู้รับผิดชอบปี {selectedYear}</h2>
              <Link href="/admin/users/teacher" className="btn btn-sm btn-ghost">
                ➕ จัดการ teacher/committee
              </Link>
            </div>
            {(() => {
              const assigned = usersByYear.get(selectedYear) || [];
              const unassigned = users.filter(u => !(u.assignedYears || []).includes(selectedYear));
              const isOrphan = assigned.length === 0;
              return (
                <>
                  {isOrphan && (
                    <div className="rounded-lg border-2 border-amber-200 bg-amber-50/50 px-4 py-3 mb-4 flex items-start gap-3">
                      <span className="text-2xl">⚠️</span>
                      <div className="text-sm">
                        <div className="font-semibold text-amber-800">ยังไม่มีใครรับผิดชอบปีนี้</div>
                        <div className="text-amber-700 text-xs mt-0.5">
                          assign teacher/committee อย่างน้อย 1 คน เพื่อให้มีคนเข้าทำงานในปีนี้ได้
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">
                        ✓ รับผิดชอบอยู่ ({assigned.length})
                      </div>
                      {assigned.length === 0 ? (
                        <div className="text-xs text-slate-400 italic px-3 py-2">— ยังไม่มี —</div>
                      ) : (
                        <ul className="space-y-1.5">
                          {assigned.map(u => (
                            <li key={u._id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{u.fullName || u.username}</div>
                                <div className="text-xs text-slate-500 font-mono truncate">{u.username} · {u.role}</div>
                              </div>
                              <button onClick={() => toggleAssign(u, selectedYear)}
                                className="btn btn-sm btn-ghost text-rose-600 hover:bg-rose-50 shrink-0"
                                title="เอาออกจากปีนี้">
                                ✕ เอาออก
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">
                        + เพิ่มเข้าปีนี้ ({unassigned.length})
                      </div>
                      {unassigned.length === 0 ? (
                        <div className="text-xs text-slate-400 italic px-3 py-2">— ทุกคนรับผิดชอบปีนี้แล้ว —</div>
                      ) : (
                        <ul className="space-y-1.5 max-h-60 overflow-y-auto">
                          {unassigned.map(u => {
                            const orphan = (u.assignedYears || []).length === 0;
                            return (
                              <li key={u._id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-line hover:bg-soft transition">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                                    {u.fullName || u.username}
                                    {orphan && <span title="ยังไม่ได้ assign ปีไหนเลย" className="text-amber-600">⚠️</span>}
                                  </div>
                                  <div className="text-xs text-slate-500 font-mono truncate">
                                    {u.username} · {u.role}
                                    {(u.assignedYears || []).length > 0 && (
                                      <span className="ml-1.5 text-slate-400">
                                        ({(u.assignedYears || []).sort((a, b) => b - a).join(', ')})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <button onClick={() => toggleAssign(u, selectedYear)}
                                  className="btn btn-sm btn-primary shrink-0">
                                  + เพิ่ม
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </section>

          {/* Programs panel (existing) */}
          <section className="surface surface-pad animate-slideUp">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="section-title">📚 สาขาในปีการศึกษา {selectedYear}</h2>
              <Link href={`/admin/years/new?year=${selectedYear}`} className="btn btn-sm">+ เพิ่มสาขาเข้าปีนี้</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedItems.map(y => (
                <div key={y._id} className="border border-line rounded-lg p-4 hover:bg-soft transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm mt-0.5 truncate">{y.programId?.nameTh}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {y.programId?.faculty || '-'} · ระดับ {y.level}
                      </div>
                    </div>
                    <button onClick={() => delYear(y._id, y.year, y.programId?.nameTh || '')}
                      className="btn btn-sm btn-danger shrink-0">ลบ</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* === Empty state shown briefly while picker is opening === */}
      {!loading && (!selectedYear || !selectedYearExists) && yearGroups.length > 0 && (
        <section className="surface surface-pad-lg text-center">
          <div className="text-5xl mb-3 opacity-30">👆</div>
          <p className="font-medium">กรุณาเลือกปีการศึกษา</p>
          <button onClick={() => setPickerOpen(true)} className="btn btn-primary mt-3">
            เลือกปีการศึกษา
          </button>
        </section>
      )}

      {/* === Empty state — no years at all === */}
      {!loading && yearGroups.length === 0 && (
        <section className="surface surface-pad-lg text-center">
          <div className="text-5xl mb-3 opacity-30">📅</div>
          <p className="font-medium">ยังไม่มีปีการศึกษาในระบบ</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">เริ่มต้นด้วยการเปิดปีการศึกษาแรก</p>
          <Link href="/admin/years/new" className="btn btn-primary">+ เปิดปีการศึกษาใหม่</Link>
        </section>
      )}

      {/* === Year picker modal === */}
      <YearPickerModal
        open={pickerOpen}
        loading={loading}
        years={yearOptions}
        selectedYear={selectedYear ?? undefined}
        canClose={canClosePicker}
        addNewHref="/admin/years/new"
        onSelect={pickYear}
        onClose={() => {
          setPickerOpen(false);
          if (!canClosePicker) {
            router.push('/admin');
          }
        }}
      />

      {/* === Confirm dialog === */}
      <ConfirmDialog
        open={confirmOpen}
        options={confirmOpts}
        onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export default function Page() {
  return <Suspense><AdminYearsPageInner /></Suspense>;
}
