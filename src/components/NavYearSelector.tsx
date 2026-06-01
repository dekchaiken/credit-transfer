'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getYears, subscribeYears, type YearDoc } from '@/lib/yearsCache';

const LS_KEY = 'ct.activeYear';
const CHILD_PARAMS = ['yearId', 'uniId', 'faculty', 'programId'];

function readActiveYear(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return isNaN(n) ? null : n;
  } catch { return null; }
}

export default function NavYearSelector({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [years, setYears] = useState<YearDoc[]>([]);
  const [open, setOpen] = useState(false);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  // Only show selector on teacher pages
  const showOnPage = pathname?.startsWith('/teacher');

  // Load years (shared cache)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const ys = await getYears();
      if (!cancelled) setYears(ys);
    };
    load();
    const unsub = subscribeYears(load);
    return () => { cancelled = true; unsub(); };
  }, []);

  // Sync activeYear: URL ?year= takes precedence, else localStorage
  useEffect(() => {
    const urlYear = sp.get('year');
    if (urlYear) {
      const n = Number(urlYear);
      if (!isNaN(n)) {
        setActiveYear(n);
        try { localStorage.setItem(LS_KEY, String(n)); } catch {}
        return;
      }
    }
    setActiveYear(readActiveYear());
  }, [sp]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Close on path change
  useEffect(() => { setOpen(false); }, [pathname]);

  if (!showOnPage) return null;

  // Unique years sorted desc with program count
  const yearOptions = (() => {
    const map = new Map<number, number>();
    years.forEach(y => map.set(y.year, (map.get(y.year) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  })();

  function pickYear(y: number) {
    try { localStorage.setItem(LS_KEY, String(y)); } catch {}
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.set('year', String(y));
    CHILD_PARAMS.forEach(k => params.delete(k));
    router.replace(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  const label = activeYear ? `ปี ${activeYear}` : 'เลือกปี';

  if (variant === 'mobile') {
    return (
      <div className="px-3 pt-2 pb-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">📅 ปีการศึกษา</div>
        <div className="grid grid-cols-3 gap-1.5">
          {yearOptions.length === 0 ? (
            <div className="col-span-3 text-xs text-slate-400 py-2">— ยังไม่มีปี —</div>
          ) : yearOptions.map(([y, count]) => (
            <button key={y} onClick={() => pickYear(y)}
              className={`px-2 py-1.5 rounded-lg text-sm font-medium border transition
                ${activeYear === y
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate-700 border-line hover:bg-soft'}`}>
              {y}
              <span className={`block text-[10px] ${activeYear === y ? 'text-brand-50' : 'text-slate-400'}`}>
                {count} สาขา
              </span>
            </button>
          ))}
        </div>
        <Link href="/teacher/years/new"
          className="block mt-2 text-center text-xs text-brand-700 hover:underline">
          + เพิ่มปีใหม่
        </Link>
      </div>
    );
  }

  // Desktop dropdown
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`btn btn-sm ${activeYear ? '' : 'btn-ghost'} inline-flex items-center gap-1.5`}
        title="เปลี่ยนปีการศึกษา"
      >
        <span>📅</span>
        <span className="font-medium">{label}</span>
        <span className={`text-[9px] transition ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 min-w-[180px] surface shadow-lift border border-line py-1 z-40 animate-slideDown">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
            ปีการศึกษา
          </div>
          {yearOptions.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500">ยังไม่มีปี</div>
          ) : yearOptions.map(([y, count]) => (
            <button key={y} onClick={() => pickYear(y)}
              className={`w-full text-left px-3 py-2 text-sm transition flex items-center justify-between gap-3
                ${activeYear === y ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-700 hover:bg-soft'}`}>
              <span className="flex items-center gap-2">
                {activeYear === y && <span className="text-brand-600">✓</span>}
                <span>ปี {y}</span>
              </span>
              <span className="text-[10px] text-slate-400">{count} สาขา</span>
            </button>
          ))}
          <div className="border-t border-line my-1" />
          <Link href="/teacher/years/new" onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-brand-700 hover:bg-brand-50">
            + เพิ่มปีใหม่
          </Link>
          <Link href="/teacher/years" onClick={() => setOpen(false)}
            className="block px-3 py-2 text-xs text-slate-600 hover:bg-soft">
            จัดการปีทั้งหมด
          </Link>
        </div>
      )}
    </div>
  );
}
