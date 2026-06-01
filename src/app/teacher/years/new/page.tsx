'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { invalidateYears } from '@/lib/yearsCache';

type F = { _id: string; nameTh: string };
type P = { _id: string; code: string; nameTh: string; faculty: string };
type Y = { _id: string; year: number; programId: { _id: string } | string };

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
    } finally { setLoading(false); }
  })(); }, []);

  // Programs already attached to this year — must NOT be selectable
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

  // If selected program becomes invalid (e.g. year changed), clear it
  useEffect(() => {
    if (programId && usedProgramIds.has(String(programId))) setProgramId('');
  }, [programId, usedProgramIds]);

  async function submit(e: React.FormEvent) {
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
      toast({ type: 'success', message: `เพิ่มปี ${year} เรียบร้อย` });
      invalidateYears();
      router.push(`/teacher/years?year=${year}`);
      router.refresh();
    } finally { setSubmitting(false); }
  }

  const noProgs = !loading && progs.length === 0;
  const noAvailable = !loading && progs.length > 0 && availableProgs.length === 0;
  const backHref = lockedYear ? `/teacher/years?year=${lockedYear}` : '/teacher/years';

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-slate-500 flex items-center gap-1.5">
        <Link href={backHref} className="hover:text-brand-600 transition">📅 ปีการศึกษา</Link>
        <span className="text-slate-400">/</span>
        <span className="text-ink font-medium">{lockedYear ? `เพิ่มสาขาเข้าปี ${lockedYear}` : 'เพิ่มปีใหม่'}</span>
      </nav>

      {/* Hero */}
      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="page-eyebrow">เพิ่มข้อมูล</div>
            <h1 className="page-title">
              {lockedYear ? <>เพิ่มสาขาเข้าปี <span className="text-brand-600">{lockedYear}</span></> : 'เพิ่มปีการศึกษาใหม่'}
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-xl">
              {lockedYear
                ? 'เลือกสาขาที่ต้องการเปิดในปีนี้ — สาขาที่มีอยู่แล้วจะถูกปิดไว้'
                : 'เปิดปีการศึกษาสำหรับ 1 สาขา — สามารถเพิ่มหลายสาขาแยกกันได้'}
            </p>
          </div>
          <div className="hidden sm:block text-5xl opacity-20">📅</div>
        </div>
      </section>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        {/* Form */}
        <section className="surface surface-pad lg:col-span-2">
          {noProgs ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">⚠️</div>
              <p className="font-medium">ยังไม่มีสาขา</p>
              <p className="text-sm text-slate-500 mt-1 mb-4">ต้องเพิ่มสาขาในระบบก่อน ถึงจะเปิดปีการศึกษาได้</p>
              <Link href="/teacher/programs" className="btn btn-primary">→ ไปหน้าจัดการสาขา</Link>
            </div>
          ) : noAvailable ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">✅</div>
              <p className="font-medium">ทุกสาขาถูกเพิ่มเข้าปี {year} แล้ว</p>
              <p className="text-sm text-slate-500 mt-1 mb-4">
                ปีนี้มี {usedProgs.length} สาขา ครบทุกสาขาในระบบ
              </p>
              <Link href={backHref} className="btn">← กลับ</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
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
                  ไม่เจอสาขาที่ต้องการ? <Link href="/teacher/programs" className="text-brand-600 hover:underline">เพิ่มสาขาที่หน้าจัดการสาขา</Link>
                </p>
                {usedProgs.length > 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    ปี {year} มีอยู่แล้ว {usedProgs.length} สาขา — ไม่สามารถเพิ่มซ้ำได้
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-5 border-t border-line">
                <Link href={backHref} className="btn">← ยกเลิก</Link>
                <div className="flex-1" />
                <button type="submit" disabled={submitting || loading} className="btn btn-primary btn-lg">
                  {submitting ? 'กำลังบันทึก...' : '💾 บันทึก'}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="surface surface-pad bg-gradient-to-br from-brand-50/50 to-white border-brand-100">
            <div className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">📋 ตัวอย่างที่กำลังเพิ่ม</div>
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

          {usedProgs.length > 0 && (
            <div className="surface surface-pad">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                🔒 สาขาที่มีในปี {year} แล้ว ({usedProgs.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {usedProgs.map(p => (
                  <span key={p._id} className="text-xs px-2 py-1 rounded bg-soft border border-line text-slate-600">
                    {p.nameTh}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="surface surface-pad">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">💡 ข้อแนะนำ</div>
            <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <li className="flex gap-2"><span className="text-brand-500 shrink-0">•</span><span>1 ปี = 1 สาขา → ถ้ามีหลายสาขา ให้เพิ่มแยกกัน</span></li>
              <li className="flex gap-2"><span className="text-brand-500 shrink-0">•</span><span>ปี พ.ศ. ใช้สำหรับเรียกในระบบ ไม่ผูกกับวันที่จริง</span></li>
              <li className="flex gap-2"><span className="text-brand-500 shrink-0">•</span><span>หลังเพิ่มแล้ว สามารถใส่วิชา/นักศึกษาเข้าปีนี้ได้</span></li>
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
