'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ChangePasswordPage() {
  const { data, update } = useSession();
  const router = useRouter();
  const must = (data?.user as any)?.mustChangePassword;
  const [cur, setCur] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    if (n1 !== n2) { setErr('รหัสใหม่ทั้งสองช่องไม่ตรงกัน'); return; }
    const r = await fetch('/api/users/me/password', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: cur, newPassword: n1 }),
    });
    if (!r.ok) { setErr((await r.json()).error || 'error'); return; }
    setMsg('เปลี่ยนรหัสผ่านแล้ว — กำลังพาเข้าสู่ระบบ...');
    await update({ mustChangePassword: false });
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 card">
        <div>
          <h1 className="text-lg font-semibold">เปลี่ยนรหัสผ่าน</h1>
          {must && <p className="text-xs text-red-600 mt-1">นี่คือการเข้าสู่ระบบครั้งแรก กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน</p>}
        </div>
        <div>
          <label className="label">รหัสผ่านปัจจุบัน</label>
          <input type="password" className="input" value={cur} onChange={e => setCur(e.target.value)} required />
        </div>
        <div>
          <label className="label">รหัสผ่านใหม่ (อย่างน้อย 4 ตัว)</label>
          <input type="password" className="input" value={n1} onChange={e => setN1(e.target.value)} required minLength={4} />
        </div>
        <div>
          <label className="label">ยืนยันรหัสผ่านใหม่</label>
          <input type="password" className="input" value={n2} onChange={e => setN2(e.target.value)} required minLength={4} />
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        {msg && <p className="text-xs text-green-700">{msg}</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1">เปลี่ยนรหัส</button>
          {!must && <Link href="/" className="btn">ยกเลิก</Link>}
        </div>
      </form>
    </div>
  );
}
