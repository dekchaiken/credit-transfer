'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// กฎรหัสผ่าน — ต้องตรงกับ validatePassword ใน src/lib/helpers.ts
const RULES = [
  { key: 'len',     label: 'อย่างน้อย 6 ตัวอักษร',        test: (v: string) => v.length >= 6 },
  { key: 'upper',   label: 'มีตัวพิมพ์ใหญ่ (A-Z)',          test: (v: string) => /[A-Z]/.test(v) },
  { key: 'lower',   label: 'มีตัวพิมพ์เล็ก (a-z)',          test: (v: string) => /[a-z]/.test(v) },
  { key: 'special', label: 'มีอักขระพิเศษ (!@#$%…)',        test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

function RuleItem({ ok, label, dirty }: { ok: boolean; label: string; dirty: boolean }) {
  return (
    <li className={`flex items-center gap-2 text-xs transition-colors ${
      !dirty ? 'text-slate-400' : ok ? 'text-emerald-600' : 'text-red-500'
    }`}>
      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
        !dirty ? 'bg-slate-100 text-slate-400' : ok ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
      }`}>
        {!dirty ? '·' : ok ? '✓' : '✕'}
      </span>
      {label}
    </li>
  );
}

export default function ChangePasswordPage() {
  const { data, update } = useSession();
  const router = useRouter();
  const must = (data?.user as any)?.mustChangePassword;

  const [cur, setCur] = useState('');
  const [n1,  setN1]  = useState('');
  const [n2,  setN2]  = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  // แสดง checklist เมื่อผู้ใช้เริ่มพิมพ์
  const [dirty, setDirty] = useState(false);

  const ruleResults = RULES.map(r => ({ ...r, ok: r.test(n1) }));
  const allRulesPass = ruleResults.every(r => r.ok);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');

    // Client-side guard
    if (!allRulesPass) {
      setDirty(true);
      setErr('รหัสผ่านไม่ตรงตามเงื่อนไขที่กำหนด');
      return;
    }
    if (n1 !== n2) { setErr('รหัสใหม่ทั้งสองช่องไม่ตรงกัน'); return; }

    setLoading(true);
    const r = await fetch('/api/users/me/password', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: cur, newPassword: n1 }),
    });
    setLoading(false);
    if (!r.ok) { setErr((await r.json()).error || 'เกิดข้อผิดพลาด'); return; }
    setMsg('เปลี่ยนรหัสผ่านสำเร็จ — กำลังพาเข้าสู่ระบบ...');
    await update({ mustChangePassword: false });
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-brand-100/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-accent-50/60 blur-3xl" />
      </div>

      <form
        onSubmit={submit}
        className="w-full max-w-sm surface shadow-lift p-7 sm:p-8 space-y-5 animate-slideUp"
      >
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white text-xl shadow-lift mb-3">
            🔑
          </div>
          <h1 className="text-lg font-semibold text-ink">เปลี่ยนรหัสผ่าน</h1>
          {must && (
            <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              🔒 การเข้าสู่ระบบครั้งแรก — กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน
            </p>
          )}
        </div>

        {/* Current password */}
        <div>
          <label className="label">รหัสผ่านปัจจุบัน</label>
          <input
            type="password"
            className="input"
            value={cur}
            onChange={e => setCur(e.target.value)}
            required
            autoFocus
            autoComplete="current-password"
          />
        </div>

        {/* New password + checklist */}
        <div className="space-y-2">
          <label className="label">รหัสผ่านใหม่</label>
          <input
            type="password"
            className={`input transition ${
              dirty && !allRulesPass ? 'border-red-400 focus:ring-red-300' : ''
            }`}
            value={n1}
            onChange={e => { setN1(e.target.value); setDirty(true); }}
            required
            autoComplete="new-password"
          />

          {/* Rule checklist — แสดงทันทีที่เริ่มพิมพ์ */}
          {(dirty || n1.length > 0) && (
            <ul className="bg-soft rounded-xl px-4 py-3 space-y-1.5 border border-line animate-slideDown">
              {ruleResults.map(r => (
                <RuleItem key={r.key} ok={r.ok} label={r.label} dirty={dirty || n1.length > 0} />
              ))}
            </ul>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label className="label">ยืนยันรหัสผ่านใหม่</label>
          <input
            type="password"
            className={`input transition ${
              n2.length > 0 && n1 !== n2 ? 'border-red-400 focus:ring-red-300' : ''
            }`}
            value={n2}
            onChange={e => setN2(e.target.value)}
            required
            autoComplete="new-password"
          />
          {n2.length > 0 && n1 !== n2 && (
            <p className="text-xs text-red-500 mt-1">รหัสผ่านไม่ตรงกัน</p>
          )}
        </div>

        {/* Error / success banners */}
        {err && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 animate-slideDown">
            <span className="shrink-0 mt-0.5">⚠</span>
            <span>{err}</span>
          </div>
        )}
        {msg && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
            <span>✓</span>
            <span>{msg}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary flex-1"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                กำลังบันทึก...
              </span>
            ) : 'บันทึกรหัสผ่านใหม่'}
          </button>
          {!must && (
            <Link href="/" className="btn btn-cancel">
              ยกเลิก
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
