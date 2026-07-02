'use client';
import { useEffect } from 'react';

export type ConfirmVariant = 'primary' | 'success' | 'danger' | 'warning';

export type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  icon?: string;
};

const VARIANT_STYLES: Record<ConfirmVariant, { btn: string; icon: string; iconBg: string }> = {
  primary: { btn: 'btn-primary', icon: 'ℹ️', iconBg: 'bg-brand-50 text-brand-600' },
  success: { btn: 'btn-success', icon: '✓', iconBg: 'bg-emerald-50 text-emerald-600' },
  danger: { btn: 'btn-danger !bg-red-600 !text-white !border-red-600 hover:!bg-red-700', icon: '⚠', iconBg: 'bg-red-50 text-red-600' },
  warning: { btn: 'btn-primary !bg-amber-600 !border-amber-600 hover:!bg-amber-700', icon: '⚠', iconBg: 'bg-amber-50 text-amber-600' },
};

export default function ConfirmDialog({
  open,
  options,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  options: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onCancel, onConfirm]);

  if (!open || !options) return null;

  const variant = options.variant || 'primary';
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-slideDown"
      onClick={onCancel}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md surface shadow-lift overflow-hidden animate-slideUp"
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full grid place-items-center text-xl shrink-0 ${styles.iconBg}`}>
              <span>{options.icon || styles.icon}</span>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-lg font-semibold text-ink">{options.title}</h3>
              {options.message && (
                <div className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {options.message}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 sm:px-7 py-4 bg-soft/60 border-t border-line flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button onClick={onCancel} className="btn btn-cancel">
            {options.cancelText || 'ยกเลิก'}
          </button>
          <button onClick={onConfirm} className={`btn ${styles.btn}`} autoFocus>
            {options.confirmText || 'ยืนยัน'}
          </button>
        </div>
      </div>
    </div>
  );
}
