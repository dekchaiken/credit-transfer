'use client';
import { useEffect, useState } from 'react';

type Variant = 'login' | 'logout';

export default function LoadingOverlay({
  open,
  variant = 'login',
  duration = 1200,
}: {
  open: boolean;
  variant?: Variant;
  duration?: number;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) { setProgress(0); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - start;
      // ease-out curve so the bar slows toward the end (feels more natural than linear)
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 2);
      const pct = Math.min(99, eased * 100);
      setProgress(pct);
      if (elapsed < duration) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, duration]);

  if (!open) return null;

  const isLogin = variant === 'login';
  const title = isLogin ? 'กำลังเข้าสู่ระบบ' : 'กำลังออกจากระบบ';
  const subtitle = isLogin
    ? 'กรุณารอสักครู่ — กำลังโหลดข้อมูลผู้ใช้'
    : 'กำลังปิดเซสชันและพากลับไปหน้าเข้าสู่ระบบ';
  const icon = isLogin ? '🔓' : '👋';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-fadeIn">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-md" />
      <div className="absolute inset-0 -z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-brand-100/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-accent-50/60 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm text-center space-y-5 animate-slideUp">
        {/* Logo / icon */}
        <div className="relative w-20 h-20 mx-auto">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lift" />
          <div className="absolute inset-0 grid place-items-center text-white text-3xl animate-pulseSoft">
            {icon}
          </div>
          {/* spinning ring */}
          <div className="absolute -inset-2 rounded-3xl border-2 border-transparent border-t-brand-400 border-r-brand-300 animate-spin" />
        </div>

        {/* Text */}
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <p className="text-xs text-slate-600 mt-1">{subtitle}</p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden border border-line">
            <div
              className="h-full rounded-full relative overflow-hidden"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #1e40af 0%, #1e3a8a 50%, #172554 100%)',
                willChange: 'width',
              }}
            >
              {/* shimmer sweep */}
              <div
                className="absolute inset-0 animate-shimmer"
                style={{
                  backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
                  backgroundSize: '200px 100%',
                  backgroundRepeat: 'no-repeat',
                }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
            <span>{Math.round(progress)}%</span>
            <span>{progress < 99 ? 'กำลังโหลด...' : 'เกือบเสร็จแล้ว'}</span>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400">
          {[20, 50, 80].map(t => (
            <span key={t} className={`flex items-center gap-1 ${progress >= t ? 'text-brand-600' : ''}`}>
              <span className={`w-1.5 h-1.5 rounded-full transition ${progress >= t ? 'bg-brand-500' : 'bg-slate-300'}`} />
              {t === 20 ? 'ตรวจสอบสิทธิ์' : t === 50 ? 'โหลดข้อมูล' : 'พร้อมใช้งาน'}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
