'use client';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import ConfirmDialog, { type ConfirmOptions } from '@/components/ConfirmDialog';

type F = { _id: string; nameTh: string; nameEn?: string };
type P = { _id: string; faculty: string };

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

export default function TeacherFacultiesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<F[]>([]);
  const [progs, setProgs] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({ nameTh: '', nameEn: '' });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  function askConfirm(opts: ConfirmOptions, action: () => void) {
    setConfirmOpts(opts); setConfirmAction(() => action); setConfirmOpen(true);
  }

  const [editId, setEditId] = useState<string | null>(null);
  const [editF, setEditF] = useState({ nameTh: '', nameEn: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit(x: F) {
    setEditId(x._id);
    setEditF({ nameTh: x.nameTh, nameEn: x.nameEn || '' });
  }
  function cancelEdit() { setEditId(null); }

  async function saveEdit(id: string) {
    if (!editF.nameTh) { toast({ type: 'error', message: 'กรอกชื่อคณะ' }); return; }
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/faculties/${id}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editF),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ type: 'error', message: j.error || 'แก้ไขไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: 'บันทึกแล้ว' });
      setEditId(null);
      load();
    } finally { setSavingEdit(false); }
  }

  async function load() {
    setLoading(true);
    try {
      const [fs, ps] = await Promise.all([
        (await fetch('/api/faculties')).json(),
        (await fetch('/api/programs')).json(),
      ]);
      setItems(fs); setProgs(ps);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const usageByFaculty = useMemo(() => {
    const m = new Map<string, number>();
    const norm = (s: string) => (s || '').normalize('NFC').trim();
    progs.forEach(p => {
      const k = norm(p.faculty);
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }, [progs]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nameTh) { toast({ type: 'error', message: 'กรอกชื่อคณะ' }); return; }
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
  function del(id: string, name: string) {
    const used = usageByFaculty.get((name || '').normalize('NFC').trim()) || 0;
    askConfirm({
      title: `ลบคณะ "${name}"?`,
      message: used > 0
        ? `คณะนี้มี ${used} สาขาผูกอยู่ — สาขาจะอ้างอิงคณะที่ไม่มีอยู่`
        : 'การกระทำนี้ไม่สามารถย้อนกลับได้',
      confirmText: '🗑 ลบคณะ', cancelText: 'ยกเลิก', variant: 'danger',
    }, async () => {
      const r = await fetch(`/api/faculties/${id}`, { method: 'DELETE' });
      if (!r.ok) { toast({ type: 'error', message: 'ลบไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: 'ลบแล้ว' });
      load();
    });
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Hero */}
      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="page-eyebrow">🏛️ คณะ</div>
            <h1 className="page-title">จัดการคณะ</h1>
            <p className="text-sm text-slate-600 mt-2 max-w-xl">
              คณะของมหาวิทยาลัย — ใช้ผูกกับสาขาวิชาในระบบ
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">คณะในระบบ</div>
            <div className="text-3xl font-semibold text-brand-600">{loading ? '…' : items.length}</div>
          </div>
        </div>
      </section>

      {/* Add form */}
      <section className="surface surface-pad">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="section-title">➕ เพิ่มคณะใหม่</h2>
          <button onClick={() => setShowForm(v => !v)} className="btn btn-sm">
            {showForm ? '× ปิด' : '+ ฟอร์ม'}
          </button>
        </div>
        {showForm && (
          <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end animate-slideDown">
            <div className="md:col-span-1">
              <label className="label">ชื่อคณะ (TH) *</label>
              <input className="input" value={f.nameTh}
                onChange={e => setF({ ...f, nameTh: e.target.value })}
                placeholder="เช่น บริหารธุรกิจ" required />
            </div>
            <div className="md:col-span-1">
              <label className="label">ชื่อคณะ (EN)</label>
              <input className="input" value={f.nameEn}
                onChange={e => setF({ ...f, nameEn: e.target.value })}
                placeholder="เช่น Business Administration" />
            </div>
            <button className="btn btn-primary" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : '💾 บันทึก'}
            </button>
          </form>
        )}
      </section>

      {/* List */}
      <section className="surface surface-pad">
        <h2 className="section-title mb-3">
          📋 รายการคณะ <span className="badge">{items.length}</span>
        </h2>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-500">
            <div className="text-4xl mb-2">🏛️</div>
            ยังไม่มีคณะ — เพิ่มได้จากด้านบน
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>ชื่อคณะ (TH)</th>
                  <th>ชื่อคณะ (EN)</th>
                  <th>การใช้งาน</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(x => {
                  const used = usageByFaculty.get((x.nameTh || '').normalize('NFC').trim()) || 0;
                  const editing = editId === x._id;
                  return (
                    <tr key={x._id} className="hover:bg-soft transition">
                      {editing ? (
                        <>
                          <td>
                            <input className="input" value={editF.nameTh}
                              onChange={e => setEditF({ ...editF, nameTh: e.target.value })} autoFocus />
                          </td>
                          <td>
                            <input className="input" value={editF.nameEn}
                              onChange={e => setEditF({ ...editF, nameEn: e.target.value })} />
                          </td>
                          <td>
                            {used > 0 && (
                              <span className="text-[11px] text-amber-600">
                                ⚠ จะ rename ใน {used} สาขาด้วย
                              </span>
                            )}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <button onClick={() => saveEdit(x._id)} disabled={savingEdit}
                              className="btn btn-sm btn-primary">
                              {savingEdit ? '...' : '💾 บันทึก'}
                            </button>
                            {' '}
                            <button onClick={cancelEdit} className="btn btn-sm">ยกเลิก</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="font-medium">{x.nameTh}</td>
                          <td className="text-xs text-slate-500">{x.nameEn || '-'}</td>
                          <td>
                            {used > 0
                              ? <span className="badge badge-brand text-xs">{used} สาขา</span>
                              : <span className="text-xs text-slate-400">ยังไม่ถูกใช้</span>}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <button onClick={() => startEdit(x)} className="btn btn-sm">✏️ แก้ไข</button>
                            {' '}
                            <button onClick={() => del(x._id, x.nameTh)} className="btn btn-sm btn-danger">ลบ</button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        options={confirmOpts}
        onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
