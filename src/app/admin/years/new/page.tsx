'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { invalidateYears } from '@/lib/yearsCache';

type F = { _id: string; nameTh: string };
type P = { _id: string; code: string; nameTh: string; faculty: string };
type Y = { _id: string; year: number; programId: { _id: string } | string };

type Mode = 'all' | 'one' | 'none';

function NewYearInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();

  const lockedYear = sp.get('year') ? Number(sp.get('year')) : null;

  const [faculties, setFaculties] = useState<F[]>([]);
  const [progs, setProgs] = useState<P[]>([]);
  const [existingYears, setExistingYears] = useState<Y[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Default to 'one' when locked (user came from a specific year card),
  // 'all' otherwise (admin opening a brand new year)
  const [mode, setMode] = useState<Mode>(lockedYear != null ? 'one' : 'all');

  const [year, setYear] = useState<number>(lockedYear ?? new Date().getFullYear() + 543);
  const [programId, setProgramId] = useState('');
  const [level, setLevel] = useState('เทียบโอน');

  useEffect(() => { (async () => {
    try {
      const [fs, ps, ys] = await Promise.all([
        (await fetch('/api/faculties')).json(),
        (await fetch('/api/programs')).json(),
        (await fetch('/api/years')).json(),
      ]);
      setFaculties(fs); setProgs(ps); setExistingYears(ys);

      // Auto-bump to a year that isn't already fully populated (only when not locked)
      if (lockedYear == null && Array.isArray(ys) && Array.isArray(ps) && ps.length > 0) {
        const totalProgs = ps.length;
        const countByYear = new Map<number, number>();
        ys.forEach((y: Y) => countByYear.set(y.year, (countByYear.get(y.year) || 0) + 1));
        setYear(prev => {
          let candidate = prev;
          for (let i = 0; i < 10; i++) {
            if ((countByYear.get(candidate) || 0) < totalProgs) return candidate;
            candidate += 1;
          }
          return candidate;
        });
      }
    } finally { setLoading(false); }
  })(); }, [lockedYear]);

  const usedProgramIds = useMemo(() => {
    const s = new Set<string>();
    existingYears.forEach(y => {
      if (y.year !== year) return;
      const pid = typeof y.programId === 'string' ? y.programId : y.programId?._id;
      if (pid) s.add(String(pid));
    });
    return s;
  }, [existingYears, year]);

  const availableProgs = useMemo(
    () => progs.filter(p => !usedProgramIds.has(String(p._id))),
    [progs, usedProgramIds],
  );
  const usedProgs = useMemo(
    () => progs.filter(p => usedProgramIds.has(String(p._id))),
    [progs, usedProgramIds],
  );

  // Programs in this year that already exist (count for "all" mode preview)
  const yearAlreadyHasAll = !loading && progs.length > 0 && availableProgs.length === 0;

  useEffect(() => {
    if (programId && usedProgramIds.has(String(programId))) setProgramId('');
  }, [programId, usedProgramIds]);

  async function submitAll(e: React.FormEvent) {
    e.preventDefault();
    if (!year || year < 2400 || year > 2700) {
      toast({ type: 'error', message: 'ปีไม่ถูกต้อง' }); return;
    }
    if (progs.length === 0) {
      toast({ type: 'error', message: 'ยังไม่มีสาขาในระบบ' }); return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/years/bulk', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ year: Number(year), level }),
      });
      const data = await r.json();
      if (!r.ok) { toast({ type: 'error', message: data.error || 'เปิดปีไม่สำเร็จ' }); return; }
      const { created, skipped } = data as { created: number; skipped: number };
      if (created === 0) {
        toast({ type: 'success', message: `ปี ${year} มีสาขาครบทุกตัวอยู่แล้ว` });
      } else {
        toast({
          type: 'success',
          message: `เปิดปี ${year} แล้ว — เพิ่ม ${created} สาขา${skipped > 0 ? ` (ข้าม ${skipped} ที่มีอยู่แล้ว)` : ''}`,
        });
      }
      invalidateYears();
      router.push(`/admin/years?year=${year}`);
      router.refresh();
    } finally { setSubmitting(false); }
  }

  async function submitOne(e: React.FormEvent) {
    e.preventDefault();
    if (!programId) { toast({ type: 'error', message: 'กรุณาเลือกสาขา' }); return; }
    if (usedProgramIds.has(String(programId))) {
      toast({ type: 'error', message: 'สาขานี้มีอยู่ในปีนี้แล้ว' }); return;
    }
    if (!year || year < 2400 || year > 2700) { toast({ type: 'error', message: 'ปีไม่ถูกต้อง' }); return; }
    setSubmitting(true);
    try {
      const r = await fetch('/api/years', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ year: Number(year), programId, level }),
      });
      const data = await r.json();
      if (!r.ok) { toast({ type: 'error', message: data.error || 'เพิ่มไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: `เพิ่มสาขาเข้าปี ${year} เรียบร้อย` });
      invalidateYears();
      router.push(`/admin/years?year=${year}`);
      router.refresh();
    } finally { setSubmitting(false); }
  }

  const noProgs = !loading && progs.length === 0;
  const backHref = lockedYear ? `/admin/years?year=${lockedYear}` : '/admin/years';

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      <nav className="text-sm text-slate-500 flex items-center gap-1.5">
        <Link href={backHref} className="hover:text-brand-600 transition">📅 ปีการศึกษา</Link>
        <span className="text-slate-400">/</span>
        <span className="text-ink font-medium">{lockedYear ? `เพิ่มสาขาเข้าปี ${lockedYear}` : 'เพิ่มปีใหม่'}</span>
      </nav>

      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="page-eyebrow">เพิ่มข้อมูล</div>
            <h1 className="page-title">
              {lockedYear ? <>เพิ่มสาขาเข้าปี <span className="text-brand-600">{lockedYear}</span></> : 'เพิ่มปีการศึกษาใหม่'}
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-xl">
              {lockedYear
                ? 'เลือกสาขาที่ต้องการเปิดเพิ่มในปีนี้'
                : 'เปิดปีการศึกษา — โดยปกติจะเปิดให้ครบทุกสาขาในครั้งเดียว'}
            </p>
          </div>
          <div className="hidden sm:block text-5xl opacity-20">📅</div>
        </div>
      </section>

      {/* Mode toggle (hide when lockedYear because user came in to add 1 specific program) */}
      {!lockedYear && !noProgs && (
        <div className="surface surface-pad">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">รูปแบบการเพิ่ม</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('all')}
              className={`text-left border rounded-lg p-4 transition ${
                mode === 'all'
                  ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-200'
                  : 'border-line hover:bg-soft'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {mode === 'all' && <span className="text-brand-600">✓</span>}
                <span>🎯 เปิดปีพร้อมทุกสาขา</span>
                <span className="text-xs text-slate-400 ml-auto">แนะนำ</span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                สร้างปีใหม่และเปิดให้สาขาทั้งหมด <b>{progs.length}</b> สาขาในระบบทันที
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode('one')}
              className={`text-left border rounded-lg p-4 transition ${
                mode === 'one'
                  ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-200'
                  : 'border-line hover:bg-soft'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {mode === 'one' && <span className="text-brand-600">✓</span>}
                <span>🔧 เลือกเฉพาะ 1 สาขา</span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                สำหรับกรณีพิเศษ — เปิดสาขาเดี่ยวเข้าปีที่ต้องการ
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode('none')}
              className={`text-left border rounded-lg p-4 transition ${
                mode === 'none'
                  ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-200'
                  : 'border-line hover:bg-soft'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                {mode === 'none' && <span className="text-brand-600">✓</span>}
                <span>📋 เพิ่มปีเปล่า</span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                สร้างปีโดยไม่มีสาขา — อาจารย์จะเพิ่มสาขาและรายวิชาเองทีหลัง
              </p>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        <section className="surface surface-pad lg:col-span-2">
          {noProgs && mode !== 'none' ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">⚠️</div>
              <p className="font-medium">ยังไม่มีสาขา</p>
              <p className="text-sm text-slate-500 mt-1 mb-4">ต้องเพิ่มสาขาในระบบก่อน ถึงจะเปิดปีการศึกษาได้</p>
              <Link href="/admin/programs" className="btn btn-primary">→ ไปหน้าจัดการสาขา</Link>
            </div>
          ) : mode === 'none' ? (
            // === Mode: empty year, no programs ===
            <div className="space-y-5">
              <div>
                <label className="label">ปีการศึกษา (พ.ศ.)</label>
                <input type="number" className="input" value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  min={2400} max={2700} />
                <p className="text-xs text-slate-500 mt-1">เช่น 2569, 2570</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                ⚠ ปีการศึกษาจะปรากฏในระบบเมื่อเพิ่มสาขาแรกเข้าไปแล้ว — กดปุ่มด้านล่างเพื่อไปหน้าปีนั้นแล้วเพิ่มสาขาได้เลย
              </div>
              <div className="flex items-center gap-2 pt-5 border-t border-line">
                <Link href={backHref} className="btn">← ยกเลิก</Link>
                <div className="flex-1" />
                <button type="button" disabled={!year || year < 2400 || year > 2700}
                  onClick={() => { invalidateYears(); router.push(`/admin/years?year=${year}`); }}
                  className="btn btn-primary btn-lg">
                  ✅ เปิดปีการศึกษา {year}
                </button>
              </div>
            </div>
          ) : mode === 'all' ? (
            // === Mode: open year for all programs ===
            <form onSubmit={submitAll} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">ปีการศึกษา (พ.ศ.)</label>
                  <input type="number" className="input" value={year}
                    onChange={e => setYear(Number(e.target.value))}
                    min={2400} max={2700} required disabled={loading} />
                  <p className="text-xs text-slate-500 mt-1">เช่น 2569, 2570</p>
                </div>
                <div>
                  <label className="label">ระดับการศึกษา</label>
                  <input className="input" value={level}
                    onChange={e => setLevel(e.target.value)}
                    placeholder="เช่น เทียบโอน, ปกติ" disabled={loading} />
                  <p className="text-xs text-slate-500 mt-1">เริ่มต้น: เทียบโอน</p>
                </div>
              </div>

              <div className="border border-line rounded-lg p-4 bg-soft/40">
                <div className="text-sm font-medium mb-2">
                  📚 จะเปิดให้ {progs.length} สาขาในปี {year}
                  {yearAlreadyHasAll && (
                    <span className="ml-2 text-xs text-emerald-700 font-normal">
                      (ปีนี้มีครบแล้ว — กดได้แต่จะไม่เพิ่มอะไร)
                    </span>
                  )}
                  {!yearAlreadyHasAll && usedProgs.length > 0 && (
                    <span className="ml-2 text-xs text-amber-700 font-normal">
                      ({usedProgs.length} สาขามีอยู่แล้ว — จะข้ามให้)
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {progs.map(p => {
                    const exists = usedProgramIds.has(String(p._id));
                    return (
                      <span key={p._id}
                        className={`text-xs px-2 py-1 rounded border ${
                          exists
                            ? 'bg-soft border-line text-slate-500 line-through'
                            : 'bg-brand-50 border-brand-200 text-brand-700'
                        }`}>
                        {p.nameTh}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-5 border-t border-line">
                <Link href={backHref} className="btn">← ยกเลิก</Link>
                <div className="flex-1" />
                <button type="submit" disabled={submitting || loading} className="btn btn-primary btn-lg">
                  {submitting ? 'กำลังบันทึก...' : `🚀 เปิดปี ${year} ให้ทุกสาขา`}
                </button>
              </div>
            </form>
          ) : (
            // === Mode: single program ===
            <form onSubmit={submitOne} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">ปีการศึกษา (พ.ศ.)</label>
                  <input type="number" className="input" value={year}
                    onChange={e => setYear(Number(e.target.value))}
                    min={2400} max={2700} required disabled={loading || lockedYear != null}
                    readOnly={lockedYear != null} />
                  <p className="text-xs text-slate-500 mt-1">
                    {lockedYear != null
                      ? `🔒 ล็อกที่ปี ${lockedYear} (มาจากหน้าจัดการปีการศึกษา)`
                      : 'เช่น 2569, 2570'}
                  </p>
                </div>
                <div>
                  <label className="label">ระดับการศึกษา</label>
                  <input className="input" value={level}
                    onChange={e => setLevel(e.target.value)}
                    placeholder="เช่น เทียบโอน, ปกติ" disabled={loading} />
                  <p className="text-xs text-slate-500 mt-1">เริ่มต้น: เทียบโอน</p>
                </div>
              </div>

              <div>
                <label className="label">สาขาวิชา</label>
                <select className="input" value={programId}
                  onChange={e => setProgramId(e.target.value)} required disabled={loading}>
                  <option value="">{loading ? 'กำลังโหลด...' : '— เลือกสาขา —'}</option>
                  {availableProgs.length > 0 && (
                    <optgroup label="✅ เพิ่มได้">
                      {availableProgs.map(p => (
                        <option key={p._id} value={p._id}>
                          {p.nameTh}{p.faculty ? ` (${p.faculty})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {usedProgs.length > 0 && (
                    <optgroup label={`🔒 มีอยู่แล้วในปี ${year} (เลือกไม่ได้)`}>
                      {usedProgs.map(p => (
                        <option key={p._id} value={p._id} disabled>
                          {p.nameTh} — มีแล้ว
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  ไม่เจอสาขาที่ต้องการ? <Link href="/admin/programs" className="text-brand-600 hover:underline">เพิ่มสาขาที่หน้าจัดการสาขา</Link>
                </p>
                {availableProgs.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    ปี {year} มีสาขาครบทุกตัวแล้ว — เปลี่ยนปีเพื่อเพิ่มสาขา
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-5 border-t border-line">
                <Link href={backHref} className="btn">← ยกเลิก</Link>
                <div className="flex-1" />
                <button type="submit" disabled={submitting || loading || availableProgs.length === 0}
                  className="btn btn-primary btn-lg">
                  {submitting ? 'กำลังบันทึก...' : '💾 บันทึก'}
                </button>
              </div>
            </form>
          )}
        </section>

        <aside className="space-y-4">
          {mode === 'all' ? (
            <div className="surface surface-pad bg-gradient-to-br from-brand-50/50 to-white border-brand-100">
              <div className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">📋 ตัวอย่าง</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">ปี</span>
                  <span className="font-semibold">{year || '—'}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">ระดับ</span>
                  <span className="font-medium text-right">{level || '—'}</span>
                </div>
                <div className="flex justify-between gap-2 pt-2 border-t border-brand-100">
                  <span className="text-slate-500">จะเปิดให้</span>
                  <span className="font-medium text-right">
                    {progs.length - usedProgs.length} / {progs.length} สาขา
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="surface surface-pad bg-gradient-to-br from-brand-50/50 to-white border-brand-100">
              <div className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">📋 ตัวอย่าง</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">ปี</span>
                  <span className="font-semibold flex items-center gap-1">
                    {year || '—'}
                    {lockedYear != null && <span className="text-[10px] text-brand-600">🔒</span>}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">ระดับ</span>
                  <span className="font-medium text-right">{level || '—'}</span>
                </div>
                <div className="flex justify-between gap-2 pt-2 border-t border-brand-100">
                  <span className="text-slate-500">สาขา</span>
                  <span className="font-medium text-right truncate ml-2">
                    {programId
                      ? progs.find(p => p._id === programId)?.nameTh || '—'
                      : <span className="text-slate-400">ยังไม่ได้เลือก</span>}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="surface surface-pad">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">💡 ข้อแนะนำ</div>
            <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <li className="flex gap-2"><span className="text-brand-500 shrink-0">•</span><span>แนะนำใช้ "เพิ่มปีเปล่า" แล้วให้อาจารย์เพิ่มสาขาทีหลัง</span></li>
              <li className="flex gap-2"><span className="text-brand-500 shrink-0">•</span><span>1 ปี สามารถมีหลายสาขา — เพิ่มทีละสาขาได้</span></li>
              <li className="flex gap-2"><span className="text-brand-500 shrink-0">•</span><span>หลังเพิ่มแล้ว ไปเพิ่มรายวิชาและนักศึกษาในปีนั้นได้เลย</span></li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense><NewYearInner /></Suspense>;
}
