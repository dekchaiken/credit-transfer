'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export type YearOption = { year: number; programCount: number };

export default function YearPickerModal({
  open,
  years,
  loading,
  selectedYear,
  canClose,
  onSelect,
  onClose,
}: {
  open: boolean;
  years: YearOption[];
  loading: boolean;
  selectedYear?: number | null;
  canClose: boolean;
  onSelect: (year: number) => void;
  onClose: () => void;
}) {
  // tentative pick — highlighted but not yet confirmed
  const [tentative, setTentative] = useState<number | null>(null);

  // Reset tentative to current selected year whenever modal opens
  useEffect(() => {
    if (open) setTentative(selectedYear ?? null);
  }, [open, selectedYear]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canClose) onClose();
      if (e.key === 'Enter' && tentative != null) onSelect(tentative);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, canClose, onClose, onSelect, tentative]);

  if (!open) return null;

  function confirm() {
    if (tentative == null) return;
    onSelect(tentative);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-slideDown"
      onClick={canClose ? onClose : undefined}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-2xl surface shadow-lift overflow-hidden animate-slideUp max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 sm:px-7 pt-6 pb-4 border-b border-line">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-50 text-brand-600 grid place-items-center text-xl shrink-0">
              📅
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-lg font-semibold text-ink">เลือกปีการศึกษา</h3>
              <p className="mt-1 text-sm text-slate-600">
                คลิกการ์ดเพื่อเลือก แล้วกด <b className="text-brand-700">ตกลง</b> เพื่อเข้าใช้งาน
              </p>
            </div>
            {canClose && (
              <button onClick={onClose}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none shrink-0"
                aria-label="ปิด">✕</button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="surface p-4 animate-pulseSoft">
                  <div className="skeleton h-3 w-16 mb-2" />
                  <div className="skeleton h-7 w-20" />
                </div>
              ))}
            </div>
          ) : years.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-3 opacity-30">📅</div>
              <p className="font-medium">ยังไม่มีปีการศึกษา</p>
              <p className="text-sm text-slate-500 mt-1">กดปุ่มด้านล่างเพื่อเพิ่มปีแรก</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {years.map(y => {
                const isTentative = tentative === y.year;
                const isCurrent = selectedYear === y.year;
                return (
                  <button key={y.year}
                    onClick={() => setTentative(y.year)}
                    onDoubleClick={() => onSelect(y.year)}
                    className={`surface p-4 text-left card-hover transition relative overflow-hidden
                      ${isTentative ? 'ring-2 ring-brand-500 border-brand-300 bg-brand-50/30' : ''}`}>
                    <div className={`absolute top-0 right-0 w-16 h-16 rounded-full opacity-10 -mr-4 -mt-4 ${isTentative ? 'bg-brand-500' : 'bg-slate-400'}`} />
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] font-semibold text-brand-700 uppercase tracking-wide">ปีการศึกษา</div>
                        {isCurrent && (
                          <span className="text-[10px] text-emerald-600 font-semibold">● ปัจจุบัน</span>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-ink mt-1">{y.year}</div>
                      <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                        <span className="badge badge-brand text-[10px] py-0">{y.programCount}</span>
                        <span>สาขา</span>
                      </div>
                      {isTentative && (
                        <div className="text-[10px] text-brand-700 font-semibold mt-2 flex items-center gap-1">
                          <span>✓</span> เลือกไว้
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-7 py-4 bg-soft/60 border-t border-line flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <Link href="/teacher/years/new" className="btn btn-sm">
              ➕ เพิ่มปีใหม่
            </Link>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button onClick={onClose} className="btn">
              ยกเลิก
            </button>
            <button
              onClick={confirm}
              disabled={tentative == null}
              className="btn btn-primary"
            >
              ✓ ตกลง
              {tentative != null && <span className="ml-1 text-xs opacity-80">(ปี {tentative})</span>}
            </button>
          </div>
        </div>
        {!canClose && (
          <div className="px-6 sm:px-7 pb-3 -mt-1 text-xs text-slate-500 text-center bg-soft/60">
            ยังไม่ได้เลือกปี — กด <b>ยกเลิก</b> เพื่อกลับหน้าหลัก หรือเลือกปีแล้วกด <b>ตกลง</b>
          </div>
        )}
      </div>
    </div>
  );
}
