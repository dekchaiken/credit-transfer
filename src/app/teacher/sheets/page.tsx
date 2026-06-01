'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import YearPickerModal from '@/components/YearPickerModal';
import { useActiveYear } from '@/lib/useActiveYear';

type Sheet = {
  _id: string; status: string; updatedAt: string;
  studentId: {
    _id: string; studentId: string; fullName: string;
    yearId: { _id: string; year: number };
    programId: { _id: string; nameTh: string; faculty: string };
  };
};

type PreviewData = {
  sheet: { selections: { uniCourseId: string; groupNo: number; grade: string; selected: boolean; outsideCE: boolean }[]; status: string };
  student: { studentId: string; fullName: string; programId: { nameTh: string }; yearId: { year: number } };
  courses: { _id: string; code: string; nameTh: string }[];
};

function PreviewModal({ sheetId, studentId, onClose }: { sheetId: string; studentId: string; onClose: () => void }) {
  const [data, setData] = useState<PreviewData | null>(null);
  useEffect(() => {
    fetch(`/api/sheets/${studentId}?byStudent=1`).then(r => r.json()).then(setData);
  }, [studentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 animate-fadeIn" />
      <div className="relative bg-white rounded-2xl shadow-lift w-full max-w-5xl h-[90vh] flex flex-col animate-slideDown" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-ink">{data?.student.fullName ?? '...'}</h3>
            <div className="text-xs text-slate-500 mt-0.5">{data?.student.programId?.nameTh} · ปี {data?.student.yearId?.year}</div>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/sheets/${sheetId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-primary"
            >
              📄 เปิดในแท็บใหม่
            </a>
            <button onClick={onClose} className="btn btn-sm">✕ ปิด</button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <iframe
            src={`/api/sheets/${sheetId}/pdf`}
            className="w-full h-full border-0"
            title="PDF Preview"
          />
        </div>
      </div>
    </div>
  );
}

const norm = (s: string | undefined | null) => (s ?? '').normalize('NFC').trim();

function SheetsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="surface p-3 animate-pulseSoft flex gap-4 items-center">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-4 flex-1" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function SheetsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const {
    loadingYears, yearOptions,
    selectedYear, selectedYearExists,
    canClosePicker,
    setYear,
    pickerOpen, openPicker, closePicker,
  } = useActiveYear({ childParams: ['faculty', 'programId'], resolveFromYearId: false });

  const facultyParam = sp.get('faculty');
  const programIdParam = sp.get('programId');

  const [list, setList] = useState<Sheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusTab, setStatusTab] = useState<'all' | 'pending_review' | 'finalized' | 'draft'>('pending_review');
  const [preview, setPreview] = useState<{ sheetId: string; studentId: string } | null>(null);

  // === Load sheets ===
  useEffect(() => { (async () => {
    setLoading(true);
    try { setList(await (await fetch('/api/sheets')).json()); }
    finally { setLoading(false); }
  })(); }, []);

  function setLocalParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(Array.from(sp.entries()));
    for (const [k, v] of Object.entries(next)) {
      if (v == null) params.delete(k); else params.set(k, v);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  // === Restrict to selected year first ===
  const yearScoped = useMemo(() => {
    if (!selectedYear) return [];
    return list.filter(s => s.studentId?.yearId?.year === selectedYear);
  }, [list, selectedYear]);

  // === Build faculty + program options from sheets in this year ===
  const facultyOptions = useMemo(() => {
    const set = new Map<string, number>();
    yearScoped.forEach(s => {
      const f = norm(s.studentId?.programId?.faculty);
      if (!f) return;
      set.set(f, (set.get(f) || 0) + 1);
    });
    return [...set.entries()].sort((a, b) => a[0].localeCompare(b[0], 'th'));
  }, [yearScoped]);

  const programOptions = useMemo(() => {
    const map = new Map<string, { id: string; nameTh: string; faculty: string; count: number }>();
    yearScoped.forEach(s => {
      const p = s.studentId?.programId;
      if (!p?._id) return;
      if (facultyParam && norm(p.faculty) !== norm(facultyParam)) return;
      const cur = map.get(p._id);
      if (cur) cur.count++;
      else map.set(p._id, { id: p._id, nameTh: p.nameTh, faculty: p.faculty, count: 1 });
    });
    return [...map.values()].sort((a, b) => a.nameTh.localeCompare(b.nameTh, 'th'));
  }, [yearScoped, facultyParam]);

  // If selected programId no longer matches faculty filter, clear it
  useEffect(() => {
    if (!programIdParam) return;
    if (!yearScoped.length) return;
    const stillValid = programOptions.some(p => p.id === programIdParam);
    if (!stillValid) setLocalParams({ programId: null });
  }, [programIdParam, programOptions, yearScoped.length]); // eslint-disable-line

  // === Apply faculty + program + search + status filters ===
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return yearScoped.filter(x => {
      if (facultyParam && norm(x.studentId?.programId?.faculty) !== norm(facultyParam)) return false;
      if (programIdParam && x.studentId?.programId?._id !== programIdParam) return false;
      if (statusTab !== 'all' && x.status !== statusTab) return false;
      if (s) {
        const hit = x.studentId?.studentId?.toLowerCase().includes(s)
          || x.studentId?.fullName?.toLowerCase().includes(s);
        if (!hit) return false;
      }
      return true;
    });
  }, [yearScoped, facultyParam, programIdParam, q, statusTab]);

  const ready = !loading && !loadingYears && selectedYear != null && selectedYearExists;

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* === Hero === */}
      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="page-eyebrow">📑 ใบเทียบโอน</div>
            {selectedYear && selectedYearExists ? (
              <>
                <h1 className="page-title flex items-center gap-3 flex-wrap">
                  <span className="text-brand-600">ปี {selectedYear}</span>
                  {facultyParam && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="truncate text-base font-medium text-slate-700">{facultyParam}</span>
                    </>
                  )}
                  {programIdParam && (() => {
                    const p = programOptions.find(p => p.id === programIdParam);
                    return p ? (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="truncate text-base font-medium text-slate-700">{p.nameTh}</span>
                      </>
                    ) : null;
                  })()}
                </h1>
                <p className="text-sm text-slate-600 mt-2">
                  ใบเทียบของนักศึกษาในปีการศึกษานี้
                </p>
              </>
            ) : (
              <>
                <h1 className="page-title">ใบเทียบโอนทั้งหมด</h1>
                <p className="text-sm text-slate-600 mt-2">เลือกปี → กรองคณะ/สาขา → ดูใบเทียบ</p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            {selectedYear && selectedYearExists && (
              <button onClick={openPicker} className="btn">🔄 เปลี่ยนปี</button>
            )}
            {(facultyParam || programIdParam) && (
              <button onClick={() => setLocalParams({ faculty: null, programId: null })} className="btn">↺ ล้างตัวกรอง</button>
            )}
            {ready && (
              <div className="text-right pl-2 border-l border-line">
                <div className="text-xs text-slate-500">ใบเทียบ</div>
                <div className="text-2xl font-semibold text-brand-600">{filtered.length}</div>
                {filtered.length !== yearScoped.length && (
                  <div className="text-xs text-slate-400">จาก {yearScoped.length}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* === Filters === */}
      {ready && (
        <section className="surface surface-pad animate-slideUp">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">คณะ</label>
              <select
                className="input"
                value={facultyParam || ''}
                onChange={e => setLocalParams({ faculty: e.target.value || null, programId: null })}
              >
                <option value="">-- ทุกคณะ --</option>
                {facultyOptions.map(([f, n]) => (
                  <option key={f} value={f}>{f} ({n})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">สาขา</label>
              <select
                className="input"
                value={programIdParam || ''}
                onChange={e => setLocalParams({ programId: e.target.value || null })}
              >
                <option value="">-- ทุกสาขา --</option>
                {programOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.nameTh} ({p.count})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">ค้นหา</label>
              <input
                className="input"
                placeholder="🔍 รหัส นศ. หรือชื่อ..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-1 bg-soft rounded-lg p-1 w-fit">
            {([['all','ทั้งหมด'],['pending_review','รอพิจารณา'],['finalized','อนุมัติแล้ว']] as const).map(([v,l]) => (
              <button key={v} onClick={() => setStatusTab(v)}
                className={`px-3 py-1 text-xs rounded transition ${statusTab === v ? 'bg-white shadow-soft font-medium' : 'text-muted hover:text-ink'}`}>
                {l} <span className="text-slate-400">({yearScoped.filter(s => v === 'all' || s.status === v).length})</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* === List === */}
      {ready && (
        <section className="surface surface-pad animate-slideUp">
          <h2 className="section-title flex items-center gap-2 mb-3">
            📋 รายการ <span className="badge">{filtered.length}</span>
          </h2>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500">
              <div className="text-3xl mb-2">📭</div>
              {q || facultyParam || programIdParam ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีใบเทียบในปีนี้ — สร้างจากหน้านักศึกษา'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>รหัส นศ.</th><th>ชื่อ</th><th>คณะ</th><th>สาขา</th><th>ปี</th>
                    <th>สถานะ</th><th>อัปเดต</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s._id} className="hover:bg-soft transition">
                      <td className="font-mono text-xs">{s.studentId?.studentId}</td>
                      <td>{s.studentId?.fullName}</td>
                      <td className="text-xs text-muted">{s.studentId?.programId?.faculty}</td>
                      <td className="text-xs text-muted">{s.studentId?.programId?.nameTh}</td>
                      <td className="font-mono">{s.studentId?.yearId?.year}</td>
                      <td>
                        <span className={`badge ${s.status === 'finalized' ? 'badge-success' : s.status === 'pending_review' ? 'badge-warning' : 'badge-brand'}`}>
                          {s.status === 'finalized' ? 'อนุมัติแล้ว' : s.status === 'pending_review' ? 'รอพิจารณา' : 'ร่าง'}
                        </span>
                      </td>
                      <td className="text-xs text-muted">{new Date(s.updatedAt).toLocaleString('th-TH')}</td>
                      <td className="text-right whitespace-nowrap">
                        <a href={`/teacher/sheets/${s.studentId?._id}`} className="btn btn-sm">✏️ แก้ไข</a>
                        {' '}
                        {s.status === 'finalized' && (
                          <>
                            <button onClick={() => setPreview({ sheetId: s._id, studentId: s.studentId?._id })} className="btn btn-sm">👁 พรีวิว</button>
                            {' '}
                            <a href={`/api/sheets/${s._id}/pdf`} target="_blank" className="btn btn-sm btn-primary">📄 PDF</a>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Loading state before year chosen */}
      {(loading || loadingYears) && !ready && <SheetsSkeleton />}

      {/* No years */}
      {!loadingYears && yearOptions.length === 0 && (
        <section className="surface surface-pad-lg text-center">
          <div className="text-5xl mb-3">📅</div>
          <p className="font-medium">ยังไม่มีปีการศึกษา</p>
          <p className="text-sm text-slate-500 mt-1">ไปที่หน้า "จัดการปีการศึกษา" เพื่อเพิ่มก่อน</p>
        </section>
      )}

      {/* Year picker */}
      <YearPickerModal
        open={pickerOpen}
        loading={loadingYears}
        years={yearOptions}
        selectedYear={selectedYear ?? undefined}
        canClose={canClosePicker}
        onSelect={setYear}
        onClose={() => {
          closePicker();
          if (!canClosePicker) router.push('/teacher');
        }}
      />
      {preview && <PreviewModal sheetId={preview.sheetId} studentId={preview.studentId} onClose={() => setPreview(null)} />}
    </div>
  );
}

export default function Page() {
  return <Suspense><SheetsInner /></Suspense>;
}
