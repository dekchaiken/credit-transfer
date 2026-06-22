'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import YearPickerModal from '@/components/YearPickerModal';

type P = { _id: string; code: string; nameTh: string; faculty: string };
type Y = { _id: string; year: number; level: string; programId: P; _accessible?: boolean; _standalone?: boolean };

function YearsPageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [years, setYears] = useState<Y[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const yearParam = sp.get('year');
  const selectedYear = yearParam ? Number(yearParam) : null;

  async function load() {
    setLoading(true);
    try {
      const ys = await (await fetch('/api/years')).json();
      setYears(ys);
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

  const yearOptions = yearGroups.map(([year, items]) => ({
    year,
    programCount: items.filter(y => !y._standalone).length,
    // a year is accessible if AT LEAST one of its program records is accessible
    // (in practice all records of a year share the same flag for a given user)
    accessible: items.some(y => y._accessible !== false),
  }));
  const selectedItems = selectedYear != null ? years.filter(y => y.year === selectedYear && !y._standalone) : [];
  const selectedYearExists = selectedYear != null && yearGroups.some(([y]) => y === selectedYear);
  const isStandaloneOnly = selectedYearExists && years.filter(y => y.year === selectedYear).every(y => y._standalone);
  const selectedYearAccessible = selectedYearExists && (isStandaloneOnly || selectedItems.some(y => y._accessible !== false));

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

  const canClosePicker = selectedYear != null && selectedYearExists;

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* === Hero === */}
      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="page-eyebrow">📅 ปีการศึกษา</div>
            {selectedYear && selectedYearExists ? (
              <>
                <h1 className="page-title flex items-center gap-3 flex-wrap">
                  ปีการศึกษา <span className="text-brand-600">{selectedYear}</span>
                </h1>
                <p className="text-sm text-slate-600 mt-2">
                  มี {selectedItems.length} สาขาในปีนี้ — เลือกเข้าใช้งาน
                </p>
              </>
            ) : (
              <>
                <h1 className="page-title">เลือกปีการศึกษา</h1>
                <p className="text-sm text-slate-600 mt-2 max-w-xl">
                  เลือกปีการศึกษาที่ต้องการเริ่มทำงาน
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

      {/* === Detail panel for selected year === read-only, no add/delete buttons === */}
      {!loading && selectedYear && selectedYearExists && selectedYearAccessible && (
        <section className="surface surface-pad animate-slideUp">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="section-title">📚 สาขาในปีการศึกษา {selectedYear}</h2>
            <Link href={`/teacher/years/new?year=${selectedYear}`} className="btn btn-sm btn-primary">
              ＋ เพิ่มสาขา
            </Link>
          </div>
          {isStandaloneOnly ? (
            <div className="text-center py-6">
              <p className="text-sm text-slate-500 mb-3">ยังไม่มีสาขาวิชาในปีนี้</p>
              <Link href={`/teacher/years/new?year=${selectedYear}`} className="btn btn-primary btn-sm">
                ＋ เพิ่มสาขาแรก
              </Link>
            </div>
          ) : (
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
                </div>
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-line">
                  <Link href={`/teacher/uni-courses?yearId=${y._id}`} className="btn btn-sm btn-ghost">
                    📚 รายวิชา
                  </Link>
                  <Link href={`/teacher/students?yearId=${y._id}`} className="btn btn-sm btn-ghost">
                    👥 นักศึกษา
                  </Link>
                </div>
              </div>
            ))}
          </div>
          )}
        </section>
      )}

      {/* === Locked year — selected exists but user has no access === */}
      {!loading && selectedYear && selectedYearExists && !selectedYearAccessible && (
        <section className="surface surface-pad-lg text-center border-2 border-amber-200 bg-amber-50/40">
          <div className="text-5xl mb-3">🔒</div>
          <p className="font-semibold text-amber-800">ไม่มีสิทธิ์เข้าถึงปี {selectedYear}</p>
          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            คุณไม่ได้รับมอบหมายให้ดูแลปีนี้ — ติดต่อ admin หากต้องการสิทธิ์เพิ่มเติม
          </p>
          <button onClick={() => setPickerOpen(true)} className="btn mt-4">
            🔄 เลือกปีอื่น
          </button>
        </section>
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

      {/* === No years exist at all === */}
      {!loading && yearGroups.length === 0 && (
        <section className="surface surface-pad-lg text-center">
          <div className="text-5xl mb-3 opacity-30">📅</div>
          <p className="font-medium">ยังไม่มีปีการศึกษาในระบบ</p>
          <p className="text-sm text-slate-500 mt-1">
            กรุณาติดต่อ admin เพื่อเปิดปีการศึกษา
          </p>
        </section>
      )}

      {/* === Year picker modal === */}
      <YearPickerModal
        open={pickerOpen}
        loading={loading}
        years={yearOptions}
        selectedYear={selectedYear ?? undefined}
        canClose={canClosePicker}
        onSelect={pickYear}
        onClose={() => {
          setPickerOpen(false);
          if (!canClosePicker) {
            router.push('/teacher');
          }
        }}
      />
    </div>
  );
}

export default function Page() {
  return <Suspense><YearsPageInner /></Suspense>;
}
