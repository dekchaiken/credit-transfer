'use client';

export type YearDoc = {
  _id: string;
  year: number;
  level: string;
  programId: { _id: string; code: string; nameTh: string; faculty: string };
  /** Set by /api/years — true if current user has access to this year, false if locked */
  _accessible?: boolean;
};

let cached: Promise<YearDoc[]> | null = null;
const listeners = new Set<() => void>();

export function getYears(force = false): Promise<YearDoc[]> {
  if (force || !cached) {
    cached = fetch('/api/years').then(r => r.json()).catch(() => [] as YearDoc[]);
  }
  return cached;
}

export function invalidateYears() {
  cached = null;
  listeners.forEach(fn => { try { fn(); } catch {} });
}

export function subscribeYears(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
