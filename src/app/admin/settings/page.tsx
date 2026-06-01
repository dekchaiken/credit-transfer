'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailDomain, setEmailDomain] = useState('mail.rmutk.ac.th');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const r = await fetch('/api/settings');
      const data = await r.json();
      setEmailDomain(data.studentEmailDomain || 'mail.rmutk.ac.th');
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentEmailDomain: emailDomain }),
      });
      if (!r.ok) {
        toast({ type: 'error', message: 'บันทึกไม่สำเร็จ' });
        return;
      }
      toast({ type: 'success', message: 'บันทึกการตั้งค่าแล้ว' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Hero */}
      <section className="page-hero surface-pad-lg">
        <div className="page-eyebrow">⚙️ ตั้งค่าระบบ</div>
        <h1 className="page-title">การตั้งค่า</h1>
        <p className="text-sm text-slate-600 mt-2">
          จัดการการตั้งค่าทั่วไปของระบบเทียบโอนรายวิชา
        </p>
      </section>

      {/* Settings Form */}
      <section className="surface surface-pad animate-slideUp">
        <h2 className="section-title mb-4">📧 อีเมลนักศึกษา</h2>
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        ) : (
          <form onSubmit={saveSettings} className="space-y-4">
            <div>
              <label className="label">
                Email Domain สำหรับนักศึกษา
                <span className="text-xs text-slate-500 ml-2">(ใช้สร้างอีเมลอัตโนมัติ)</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">@</span>
                <input
                  type="text"
                  className="input flex-1"
                  value={emailDomain}
                  onChange={e => setEmailDomain(e.target.value)}
                  placeholder="mail.rmutk.ac.th"
                  required
                />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                ตัวอย่าง: ถ้าตั้งเป็น <code className="bg-soft px-1.5 py-0.5 rounded">mail.rmutk.ac.th</code>
                {' '}นักศึกษารหัส <code className="bg-soft px-1.5 py-0.5 rounded">65123456</code>
                {' '}จะได้อีเมล <code className="bg-soft px-1.5 py-0.5 rounded">65123456@mail.rmutk.ac.th</code>
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'กำลังบันทึก...' : '💾 บันทึกการตั้งค่า'}
              </button>
              <button type="button" onClick={loadSettings} className="btn" disabled={saving}>
                ↺ รีเซ็ต
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Info */}
      <section className="surface surface-pad bg-blue-50 border border-blue-200">
        <div className="flex gap-3">
          <div className="text-2xl">ℹ️</div>
          <div className="text-sm text-slate-700 space-y-1">
            <p className="font-medium">หมายเหตุ</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>การตั้งค่านี้จะมีผลกับนักศึกษาที่เพิ่มใหม่เท่านั้น</li>
              <li>นักศึกษาที่มีอยู่แล้วจะไม่ถูกเปลี่ยนแปลง</li>
              <li>สามารถแก้ไขอีเมลของนักศึกษาแต่ละคนได้ที่หน้า "จัดการนักศึกษา"</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
