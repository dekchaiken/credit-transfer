'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

type P = { _id: string; nameTh: string; nameEn: string; faculty: string };

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="surface p-3 animate-pulseSoft flex gap-4 items-center">
          <div className="skeleton h-4 flex-1" />
          <div className="skeleton h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

export default function ProgramsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({ nameTh: '', nameEn: '', faculty: '' });

  async function load() {
    setLoading(true);
    try {
      const ps = await (await fetch('/api/programs')).json();
      setItems(ps);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await fetch('/api/programs', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f),
      });
      const data = await r.json();
      if (!r.ok) { toast({ type: 'error', message: data.error || 'เพิ่มไม่สำเร็จ' }); return; }
      const linked = Number(data.linkedYears || 0);
      toast({
        type: 'success',
        message: linked > 0
          ? `เพิ่ม ${f.nameTh} แล้ว — ลิงก์เข้า ${linked} ปีอัตโนมัติ`
          : `เพิ่ม ${f.nameTh} แล้ว`,
      });
      setF({ nameTh: '', nameEn: '', faculty: '' });
      setShowForm(false);
      load();
    } finally { setSubmitting(false); }
  }
  async function del(id: string, name: string) {
    if (!confirm(`ลบ ${name}?`)) return;
    await fetch(`/api/programs/${id}`, { method: 'DELETE' });
    toast({ type: 'success', message: 'ลบแล้ว' });
    load();
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      <section className="surface p-5 bg-gradient-to-br from-brand-50 to-white animate-slideDown">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-brand-700 uppercase tracking-wide">🎓 สาขาวิชา</div>
            <h1 className="text-xl font-semibold mt-1">จัดการสาขาวิชา</h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted">สาขาในระบบ</div>
            <div className="text-3xl font-semibold text-brand-600">{loading ? '…' : items.length}</div>
          </div>
        </div>
      </section>

      <section className="surface p-5 animate-slideUp">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-semibold flex items-center gap-2">➕ เพิ่มสาขาวิชา</h2>
          <button onClick={() => setShowForm(v => !v)} className="btn btn-sm">
            {showForm ? '× ปิด' : '+ ฟอร์ม'}
          </button>
        </div>
        {showForm && (
          <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end animate-slideDown">
            <div className="md:col-span-2">
              <label className="label">ชื่อ (TH)</label>
              <input className="input" value={f.nameTh} onChange={e => setF({ ...f, nameTh: e.target.value })} required />
            </div>
            <div>
              <label className="label">ชื่อ (EN)</label>
              <input className="input" value={f.nameEn} onChange={e => setF({ ...f, nameEn: e.target.value })} />
            </div>
            <div>
              <label className="label">คณะ</label>
              <input className="input" value={f.faculty} onChange={e => setF({ ...f, faculty: e.target.value })}
                placeholder="เช่น คณะวิศวกรรมศาสตร์" />
            </div>
            <button className="btn btn-primary md:col-span-4" disabled={submitting}>
              {submitting ? '...' : 'บันทึก'}
            </button>
          </form>
        )}
      </section>

      <section className="surface p-5 animate-slideUp">
        <h2 className="font-semibold mb-3 flex items-center gap-2">📋 รายการ <span className="badge">{items.length}</span></h2>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted"><div className="text-3xl mb-2">🎓</div>ยังไม่มีสาขาวิชา</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>ชื่อ TH</th><th>ชื่อ EN</th><th>คณะ</th><th></th></tr></thead>
              <tbody>
                {items.map(p => (
                  <tr key={p._id} className="hover:bg-soft transition">
                    <td>{p.nameTh}</td>
                    <td className="text-xs text-muted">{p.nameEn}</td>
                    <td className="text-xs">{p.faculty}</td>
                    <td className="text-right">
                      <button onClick={() => del(p._id, p.nameTh)} className="btn btn-sm btn-danger">ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
