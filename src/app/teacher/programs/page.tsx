'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import ConfirmDialog, { type ConfirmOptions } from '@/components/ConfirmDialog';
import { invalidateYears } from '@/lib/yearsCache';

type P = { _id: string; nameTh: string; nameEn?: string; faculty: string };
type F = { _id: string; nameTh: string };

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

export default function TeacherProgramsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<P[]>([]);
  const [faculties, setFaculties] = useState<F[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({ nameTh: '', nameEn: '', faculty: '' });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  function askConfirm(opts: ConfirmOptions, action: () => void) {
    setConfirmOpts(opts); setConfirmAction(() => action); setConfirmOpen(true);
  }

  const [editId, setEditId] = useState<string | null>(null);
  const [editF, setEditF] = useState({ nameTh: '', nameEn: '', faculty: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit(p: P) {
    setEditId(p._id);
    setEditF({ nameTh: p.nameTh, nameEn: p.nameEn || '', faculty: p.faculty || '' });
  }
  function cancelEdit() { setEditId(null); }
  async function saveEdit(id: string) {
    if (!editF.nameTh || !editF.faculty) {
      toast({ type: 'error', message: 'กรอกข้อมูลให้ครบ' }); return;
    }
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/programs/${id}`, {
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
      const [ps, fs] = await Promise.all([
        (await fetch('/api/programs')).json(),
        (await fetch('/api/faculties')).json(),
      ]);
      setItems(ps); setFaculties(fs);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nameTh || !f.faculty) {
      toast({ type: 'error', message: 'กรอกข้อมูลให้ครบ' }); return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/programs', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f),
      });
      if (!r.ok) { toast({ type: 'error', message: (await r.json()).error || 'เพิ่มไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: `เพิ่ม ${f.nameTh} แล้ว` });
      invalidateYears();
      setF({ nameTh: '', nameEn: '', faculty: '' });
      setShowForm(false);
      load();
    } finally { setSubmitting(false); }
  }
  function del(id: string, name: string) {
    askConfirm({
      title: `ลบสาขา "${name}"?`,
      message: 'ปี/นักศึกษา/วิชาที่ผูกอยู่จะอ้างอิงไม่ได้',
      confirmText: '🗑 ลบสาขา', cancelText: 'ยกเลิก', variant: 'danger',
    }, async () => {
      const r = await fetch(`/api/programs/${id}`, { method: 'DELETE' });
      if (!r.ok) { toast({ type: 'error', message: r.status === 401 ? 'ไม่มีสิทธิ์ลบ' : 'ลบไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: 'ลบแล้ว' });
      invalidateYears();
      load();
    });
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="page-eyebrow">🎓 สาขาวิชา</div>
            <h1 className="page-title">จัดการสาขาวิชา</h1>
            <p className="text-sm text-slate-600 mt-2 max-w-xl">สาขาที่ใช้กับนักศึกษาและรายวิชา — ต้องผูกกับคณะที่มีอยู่แล้ว</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">สาขาในระบบ</div>
            <div className="text-3xl font-semibold text-brand-600">{loading ? '…' : items.length}</div>
          </div>
        </div>
      </section>

      <section className="surface surface-pad">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="section-title">➕ เพิ่มสาขาวิชาใหม่</h2>
          <button onClick={() => setShowForm(v => !v)} className="btn btn-sm">
            {showForm ? '× ปิด' : '+ ฟอร์ม'}
          </button>
        </div>
        {faculties.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
            <p className="font-medium text-amber-800">⚠️ ยังไม่มีคณะในระบบ</p>
            <p className="text-amber-700 text-xs mt-1">
              ต้องเพิ่มคณะก่อน → <Link href="/teacher/faculties" className="text-brand-600 hover:underline font-medium">ไปหน้าจัดการคณะ</Link>
            </p>
          </div>
        ) : showForm && (
          <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end animate-slideDown">
            <div className="md:col-span-2">
              <label className="label">ชื่อสาขา (TH) *</label>
              <input className="input" value={f.nameTh}
                onChange={e => setF({ ...f, nameTh: e.target.value })}
                placeholder="เช่น เทคโนโลยีฐานข้อมูล" required />
            </div>
            <div>
              <label className="label">ชื่อ (EN)</label>
              <input className="input" value={f.nameEn}
                onChange={e => setF({ ...f, nameEn: e.target.value })} />
            </div>
            <div>
              <label className="label">คณะ *</label>
              <select className="input" value={f.faculty}
                onChange={e => setF({ ...f, faculty: e.target.value })} required>
                <option value="">— เลือก —</option>
                {faculties.map(x => <option key={x._id} value={x.nameTh}>{x.nameTh}</option>)}
              </select>
            </div>
            <button className="btn btn-primary md:col-span-4" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : '💾 บันทึก'}
            </button>
          </form>
        )}
      </section>

      <section className="surface surface-pad">
        <h2 className="section-title mb-3">📋 รายการสาขา <span className="badge">{items.length}</span></h2>
        {loading ? <ListSkeleton /> : items.length === 0 ? (
          <div className="text-center py-10 text-sm text-slate-500">
            <div className="text-4xl mb-2">🎓</div>ยังไม่มีสาขา
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>ชื่อสาขา (TH)</th><th>ชื่อ (EN)</th><th>คณะ</th><th></th></tr>
              </thead>
              <tbody>
                {items.map(p => {
                  const editing = editId === p._id;
                  return (
                    <tr key={p._id} className="hover:bg-soft transition">
                      {editing ? (
                        <>
                          <td><input className="input" value={editF.nameTh} onChange={e => setEditF({ ...editF, nameTh: e.target.value })} autoFocus /></td>
                          <td><input className="input" value={editF.nameEn} onChange={e => setEditF({ ...editF, nameEn: e.target.value })} /></td>
                          <td>
                            <select className="input" value={editF.faculty} onChange={e => setEditF({ ...editF, faculty: e.target.value })}>
                              <option value="">— เลือก —</option>
                              {faculties.map(x => <option key={x._id} value={x.nameTh}>{x.nameTh}</option>)}
                            </select>
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <button onClick={() => saveEdit(p._id)} disabled={savingEdit} className="btn btn-sm btn-primary">{savingEdit ? '...' : '💾 บันทึก'}</button>
                            {' '}<button onClick={cancelEdit} className="btn btn-sm btn-cancel">ยกเลิก</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="font-medium">{p.nameTh}</td>
                          <td className="text-xs text-slate-500">{p.nameEn || '-'}</td>
                          <td className="text-xs">{p.faculty || '-'}</td>
                          <td className="text-right whitespace-nowrap">
                            <button onClick={() => startEdit(p)} className="btn btn-sm">✏️ แก้ไข</button>
                            {' '}<button onClick={() => del(p._id, p.nameTh)} className="btn btn-sm btn-danger">ลบ</button>
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
        open={confirmOpen} options={confirmOpts}
        onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
