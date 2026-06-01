'use client';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';

type F = { _id: string; nameTh: string; nameEn: string };

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

export default function FacultiesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<F[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({ nameTh: '', nameEn: '' });

  async function load() {
    setLoading(true);
    try { setItems(await (await fetch('/api/faculties')).json()); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const r = await fetch('/api/faculties', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f),
      });
      if (!r.ok) { toast({ type: 'error', message: (await r.json()).error || 'เพิ่มไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: `เพิ่ม ${f.nameTh} แล้ว` });
      setF({ nameTh: '', nameEn: '' });
      setShowForm(false);
      load();
    } finally { setSubmitting(false); }
  }
  async function del(id: string, name: string) {
    if (!confirm(`ลบ ${name}?`)) return;
    await fetch(`/api/faculties/${id}`, { method: 'DELETE' });
    toast({ type: 'success', message: 'ลบแล้ว' });
    load();
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      <section className="surface p-5 bg-gradient-to-br from-brand-50 to-white animate-slideDown">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-brand-700 uppercase tracking-wide">🏛️ คณะ</div>
            <h1 className="text-xl font-semibold mt-1">จัดการคณะ</h1>
            <p className="text-xs text-muted mt-1">คณะของมหาวิทยาลัย — ใช้ผูกกับสาขาวิชา</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted">คณะในระบบ</div>
            <div className="text-3xl font-semibold text-brand-600">{loading ? '…' : items.length}</div>
          </div>
        </div>
      </section>

      <section className="surface p-5 animate-slideUp">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-semibold flex items-center gap-2">➕ เพิ่มคณะ</h2>
          <button onClick={() => setShowForm(v => !v)} className="btn btn-sm">
            {showForm ? '× ปิด' : '+ ฟอร์ม'}
          </button>
        </div>
        {showForm && (
          <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end animate-slideDown">
            <div>
              <label className="label">ชื่อคณะ (TH)</label>
              <input className="input" value={f.nameTh} onChange={e => setF({ ...f, nameTh: e.target.value })} required />
            </div>
            <div>
              <label className="label">ชื่อคณะ (EN)</label>
              <input className="input" value={f.nameEn} onChange={e => setF({ ...f, nameEn: e.target.value })} />
            </div>
            <button className="btn btn-primary" disabled={submitting}>
              {submitting ? '...' : 'บันทึก'}
            </button>
          </form>
        )}
      </section>

      <section className="surface p-5 animate-slideUp">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          📋 รายการคณะ <span className="badge">{items.length}</span>
        </h2>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted">
            <div className="text-3xl mb-2">🏛️</div>
            ยังไม่มีคณะ
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>ชื่อคณะ (TH)</th><th>ชื่อคณะ (EN)</th><th></th></tr></thead>
              <tbody>
                {items.map(x => (
                  <tr key={x._id} className="hover:bg-soft transition">
                    <td>{x.nameTh}</td>
                    <td className="text-xs text-muted">{x.nameEn}</td>
                    <td className="text-right">
                      <button onClick={() => del(x._id, x.nameTh)} className="btn btn-sm btn-danger">ลบ</button>
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
