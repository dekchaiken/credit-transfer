'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingOverlay from '@/components/LoadingOverlay';

export default function LoginPage() {
  const router = useRouter();
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setLoading(true);
    const r = await signIn('credentials', { redirect: false, username, password });
    if (r?.error) {
      setLoading(false);
      setErr('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      return;
    }
    setSuccess(true);
    try {
      const session = await fetch('/api/auth/session', { cache: 'no-store' }).then(x => x.json());
      await new Promise(res => setTimeout(res, 1100));
      if (session?.user?.mustChangePassword) {
        router.push('/change-password');
      } else {
        router.push('/');
      }
    } catch {
      await new Promise(res => setTimeout(res, 800));
      router.push('/');
    }
  }

  return (
    <>
      <LoadingOverlay open={success} variant="login" duration={1100} />

      {/* Forgot password modal */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-slideDown"
          onClick={() => setForgotOpen(false)}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-sm surface shadow-lift overflow-hidden animate-slideUp"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-line flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 grid place-items-center text-lg shrink-0">
                🔒
              </div>
              <div className="flex-1 pt-0.5">
                <h3 className="font-semibold text-ink">ลืมรหัสผ่าน?</h3>
                <p className="text-xs text-slate-500 mt-0.5">ไม่สามารถรีเซ็ตรหัสผ่านด้วยตนเองได้</p>
              </div>
              <button
                onClick={() => setForgotOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none shrink-0"
                aria-label="ปิด"
              >✕</button>
            </div>
            {/* Body */}
            <div className="px-6 py-5 text-sm text-slate-700 leading-relaxed">
              หากท่านลืมรหัสผ่าน โปรดติดต่อ
              <ul className="mt-3 space-y-2">
                {[
                  { icon: '🛡️', label: 'ผู้ดูแลระบบ' },
                  { icon: '👨‍🏫', label: 'อาจารย์' },
                  { icon: '📋', label: 'ผู้ที่เกี่ยวข้อง' },
                ].map(item => (
                  <li key={item.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-soft border border-line text-sm font-medium">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Footer */}
            <div className="px-6 pb-5">
              <button
                onClick={() => setForgotOpen(false)}
                className="btn btn-primary w-full"
              >
                รับทราบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login form */}
      <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-brand-100/40 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-accent-50/60 blur-3xl" />
        </div>

        <form onSubmit={submit} className="w-full max-w-md space-y-5 surface p-7 sm:p-8 shadow-lift animate-slideUp">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white text-2xl shadow-lift mb-3">
              📋
            </div>
            <h1 className="text-lg sm:text-xl font-semibold">ระบบใบเทียบโอนรายวิชา</h1>
            <p className="text-xs text-muted mt-1">มหาวิทยาลัยเทคโนโลยีราชมงคลกรุงเทพ</p>
            <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-soft px-2.5 py-0.5 rounded-full border border-line">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              แบบฟอร์ม สวท. 12-05
            </div>
          </div>

          <div>
            <label className="label">ชื่อผู้ใช้ / รหัสนักศึกษา</label>
            <input className="input" value={username} onChange={e => setU(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">รหัสผ่าน</label>
            <input type="password" className="input" value={password} onChange={e => setP(e.target.value)} />
          </div>

          {err && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 animate-slideDown">
              ⚠ {err}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                กำลังตรวจสอบ...
              </span>
            ) : 'เข้าสู่ระบบ'}
          </button>

          <div className="pt-2 border-t border-line space-y-2">
            <p className="text-[11px] text-center text-slate-400">
              เข้าระบบครั้งแรก รหัสผ่านเริ่มต้นคือ{' '}
              <code className="bg-soft px-1.5 py-0.5 rounded text-slate-600">1234</code>
            </p>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-[11px] text-slate-400 hover:text-brand-600 transition underline underline-offset-2"
              >
                ลืมรหัสผ่าน?
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}
