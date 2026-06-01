'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import ConfirmDialog, { type ConfirmOptions } from '@/components/ConfirmDialog';
import YearPickerModal from '@/components/YearPickerModal';
import { useActiveYear } from '@/lib/useActiveYear';

type S = {
  _id: string; studentId: string; fullName: string; level: string;
  yearId: { year: number } | string;
  programId: { nameTh: string; faculty?: string } | string;
  faculty?: string;
  email?: string;
};

function StudentsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="surface p-3 animate-pulseSoft flex gap-4 items-center">
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-4 flex-1" />
          <div className="skeleton h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function StudentsInner() {
  const router = useRouter();
  const { toast } = useToast();

  const {
    loadingYears, yearOptions,
    selectedYear, selectedYearExists,
    yearIdParam, programsInYear,
    selectedProgEntry, selectedProgValid,
    canClosePicker,
    setYear, setParams,
    pickerOpen, openPicker, closePicker,
  } = useActiveYear();

  const [list, setList] = useState<S[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [sheetStatus, setSheetStatus] = useState<Record<string, string>>({});

  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({ studentId: '', fullName: '' });
  const [showAdd, setShowAdd] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  function askConfirm(opts: ConfirmOptions, action: () => void) {
    setConfirmOpts(opts); setConfirmAction(() => action); setConfirmOpen(true);
  }

  // === Load students ===
  async function loadStudents() {
    if (!selectedProgValid) { setList([]); return; }
    setLoadingList(true);
    try {
      const [students, sheets] = await Promise.all([
        fetch(`/api/students?yearId=${yearIdParam}`).then(r => r.json()),
        fetch('/api/sheets').then(r => r.json()),
      ]);
      setList(students);
      const map: Record<string, string> = {};
      if (Array.isArray(sheets)) {
        sheets.forEach((sh: any) => { if (sh.studentId?._id) map[sh.studentId._id] = sh.status; });
      }
      setSheetStatus(map);
    } finally { setLoadingList(false); }
  }
  useEffect(() => { loadStudents(); }, [yearIdParam, selectedProgValid]);

  function pickProgram(id: string) { setParams({ yearId: id }); }

  async function addStudent(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProgValid || !selectedProgEntry) return;
    if (!addForm.studentId || !addForm.fullName) {
      toast({ type: 'error', message: 'กรอกข้อมูลให้ครบ' }); return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/students', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          studentId: addForm.studentId,
          fullName: addForm.fullName,
          programId: selectedProgEntry.programId._id,
          yearId: selectedProgEntry._id,
          level: selectedProgEntry.level || 'เทียบโอน',
        }),
      });
      if (!r.ok) { toast({ type: 'error', message: (await r.json()).error || 'เพิ่มไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: `เพิ่ม ${addForm.fullName} แล้ว (user/password = ${addForm.studentId}/1234)` });
      setAddForm({ studentId: '', fullName: '' });
      loadStudents();
    } finally { setSubmitting(false); }
  }

  async function importCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (!selectedProgValid) { e.target.value = ''; return; }
    setImporting(true);
    try {
      const text = await file.text();
      const r = await fetch(`/api/students/import?yearId=${yearIdParam}`, { method: 'POST', body: text });
      const j = await r.json();
      if (!r.ok) { toast({ type: 'error', message: j.error || 'นำเข้าไม่สำเร็จ' }); return; }
      toast({
        type: 'success',
        message: `นำเข้าปี ${selectedYear}: เพิ่ม ${j.added} · ข้าม ${j.skipped} · สร้าง user ใหม่ ${j.usersCreated || 0}`,
      });
      if (j.errors?.length) toast({ type: 'info', message: j.errors[0] });
      loadStudents();
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  function del(id: string, name: string) {
    askConfirm({
      title: `ลบนักศึกษา "${name}"?`,
      message: 'ใบเทียบโอนของนักศึกษาคนนี้และบัญชี user จะถูกลบไปด้วย\nการกระทำนี้ไม่สามารถย้อนกลับได้',
      confirmText: '🗑 ลบนักศึกษา', cancelText: 'ยกเลิก', variant: 'danger',
    }, async () => {
      const r = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (!r.ok) { toast({ type: 'error', message: 'ลบไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: 'ลบแล้ว' });
      loadStudents();
    });
  }

  const [editId, setEditId] = useState<string | null>(null);
  const [editF, setEditF] = useState({ studentId: '', fullName: '', level: '', email: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit(s: S) {
    setEditId(s._id);
    setEditF({ studentId: s.studentId, fullName: s.fullName, level: s.level || 'เทียบโอน', email: s.email || '' });
  }
  function cancelEdit() { setEditId(null); }
  async function saveEdit(id: string, originalSid: string) {
    if (!editF.studentId || !editF.fullName) {
      toast({ type: 'error', message: 'กรอกข้อมูลให้ครบ' }); return;
    }
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/students/${id}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editF),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ type: 'error', message: j.error || 'แก้ไขไม่สำเร็จ' }); return; }
      const sidChanged = editF.studentId !== originalSid;
      toast({
        type: 'success',
        message: sidChanged
          ? `บันทึกแล้ว — username ของ user ถูกเปลี่ยนเป็น ${editF.studentId}`
          : 'บันทึกแล้ว',
      });
      setEditId(null);
      loadStudents();
    } finally { setSavingEdit(false); }
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* === Hero === */}
      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="page-eyebrow">👥 นักศึกษา</div>
            {selectedYear && selectedYearExists && selectedProgValid ? (
              <>
                <h1 className="page-title flex items-center gap-3 flex-wrap">
                  <span className="text-brand-600">ปี {selectedYear}</span>
                  <span className="text-slate-300">·</span>
                  <span className="truncate">{selectedProgEntry?.programId?.nameTh}</span>
                </h1>
                <p className="text-sm text-slate-600 mt-2">
                  <span className="font-mono text-xs text-brand-700">{selectedProgEntry?.programId?.nameTh}</span>
                  {selectedProgEntry?.programId?.faculty && <> · {selectedProgEntry.programId.faculty}</>}
                  {' · '}ระดับ {selectedProgEntry?.level}
                </p>
              </>
            ) : selectedYear && selectedYearExists ? (
              <>
                <h1 className="page-title">ปีการศึกษา {selectedYear}</h1>
                <p className="text-sm text-slate-600 mt-2">เลือกสาขาเพื่อดูรายชื่อนักศึกษา</p>
              </>
            ) : (
              <>
                <h1 className="page-title">จัดการรายชื่อนักศึกษา</h1>
                <p className="text-sm text-slate-600 mt-2 max-w-xl">
                  เลือกปี → เลือกสาขา → จัดการนักศึกษา
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedYear && selectedYearExists && (
              <button onClick={openPicker} className="btn">🔄 เปลี่ยนปี</button>
            )}
            {selectedProgValid && (
              <button onClick={() => setParams({ yearId: null })} className="btn">↺ เปลี่ยนสาขา</button>
            )}
            {selectedProgValid && (
              <div className="text-right pl-2 border-l border-line">
                <div className="text-xs text-slate-500">นักศึกษา</div>
                <div className="text-2xl font-semibold text-brand-600">{loadingList ? '…' : list.length}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* === Step 2: program picker === */}
      {!loadingYears && selectedYear && selectedYearExists && !selectedProgValid && (
        <section className="surface surface-pad animate-slideUp">
          <h2 className="section-title mb-1">เลือกสาขา</h2>
          <p className="text-xs text-slate-500 mb-4">
            ปีการศึกษา {selectedYear} มี {programsInYear.length} สาขา
          </p>
          {programsInYear.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500">
              <div className="text-4xl mb-2">🎓</div>
              ปีนี้ยังไม่มีสาขา
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {programsInYear.map(y => (
                <button key={y._id} onClick={() => pickProgram(y._id)}
                  className="surface p-4 text-left card-hover transition border-line">
                  <div className="font-medium text-sm mt-1">{y.programId?.nameTh}</div>
                  <div className="text-xs text-slate-500 mt-2">
                    {y.programId?.faculty || '—'} · ระดับ {y.level}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* === Step 3: student management === */}
      {selectedProgValid && (
        <>
          {/* CSV Import */}
          <section className="surface surface-pad animate-slideUp">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="section-title flex items-center gap-2">📥 นำเข้ารายชื่อจาก CSV</h2>
            </div>
            <div className="text-xs text-slate-500 mb-3 space-y-0.5">
              <div>คอลัมน์ที่ต้องมี: <code className="bg-soft px-1.5 py-0.5 rounded">studentId, fullName, programCode</code></div>
              <div>⚠ ปีจะถูกผูกอัตโนมัติเป็น <b>ปี {selectedYear}</b> สาขา <b>{selectedProgEntry?.programId?.nameTh}</b></div>
              <div>⚠ User ของแต่ละ นศ. จะถูกสร้างให้ — username = รหัส นศ., password = <b>1234</b> (บังคับเปลี่ยนรหัสครั้งแรก)</div>
            </div>
            <label className={`block border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition
              ${importing ? 'border-brand-300 bg-brand-50' : 'border-line hover:border-brand-300 hover:bg-soft'}`}>
              <input type="file" accept=".csv" onChange={importCSV} className="hidden" disabled={importing} />
              {importing ? (
                <div className="flex items-center justify-center gap-2 text-sm text-brand-600">
                  <span className="w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                  กำลังนำเข้า...
                </div>
              ) : (
                <div>
                  <div className="text-2xl mb-1">📄</div>
                  <div className="text-sm font-medium">คลิกเพื่อเลือกไฟล์ CSV</div>
                  <div className="text-xs text-slate-500 mt-1">หรือลากไฟล์มาวาง (ดูตัวอย่างที่ <code>sample-data/students-sample.csv</code>)</div>
                </div>
              )}
            </label>
          </section>

          {/* Add single */}
          <section className="surface surface-pad animate-slideUp">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="section-title flex items-center gap-2">➕ เพิ่มรายชื่อทีละคน</h2>
              <button onClick={() => setShowAdd(v => !v)} className="btn btn-sm">
                {showAdd ? '× ปิด' : '+ ฟอร์ม'}
              </button>
            </div>
            {showAdd && (
              <form onSubmit={addStudent} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end animate-slideDown">
                <div>
                  <label className="label">รหัส นศ.</label>
                  <input className="input" value={addForm.studentId}
                    onChange={e => setAddForm({ ...addForm, studentId: e.target.value })} required />
                </div>
                <div className="md:col-span-3">
                  <label className="label">ชื่อ-สกุล</label>
                  <input className="input" value={addForm.fullName}
                    onChange={e => setAddForm({ ...addForm, fullName: e.target.value })} required />
                </div>
                <button className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'กำลังเพิ่ม...' : '💾 บันทึก'}
                </button>
              </form>
            )}
          </section>

          {/* List */}
          <section className="surface surface-pad animate-slideUp">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="section-title flex items-center gap-2">
                👥 นักศึกษาในสาขานี้
                <span className="badge">{list.length} คน</span>
              </h2>
            </div>
            {loadingList ? <StudentsSkeleton /> : list.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                <div className="text-3xl mb-2">📭</div>
                ยังไม่มีนักศึกษาในสาขานี้ — เพิ่มได้จากด้านบน
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-line rounded-lg">
                <table className="table">
                  <thead className="sticky top-0 bg-white z-10 shadow-sm">
                    <tr><th className="whitespace-nowrap">รหัส</th><th className="whitespace-nowrap">ชื่อ-สกุล</th><th className="whitespace-nowrap">คณะ</th><th className="whitespace-nowrap">สาขา</th><th className="whitespace-nowrap">ปีการศึกษา</th><th className="whitespace-nowrap">อีเมล</th><th className="whitespace-nowrap">สถานะใบเทียบ</th><th className="whitespace-nowrap"></th></tr>
                  </thead>
                  <tbody>
                    {list.map(s => {
                      const editing = editId === s._id;
                      const prog = typeof s.programId === 'object' ? s.programId : null;
                      const yr = typeof s.yearId === 'object' ? s.yearId : null;
                      return (
                        <tr key={s._id} className="hover:bg-soft transition">
                          {editing ? (
                            <>
                              <td className="whitespace-nowrap">
                                <input className="input" value={editF.studentId}
                                  onChange={e => setEditF({ ...editF, studentId: e.target.value })} autoFocus />
                              </td>
                              <td className="whitespace-nowrap">
                                <input className="input" value={editF.fullName}
                                  onChange={e => setEditF({ ...editF, fullName: e.target.value })} />
                              </td>
                              <td colSpan={3} className="text-xs text-slate-500 whitespace-nowrap">
                                (คณะ/สาขา/ปี ไม่สามารถแก้ไขได้)
                              </td>
                              <td className="whitespace-nowrap">
                                <input className="input" value={editF.email}
                                  onChange={e => setEditF({ ...editF, email: e.target.value })}
                                  placeholder="email@domain.ac.th" />
                              </td>
                              <td className="text-right whitespace-nowrap" colSpan={2}>
                                <button onClick={() => saveEdit(s._id, s.studentId)} disabled={savingEdit}
                                  className="btn btn-sm btn-primary">
                                  {savingEdit ? '...' : '💾 บันทึก'}
                                </button>
                                {' '}
                                <button onClick={cancelEdit} className="btn btn-sm">ยกเลิก</button>
                                {editF.studentId !== s.studentId && (
                                  <div className="text-[11px] text-amber-600 mt-1">
                                    ⚠ จะเปลี่ยน username ของ user ด้วย
                                  </div>
                                )}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="font-mono text-xs whitespace-nowrap">{s.studentId}</td>
                              <td className="whitespace-nowrap">{s.fullName}</td>
                              <td className="text-xs text-slate-600 whitespace-nowrap">{s.faculty || prog?.faculty || '—'}</td>
                              <td className="text-xs text-slate-600 whitespace-nowrap">{prog?.nameTh || '—'}</td>
                              <td className="text-xs text-slate-600 whitespace-nowrap text-center">{yr?.year || '—'}</td>
                              <td className="text-xs text-slate-600 font-mono whitespace-nowrap">{s.email || '—'}</td>
                              <td className="whitespace-nowrap">{(() => {
                                const st = sheetStatus[s._id];
                                if (!st) return <span className="text-xs text-slate-400">ยังไม่มีใบเทียบ</span>;
                                if (st === 'finalized') return <span className="badge badge-success">✓ อนุมัติแล้ว</span>;
                                if (st === 'pending_review') return <span className="badge badge-warning">⏳ รอพิจารณา</span>;
                                return <span className="badge badge-brand">● ฉบับร่าง</span>;
                              })()}</td>
                              <td className="text-right whitespace-nowrap">
                                <a href={`/teacher/sheets/${s._id}`} className="btn btn-sm btn-primary">📋 ใบเทียบ</a>
                                {' '}
                                <button onClick={() => startEdit(s)} className="btn btn-sm">✏️ แก้ไข</button>
                                {' '}
                                <button onClick={() => del(s._id, s.fullName)} className="btn btn-sm btn-danger">ลบ</button>
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
        </>
      )}

      {/* No years */}
      {!loadingYears && yearOptions.length === 0 && (
        <section className="surface surface-pad-lg text-center">
          <div className="text-5xl mb-3">📅</div>
          <p className="font-medium">ยังไม่มีปีการศึกษา</p>
          <p className="text-sm text-slate-500 mt-1">ไปที่หน้า "จัดการปีการศึกษา" เพื่อเพิ่มก่อน</p>
        </section>
      )}

      {/* Year picker */}
      <YearPickerModal
        open={pickerOpen}
        loading={loadingYears}
        years={yearOptions}
        selectedYear={selectedYear ?? undefined}
        canClose={canClosePicker}
        onSelect={setYear}
        onClose={() => {
          closePicker();
          if (!canClosePicker) router.push('/teacher');
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        options={confirmOpts}
        onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export default function Page() {
  return <Suspense><StudentsInner /></Suspense>;
}
