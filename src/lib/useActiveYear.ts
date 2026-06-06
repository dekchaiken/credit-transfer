'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { getYears, invalidateYears, subscribeYears, type YearDoc } from '@/lib/yearsCache';

export type YearDocT = YearDoc;

const LS_KEY = 'ct.activeYear';

// Child params that should be cleared whenever the year changes
const DEFAULT_CHILD_PARAMS = ['yearId', 'uniId', 'faculty', 'programId'];

export type UseActiveYearOptions = {
  /** Extra param names to clear when year changes (besides yearId/uniId/faculty/programId) */
  childParams?: string[];
  /** If true (default), when only ?yearId= is present (no ?year=) resolve year from it */
  resolveFromYearId?: boolean;
  /** When true, suppress the auto-opening of the picker — useful while an external resolver runs */
  suppressPicker?: boolean;
};

export function useActiveYear(opts: UseActiveYearOptions = {}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { childParams = [], resolveFromYearId = true, suppressPicker = false } = opts;

  const childKeys = useMemo(() => Array.from(new Set([...DEFAULT_CHILD_PARAMS, ...childParams])), [childParams]);

  const [years, setYears] = useState<YearDoc[]>([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const yearParam = sp.get('year');
  const yearIdParam = sp.get('yearId');
  const selectedYear = yearParam ? Number(yearParam) : null;

  // === Load years (shared cache) ===
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingYears(true);
      try {
        const ys = await getYears();
        if (!cancelled) setYears(ys);
      } finally { if (!cancelled) setLoadingYears(false); }
    };
    load();
    const unsub = subscribeYears(load);
    return () => { cancelled = true; unsub(); };
  }, []);

  // === Derivations ===
  const yearGroups = useMemo(() => {
    const map = new Map<number, YearDoc[]>();
    years.forEach(y => {
      const arr = map.get(y.year) || [];
      arr.push(y);
      map.set(y.year, arr);
    });
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [years]);

  const yearOptions = useMemo(
    () => yearGroups.map(([year, items]) => ({
      year,
      programCount: items.length,
      accessible: items.some(y => y._accessible !== false),
    })),
    [yearGroups],
  );

  const selectedYearExists = selectedYear != null && yearGroups.some(([y]) => y === selectedYear);
  const programsInYear = selectedYear != null ? years.filter(y => y.year === selectedYear) : [];
  const selectedProgEntry = yearIdParam ? years.find(y => y._id === yearIdParam) || null : null;
  const selectedProgValid = !!(selectedProgEntry && selectedProgEntry.year === selectedYear);

  // === setParams helper ===
  const setParams = useCallback((next: Record<string, string | null>) => {
    const params = new URLSearchParams(Array.from(sp.entries()));
    for (const [k, v] of Object.entries(next)) {
      if (v == null) params.delete(k); else params.set(k, v);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [sp, router, pathname]);

  // === Read/write localStorage ===
  const writeLS = useCallback((year: number | null) => {
    try {
      if (typeof window === 'undefined') return;
      if (year == null) localStorage.removeItem(LS_KEY);
      else localStorage.setItem(LS_KEY, String(year));
    } catch {}
  }, []);

  // === Legacy ?yearId= only → resolve year ===
  useEffect(() => {
    if (!resolveFromYearId) return;
    if (loadingYears) return;
    if (yearIdParam && !selectedYear) {
      const y = years.find(yy => yy._id === yearIdParam);
      if (y) {
        const params = new URLSearchParams(Array.from(sp.entries()));
        params.set('year', String(y.year));
        router.replace(`${pathname}?${params.toString()}`);
      }
    }
  }, [resolveFromYearId, loadingYears, yearIdParam, selectedYear, years, sp, router, pathname]);

  // === localStorage fallback: auto-inject ?year= when missing ===
  useEffect(() => {
    if (loadingYears) return;
    if (selectedYear) return; // already in URL
    if (yearIdParam && resolveFromYearId) return; // wait for yearId resolver
    if (typeof window === 'undefined') return;

    const accessibleYears = yearOptions.filter(o => o.accessible).map(o => o.year);

    // 1) ลอง localStorage ก่อน — แต่ต้องเป็นปีที่ user มีสิทธิ์เข้าด้วย
    let saved: number | null = null;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) saved = Number(raw);
    } catch {}
    if (saved && !isNaN(saved) && accessibleYears.includes(saved)) {
      const params = new URLSearchParams(Array.from(sp.entries()));
      params.set('year', String(saved));
      router.replace(`${pathname}?${params.toString()}`);
      return;
    }
    // ถ้า LS เก่าใช้ไม่ได้ — เคลียร์ทิ้ง
    if (saved) { try { localStorage.removeItem(LS_KEY); } catch {} }

    // 2) ถ้ามีปีที่เข้าได้แค่ปีเดียว → auto-pick เลย ไม่ต้องเปิด picker
    if (accessibleYears.length === 1) {
      const only = accessibleYears[0];
      try { localStorage.setItem(LS_KEY, String(only)); } catch {}
      const params = new URLSearchParams(Array.from(sp.entries()));
      params.set('year', String(only));
      router.replace(`${pathname}?${params.toString()}`);
    }
    // 3) > 1 ปี → ปล่อยให้ picker effect ด้านล่างเปิดขึ้นมาให้เลือกเอง
  }, [loadingYears, selectedYear, yearIdParam, resolveFromYearId, yearOptions, sp, router, pathname]);

  // === Auto-open picker when still no year after fallback chance ===
  useEffect(() => {
    if (loadingYears) return;
    if (suppressPicker) return;
    if (yearIdParam && resolveFromYearId && !selectedYear) return; // resolving
    if (!selectedYear || !selectedYearExists) {
      setPickerOpen(true);
    } else {
      setPickerOpen(false);
    }
  }, [loadingYears, selectedYear, selectedYearExists, yearIdParam, resolveFromYearId, suppressPicker]);

  // Keep localStorage in sync when URL year changes & is valid
  useEffect(() => {
    if (loadingYears) return;
    if (selectedYear && selectedYearExists) writeLS(selectedYear);
  }, [loadingYears, selectedYear, selectedYearExists, writeLS]);

  // === setYear: clear child params + write LS ===
  const setYear = useCallback((year: number) => {
    writeLS(year);
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.set('year', String(year));
    childKeys.forEach(k => params.delete(k));
    router.replace(`${pathname}?${params.toString()}`);
    setPickerOpen(false);
  }, [sp, router, pathname, childKeys, writeLS]);

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const canClosePicker = selectedYear != null && selectedYearExists;

  return {
    // raw data
    years,
    loadingYears,
    // derived
    yearGroups,
    yearOptions,
    selectedYear,
    selectedYearExists,
    programsInYear,
    yearIdParam,
    selectedProgEntry,
    selectedProgValid,
    canClosePicker,
    // actions
    setYear,
    setParams,
    pickerOpen,
    openPicker,
    closePicker,
    refreshYears: invalidateYears,
  };
}
