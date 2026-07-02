'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { useActiveYear } from '@/lib/useActiveYear';
import { useSession } from 'next-auth/react';
import YearPickerModal from '@/components/YearPickerModal';
import { useToast } from '@/components/Toast';
import ConfirmDialog, { type ConfirmOptions } from '@/components/ConfirmDialog';

type C = {
  _id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  credits: number;
  creditHours: string;
  order?: number;
};

type Ext = { code: string; nameTh: string; credits: string };
type G = { _id: string; uniCourseId: string; groupNo: number; externalCourses: Ext[]; requireAll?: boolean };

function CoursesSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="surface p-3 animate-pulseSoft flex gap-4 items-center">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-4 flex-1" />
          <div className="skeleton h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function GroupsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="surface p-4 animate-pulseSoft">
          <div className="skeleton h-4 w-32 mb-3" />
          <div className="space-y-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function UniCoursesPage() {
  return <Suspense><UniCoursesInner /></Suspense>;
}

function UniCoursesInner() {
  const {
    loadingYears, yearOptions,
    selectedYear, selectedYearExists,
    yearIdParam, programsInYear,
    selectedProgValid,
    setYear, setParams,
    pickerOpen, openPicker, closePicker,
    canClosePicker,
  } = useActiveYear();
  const yearId = yearIdParam;
  const { toast } = useToast();

  const { data: sessionData } = useSession();
  const isReadOnly = (sessionData?.user as any)?.role === 'teacher';

  const [courses, setCourses] = useState<C[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({ code: '', nameTh: '', nameEn: '', creditHours: '', credits: 3 });

  const [editId, setEditId] = useState<string | null>(null);
  const [editF, setEditF] = useState({ code: '', nameTh: '', nameEn: '', creditHours: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const [usageCourse, setUsageCourse] = useState<C | null>(null); // kept for TS compat, unused
  void setUsageCourse; void usageCourse;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  function askConfirm(opts: ConfirmOptions, action: () => void) {
    setConfirmOpts(opts); setConfirmAction(() => action); setConfirmOpen(true);
  }

  // === Right panel: selected course + transfer groups ===
  const [selectedCourse, setSelectedCourse] = useState<C | null>(null);
  const [groups, setGroups] = useState<G[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState<{ groupNo: number; externalCourses: Ext[]; requireAll: boolean }>({
    groupNo: 1, externalCourses: [{ code: '', nameTh: '', credits: '3' }], requireAll: false,
  });

  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editGroupF, setEditGroupF] = useState<{ groupNo: number; externalCourses: Ext[]; requireAll: boolean }>({
    groupNo: 1, externalCourses: [], requireAll: false,
  });
  const [savingEditGroup, setSavingEditGroup] = useState(false);

  async function load() {
    if (!yearId || !selectedProgValid) { setCourses([]); setLoading(false); return; }
    setLoading(true);
    try {
      setCourses(await (await fetch(`/api/uni-courses?yearId=${yearId}`)).json());
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [yearId, selectedProgValid]);

  // === Load groups when course is selected ===
  async function loadGroups(courseId: string) {
    setLoadingGroups(true);
    try {
      const gs: G[] = await (await fetch(`/api/transfer-groups?uniCourseId=${courseId}`)).json();
      setGroups(gs);
      setNewGroup(n => ({ ...n, groupNo: gs.length + 1 }));
    } finally { setLoadingGroups(false); }
  }

  function selectCourse(c: C) {
    setSelectedCourse(c);
    setEditGroupId(null);
    setShowGroupForm(false);
    loadGroups(c._id);
  }

  const filtered = useMemo(() => {
    const q = query.normalize('NFC').trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(c =>
      c.code.toLowerCase().includes(q) ||
      (c.nameTh || '').toLowerCase().includes(q) ||
      (c.nameEn || '').toLowerCase().includes(q),
    );
  }, [courses, query]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.code || !f.nameTh) {
      toast({ type: 'error', message: 'กรอกรหัส/ชื่อให้ครบ' }); return;
    }
    // Validate: รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)
    if (!/^[\d\s-]+$/.test(f.code)) {
      toast({ type: 'error', message: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }); return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/uni-courses', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...f, credits: Number(f.credits), yearId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast({ type: 'error', message: j.error || 'เพิ่มไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: `เพิ่ม ${f.code} แล้ว` });
      setF({ code: '', nameTh: '', nameEn: '', creditHours: '', credits: 3 });
      setShowForm(false);
      await load();
    } finally { setSubmitting(false); }
  }

  function startEdit(c: C) {
    setEditId(c._id);
    setEditF({ code: c.code, nameTh: c.nameTh, nameEn: c.nameEn || '', creditHours: c.creditHours || '' });
  }
  function cancelEdit() { setEditId(null); }
  async function saveEdit(id: string) {
    if (!editF.code || !editF.nameTh) { toast({ type: 'error', message: 'กรอกรหัส/ชื่อให้ครบ' }); return; }
    // Validate: รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)
    if (!/^[\d\s-]+$/.test(editF.code)) {
      toast({ type: 'error', message: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }); return;
    }
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/uni-courses/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(editF),
      });
      if (!r.ok) { toast({ type: 'error', message: 'แก้ไขไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: 'บันทึกแล้ว' });
      setEditId(null);
      await load();
    } finally { setSavingEdit(false); }
  }

  function del(c: C) {
    askConfirm({
      title: `ลบรายวิชา "${c.code}" ?`,
      message: `จะลบวิชานี้และกลุ่มเทียบโอนทั้งหมดของวิชานี้\nการกระทำนี้ไม่สามารถย้อนกลับได้`,
      confirmText: '🗑 ลบรายวิชา', cancelText: 'ยกเลิก', variant: 'danger',
    }, async () => {
      const r = await fetch(`/api/uni-courses/${c._id}`, { method: 'DELETE' });
      if (!r.ok) { toast({ type: 'error', message: 'ลบไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: 'ลบแล้ว' });
      if (selectedCourse?._id === c._id) {
        setSelectedCourse(null);
        setGroups([]);
      }
      load();
    });
  }

  // === Transfer group management functions ===
  function setExt(i: number, k: keyof Ext, v: string) {
    const ex = [...newGroup.externalCourses]; (ex[i] as any)[k] = v;
    setNewGroup({ ...newGroup, externalCourses: ex });
  }
  function addExtRow() { setNewGroup({ ...newGroup, externalCourses: [...newGroup.externalCourses, { code: '', nameTh: '', credits: '3' }] }); }
  function rmExtRow(i: number) { setNewGroup({ ...newGroup, externalCourses: newGroup.externalCourses.filter((_, j) => j !== i) }); }

  async function saveGroup() {
    if (!selectedCourse) return;
    if (newGroup.externalCourses.some(ex => !ex.code || !ex.nameTh)) {
      toast({ type: 'error', message: 'กรอกรหัส/ชื่อวิชาให้ครบทุกแถว' }); return;
    }
    const invalidCodes = newGroup.externalCourses.filter(ex => !/^[\d\s-]+$/.test(ex.code));
    if (invalidCodes.length > 0) {
      toast({ type: 'error', message: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }); return;
    }
    setSubmittingGroup(true);
    try {
      const r = await fetch('/api/transfer-groups', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uniCourseId: selectedCourse._id, groupNo: newGroup.groupNo, externalCourses: newGroup.externalCourses, requireAll: newGroup.requireAll }),
      });
      if (!r.ok) { toast({ type: 'error', message: (await r.json()).error || 'บันทึกไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: `เพิ่มกลุ่ม ${newGroup.groupNo} แล้ว` });
      setNewGroup({ groupNo: newGroup.groupNo + 1, externalCourses: [{ code: '', nameTh: '', credits: '3' }], requireAll: false });
      setShowGroupForm(false);
      loadGroups(selectedCourse._id);
    } finally { setSubmittingGroup(false); }
  }

  function delGroup(id: string, no: number) {
    askConfirm({
      title: `ลบกลุ่มเทียบ #${no}?`,
      message: 'การกระทำนี้ไม่สามารถย้อนกลับได้',
      confirmText: '🗑 ลบกลุ่ม', cancelText: 'ยกเลิก', variant: 'danger',
    }, async () => {
      const r = await fetch(`/api/transfer-groups/${id}`, { method: 'DELETE' });
      if (!r.ok) { toast({ type: 'error', message: 'ลบไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: 'ลบแล้ว' });
      if (selectedCourse) loadGroups(selectedCourse._id);
    });
  }

  function startEditGroup(g: G) {
    setEditGroupId(g._id);
    setEditGroupF({
      groupNo: g.groupNo,
      externalCourses: g.externalCourses.map(ex => ({ ...ex })),
      requireAll: !!g.requireAll,
    });
  }
  function cancelEditGroup() { setEditGroupId(null); }
  function setEditExt(i: number, k: keyof Ext, v: string) {
    const ex = [...editGroupF.externalCourses]; (ex[i] as any)[k] = v;
    setEditGroupF({ ...editGroupF, externalCourses: ex });
  }
  function addEditExtRow() {
    setEditGroupF({ ...editGroupF, externalCourses: [...editGroupF.externalCourses, { code: '', nameTh: '', credits: '3' }] });
  }
  function rmEditExtRow(i: number) {
    setEditGroupF({ ...editGroupF, externalCourses: editGroupF.externalCourses.filter((_, j) => j !== i) });
  }
  async function saveEditGroup(id: string) {
    if (editGroupF.externalCourses.length === 0) {
      toast({ type: 'error', message: 'ต้องมีอย่างน้อย 1 วิชา' }); return;
    }
    if (editGroupF.externalCourses.some(ex => !ex.code || !ex.nameTh)) {
      toast({ type: 'error', message: 'กรอกรหัส/ชื่อวิชาให้ครบทุกแถว' }); return;
    }
    const invalidCodes = editGroupF.externalCourses.filter(ex => !/^[\d\s-]+$/.test(ex.code));
    if (invalidCodes.length > 0) {
      toast({ type: 'error', message: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }); return;
    }
    setSavingEditGroup(true);
    try {
      const r = await fetch(`/api/transfer-groups/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groupNo: Number(editGroupF.groupNo), externalCourses: editGroupF.externalCourses, requireAll: editGroupF.requireAll }),
      });
      if (!r.ok) { toast({ type: 'error', message: 'แก้ไขไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: 'บันทึกแล้ว' });
      setEditGroupId(null);
      if (selectedCourse) loadGroups(selectedCourse._id);
    } finally { setSavingEditGroup(false); }
  }

  const totalOfferings = 0; void totalOfferings;

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* === Hero === */}
      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="page-eyebrow">📚 จัดการรายวิชา</div>
            <h1 className="page-title">รายวิชาของสาขา</h1>
            {selectedProgValid && (
              <p className="text-sm text-slate-600 mt-2">
                {(programsInYear.find(p => p._id === yearId) as any)?.programId?.nameTh ?? ''}
                {' '}· ปี {selectedYear}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {selectedProgValid && (
              <div className="text-right">
                <div className="text-xs text-slate-500">วิชาทั้งหมด</div>
                <div className="text-2xl font-semibold text-brand-600">{loading ? '…' : courses.length}</div>
              </div>
            )}
            <button onClick={openPicker} className="btn btn-sm">🔄 เปลี่ยนปี</button>
          </div>
        </div>
      </section>

      {/* === Program picker (year selected, but no program chosen yet) === */}
      {selectedYearExists && !selectedProgValid && (
        <section className="surface surface-pad animate-slideUp">
          <h2 className="section-title mb-3">เลือกสาขาในปี {selectedYear}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {programsInYear.filter(p => (p as any).programId).map(p => (
              <button key={p._id} onClick={() => setParams({ yearId: p._id })}
                className="surface p-4 text-left border border-line hover:border-brand-400 transition rounded-lg">
                <div className="font-medium text-sm">{(p as any).programId?.nameTh}</div>
                <div className="text-xs text-slate-500 mt-1">{(p as any).programId?.faculty || ''} · ระดับ {(p as any).level}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* === Split view: Left = courses list, Right = transfer groups === */}
      {selectedProgValid && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT PANEL: Courses */}
        <div className="space-y-6">
          {/* === Add form — committee/admin only === */}
          {!isReadOnly && (
          <section className="surface surface-pad animate-slideUp">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h2 className="section-title">➕ เพิ่มรายวิชาใหม่</h2>
              <button onClick={() => setShowForm(v => !v)} className="btn btn-sm">
                {showForm ? '× ปิด' : '+ ฟอร์ม'}
              </button>
            </div>
            {showForm && (
              <form onSubmit={add} className="space-y-3 animate-slideDown">
                <div>
                  <label className="label">รหัส</label>
                  <input className="input" value={f.code}
                    onChange={e => setF({ ...f, code: e.target.value })} required />
                </div>
                <div>
                  <label className="label">ชื่อ TH</label>
                  <input className="input" value={f.nameTh}
                    onChange={e => setF({ ...f, nameTh: e.target.value })} required />
                </div>
                <div>
                  <label className="label">ชื่อ EN</label>
                  <input className="input" value={f.nameEn}
                    onChange={e => setF({ ...f, nameEn: e.target.value })} />
                </div>
                <div>
                  <label className="label">หน่วยกิต (เช่น 3(0-6-3))</label>
                  <input className="input" value={f.creditHours}
                    onChange={e => setF({ ...f, creditHours: e.target.value })} />
                </div>
                <button className="btn btn-primary w-full" disabled={submitting}>
                  {submitting ? 'กำลังเพิ่ม...' : 'บันทึก'}
                </button>
              </form>
            )}
          </section>
          )} {/* end !isReadOnly add section */}
          <section className="surface surface-pad animate-slideUp">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="section-title flex items-center gap-2">
                📋 รายวิชาในคลัง
                <span className="badge">{filtered.length}{query && ` / ${courses.length}`}</span>
              </h2>
              <div className="flex-1 max-w-xs">
                <input className="input" placeholder="🔍 ค้นหา..."
                  value={query} onChange={e => setQuery(e.target.value)} />
              </div>
            </div>

            {loading ? <CoursesSkeleton /> : filtered.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500">
                <div className="text-3xl mb-2">📚</div>
                {query ? 'ไม่พบรายวิชาที่ตรงกับคำค้นหา' : 'ยังไม่มีรายวิชา — เพิ่มได้จากด้านบน'}
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filtered.map(c => {
                  const editing = !isReadOnly && editId === c._id;
                  const isSelected = selectedCourse?._id === c._id;
                  return (
                    <div
                      key={c._id}
                      className={`surface p-3 border transition cursor-pointer ${
                        isSelected ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-brand-300'
                      }`}
                      onClick={() => !editing && selectCourse(c)}
                    >
                      {editing ? (
                        <div onClick={e => e.stopPropagation()}>
                          <div className="space-y-2">
                            <input className="input" value={editF.code}
                              onChange={e => setEditF({ ...editF, code: e.target.value })} autoFocus />
                            <input className="input" value={editF.nameTh}
                              onChange={e => setEditF({ ...editF, nameTh: e.target.value })} placeholder="TH" />
                            <input className="input" value={editF.nameEn}
                              onChange={e => setEditF({ ...editF, nameEn: e.target.value })} placeholder="EN" />
                            <input className="input" value={editF.creditHours}
                              onChange={e => setEditF({ ...editF, creditHours: e.target.value })} placeholder="หน่วยกิต" />
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => saveEdit(c._id)} disabled={savingEdit}
                              className="btn btn-sm btn-primary flex-1">
                              {savingEdit ? '...' : '💾 บันทึก'}
                            </button>
                            <button onClick={cancelEdit} className="btn btn-sm btn-cancel">ยกเลิก</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-sm text-brand-700 font-bold mb-1">{c.code}</div>
                              <div className="text-sm font-medium text-slate-800 leading-snug">{c.nameTh}</div>
                              {c.nameEn && <div className="text-xs text-slate-500 mt-1 leading-snug">{c.nameEn}</div>}
                              <div className="flex items-center gap-3 mt-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-500">หน่วยกิต:</span>
                                  <span className="font-mono text-xs font-semibold text-slate-700">
                                    {c.creditHours || c.credits}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1.5 flex-wrap pt-2 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                            {!isReadOnly && (
                              <>
                                <button onClick={() => startEdit(c)} className="btn btn-sm text-xs">✏️ แก้ไข</button>
                                <button onClick={() => del(c)} className="btn btn-sm btn-danger text-xs">ลบ</button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT PANEL: Transfer Groups */}
        <div className="space-y-6">
          {!selectedCourse ? (
            <section className="surface surface-pad-lg text-center">
              <div className="text-5xl mb-3">📦</div>
              <p className="font-medium">เลือกวิชาจากฝั่งซ้าย</p>
              <p className="text-sm text-slate-500 mt-1">เพื่อจัดการกลุ่มเทียบโอน</p>
            </section>
          ) : (
            <>
              {/* Selected course header */}
              <section className="surface surface-pad">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-500 mb-1">📦 กลุ่มเทียบโอนของ</div>
                    <div className="font-mono text-sm text-brand-700 font-semibold">{selectedCourse.code}</div>
                    <div className="font-medium">{selectedCourse.nameTh}</div>
                    {selectedCourse.nameEn && (
                      <div className="text-xs text-slate-500 mt-1">{selectedCourse.nameEn}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">กลุ่มเทียบ</div>
                    <div className="text-2xl font-semibold text-brand-600">{loadingGroups ? '…' : groups.length}</div>
                  </div>
                </div>
              </section>

              {/* Add group form — committee/admin only */}
              {!isReadOnly && (
              <section className="surface surface-pad animate-slideUp">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <h2 className="section-title flex items-center gap-2">
                    ➕ เพิ่มกลุ่มเทียบ #{newGroup.groupNo}
                  </h2>
                  <button onClick={() => setShowGroupForm(v => !v)} className="btn btn-sm">
                    {showGroupForm ? '× ปิด' : '+ ฟอร์ม'}
                  </button>
                </div>
                {showGroupForm && (
                  <div className="animate-slideDown">
                    <p className="text-xs text-slate-500 mb-3">หลายวิชาในกลุ่มเดียวกัน = ใช้รวมกันเทียบเป็นวิชามหาลัย 1 ตัว</p>
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead><tr><th className="w-32">รหัสวิชา</th><th>ชื่อวิชา</th><th className="w-24">หน่วยกิต</th><th className="w-16"></th></tr></thead>
                        <tbody>
                          {newGroup.externalCourses.map((ex, i) => (
                            <tr key={i}>
                              <td><input className="input" value={ex.code} onChange={e => setExt(i, 'code', e.target.value)} placeholder="เช่น 06-031-101" /></td>
                              <td><input className="input" value={ex.nameTh} onChange={e => setExt(i, 'nameTh', e.target.value)} placeholder="ชื่อวิชา" /></td>
                              <td><input className="input" value={ex.credits} onChange={e => setExt(i, 'credits', e.target.value)} /></td>
                              <td>
                                {newGroup.externalCourses.length > 1 && (
                                  <button onClick={() => rmExtRow(i)} className="btn btn-sm btn-danger">−</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap items-center">
                      <button onClick={addExtRow} className="btn btn-sm">+ เพิ่มแถว</button>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-auto">
                        <input type="checkbox" checked={newGroup.requireAll}
                          onChange={e => setNewGroup({ ...newGroup, requireAll: e.target.checked })} />
                        ต้องติ้กทุกวิชาย่อย
                      </label>
                      <button onClick={saveGroup} disabled={submittingGroup} className="btn btn-sm btn-primary">
                        {submittingGroup ? 'กำลังบันทึก...' : '💾 บันทึกกลุ่มเทียบ'}
                      </button>
                    </div>
                  </div>
                )}
              </section>
              )} {/* end !isReadOnly add group section */}
              <section className="surface surface-pad animate-slideUp">
                <h2 className="section-title mb-3 flex items-center gap-2">
                  📋 กลุ่มเทียบที่มี <span className="badge">{groups.length}</span>
                </h2>
                {loadingGroups ? <GroupsSkeleton /> : groups.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">
                    <div className="text-3xl mb-2">📦</div>
                    ยังไม่มีกลุ่มเทียบ — เพิ่มได้จากด้านบน
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {groups.map(g => {
                      const editing = !isReadOnly && editGroupId === g._id;
                      if (editing) {
                        return (
                          <div key={g._id} className="surface p-3 border-2 border-brand-400 animate-slideDown">
                            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">กลุ่มที่</span>
                                <input
                                  type="number" min={1}
                                  className="input w-20 py-1"
                                  value={editGroupF.groupNo}
                                  onChange={e => setEditGroupF({ ...editGroupF, groupNo: Number(e.target.value) })}
                                />
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                <button onClick={() => saveEditGroup(g._id)} disabled={savingEditGroup}
                                  className="btn btn-sm btn-primary">
                                  {savingEditGroup ? '...' : '💾 บันทึก'}
                                </button>
                                <button onClick={cancelEditGroup} className="btn btn-sm btn-cancel">ยกเลิก</button>
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="table text-sm">
                                <thead><tr><th className="w-36">รหัส</th><th>ชื่อวิชา</th><th className="w-20">หน่วยกิต</th><th className="w-12"></th></tr></thead>
                                <tbody>
                                  {editGroupF.externalCourses.map((ex, i) => (
                                    <tr key={i}>
                                      <td><input className="input" value={ex.code}
                                        onChange={e => setEditExt(i, 'code', e.target.value)} /></td>
                                      <td><input className="input" value={ex.nameTh}
                                        onChange={e => setEditExt(i, 'nameTh', e.target.value)} /></td>
                                      <td><input className="input" value={ex.credits}
                                        onChange={e => setEditExt(i, 'credits', e.target.value)} /></td>
                                      <td>
                                        {editGroupF.externalCourses.length > 1 && (
                                          <button onClick={() => rmEditExtRow(i)} className="btn btn-sm btn-danger">−</button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-2 flex gap-2 items-center flex-wrap">
                              <button onClick={addEditExtRow} className="btn btn-sm">+ เพิ่มแถว</button>
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-auto">
                                <input type="checkbox" checked={editGroupF.requireAll}
                                  onChange={e => setEditGroupF({ ...editGroupF, requireAll: e.target.checked })} />
                                ต้องติ้กทุกวิชาย่อย
                              </label>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={g._id} className="surface p-3 border border-line hover:shadow-soft transition">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium flex items-center gap-2">
                              <span className="badge badge-brand">กลุ่ม {g.groupNo}</span>
                              <span className="text-xs text-slate-500">{g.externalCourses.length} วิชา</span>
                            </span>
                            <div className="flex gap-2">
                              {!isReadOnly && (
                                <>
                                  <button onClick={() => startEditGroup(g)} className="btn btn-sm">✏️</button>
                                  <button onClick={() => delGroup(g._id, g.groupNo)} className="btn btn-sm btn-danger">ลบ</button>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="table text-sm">
                              <tbody>
                                {g.externalCourses.map((ex, i) => (
                                  <tr key={i}>
                                    <td className="w-36 font-mono text-xs">{ex.code}</td>
                                    <td>{ex.nameTh}</td>
                                    <td className="w-20 text-right font-mono text-xs">{ex.credits}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>}

      <YearPickerModal
        open={pickerOpen}
        loading={loadingYears}
        years={yearOptions}
        selectedYear={selectedYear ?? undefined}
        canClose={canClosePicker}
        onSelect={y => setYear(y)}
        onClose={closePicker}
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
