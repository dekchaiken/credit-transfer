'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/Toast';
import ConfirmDialog, { type ConfirmOptions } from '@/components/ConfirmDialog';

type CourseInfo = { _id: string; code: string; nameTh: string; nameEn?: string };
type Ext = { code: string; nameTh: string; credits: string };
type G = { _id: string; uniCourseId: string; groupNo: number; externalCourses: Ext[] };

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

function Inner() {
  const sp = useSearchParams();
  const { toast } = useToast();
  const { data: sessionData } = useSession();
  const isReadOnly = (sessionData?.user as any)?.role === 'teacher';

  const uniIdParam = sp.get('uniId') || '';

  const [courseInfo, setCourseInfo] = useState<CourseInfo | null>(null);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [groups, setGroups] = useState<G[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newGroup, setNewGroup] = useState<{ groupNo: number; externalCourses: Ext[] }>({
    groupNo: 1, externalCourses: [{ code: '', nameTh: '', credits: '3' }],
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  function askConfirm(opts: ConfirmOptions, action: () => void) {
    setConfirmOpts(opts); setConfirmAction(() => action); setConfirmOpen(true);
  }

  // === Load course info from catalog ===
  useEffect(() => {
    if (!uniIdParam) { setCourseInfo(null); return; }
    (async () => {
      setLoadingCourse(true);
      try {
        const allCourses = await (await fetch('/api/uni-courses')).json();
        const found = allCourses.find((c: any) => c._id === uniIdParam);
        setCourseInfo(found || null);
      } finally { setLoadingCourse(false); }
    })();
  }, [uniIdParam]);

  // === Load groups for selected uniCourse ===
  async function loadGroups() {
    if (!uniIdParam) { setGroups([]); return; }
    setLoadingGroups(true);
    try {
      const gs: G[] = await (await fetch(`/api/transfer-groups?uniCourseId=${uniIdParam}`)).json();
      setGroups(gs);
      setNewGroup(n => ({ ...n, groupNo: gs.length + 1 }));
    } finally { setLoadingGroups(false); }
  }
  useEffect(() => { loadGroups(); }, [uniIdParam]);

  function setExt(i: number, k: keyof Ext, v: string) {
    const ex = [...newGroup.externalCourses]; (ex[i] as any)[k] = v;
    setNewGroup({ ...newGroup, externalCourses: ex });
  }
  function addExtRow() { setNewGroup({ ...newGroup, externalCourses: [...newGroup.externalCourses, { code: '', nameTh: '', credits: '3' }] }); }
  function rmExtRow(i: number) { setNewGroup({ ...newGroup, externalCourses: newGroup.externalCourses.filter((_, j) => j !== i) }); }

  async function save() {
    if (newGroup.externalCourses.some(ex => !ex.code || !ex.nameTh)) {
      toast({ type: 'error', message: 'กรอกรหัส/ชื่อวิชาให้ครบทุกแถว' }); return;
    }
    // Validate: รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)
    const invalidCodes = newGroup.externalCourses.filter(ex => !/^[\d\s-]+$/.test(ex.code));
    if (invalidCodes.length > 0) {
      toast({ type: 'error', message: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }); return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/transfer-groups', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uniCourseId: uniIdParam, groupNo: newGroup.groupNo, externalCourses: newGroup.externalCourses }),
      });
      if (!r.ok) { toast({ type: 'error', message: (await r.json()).error || 'บันทึกไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: `เพิ่มกลุ่ม ${newGroup.groupNo} แล้ว` });
      setNewGroup({ groupNo: newGroup.groupNo + 1, externalCourses: [{ code: '', nameTh: '', credits: '3' }] });
      setShowForm(false);
      loadGroups();
    } finally { setSubmitting(false); }
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
      loadGroups();
    });
  }

  // === Edit group state ===
  const [editId, setEditId] = useState<string | null>(null);
  const [editF, setEditF] = useState<{ groupNo: number; externalCourses: Ext[] }>({
    groupNo: 1, externalCourses: [],
  });
  const [savingEdit, setSavingEdit] = useState(false);

  function startEditGroup(g: G) {
    setEditId(g._id);
    setEditF({
      groupNo: g.groupNo,
      externalCourses: g.externalCourses.map(ex => ({ ...ex })),
    });
  }
  function cancelEditGroup() { setEditId(null); }
  function setEditExt(i: number, k: keyof Ext, v: string) {
    const ex = [...editF.externalCourses]; (ex[i] as any)[k] = v;
    setEditF({ ...editF, externalCourses: ex });
  }
  function addEditExtRow() {
    setEditF({ ...editF, externalCourses: [...editF.externalCourses, { code: '', nameTh: '', credits: '3' }] });
  }
  function rmEditExtRow(i: number) {
    setEditF({ ...editF, externalCourses: editF.externalCourses.filter((_, j) => j !== i) });
  }
  async function saveEditGroup(id: string) {
    if (editF.externalCourses.length === 0) {
      toast({ type: 'error', message: 'ต้องมีอย่างน้อย 1 วิชา' }); return;
    }
    if (editF.externalCourses.some(ex => !ex.code || !ex.nameTh)) {
      toast({ type: 'error', message: 'กรอกรหัส/ชื่อวิชาให้ครบทุกแถว' }); return;
    }
    // Validate: รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)
    const invalidCodes = editF.externalCourses.filter(ex => !/^[\d\s-]+$/.test(ex.code));
    if (invalidCodes.length > 0) {
      toast({ type: 'error', message: 'รหัสวิชาต้องเป็นตัวเลขเท่านั้น (อนุญาต - และช่องว่าง)' }); return;
    }
    setSavingEdit(true);
    try {
      const r = await fetch(`/api/transfer-groups/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ groupNo: Number(editF.groupNo), externalCourses: editF.externalCourses }),
      });
      if (!r.ok) { toast({ type: 'error', message: 'แก้ไขไม่สำเร็จ' }); return; }
      toast({ type: 'success', message: 'บันทึกแล้ว' });
      setEditId(null);
      loadGroups();
    } finally { setSavingEdit(false); }
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* === Hero === */}
      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="page-eyebrow">📦 กลุ่มเทียบโอน</div>
            {courseInfo ? (
              <>
                <h1 className="page-title flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-base text-brand-700">{courseInfo.code}</span>
                  <span className="truncate">{courseInfo.nameTh}</span>
                </h1>
                {courseInfo.nameEn && (
                  <p className="text-sm text-slate-600 mt-2">{courseInfo.nameEn}</p>
                )}
              </>
            ) : (
              <>
                <h1 className="page-title">จัดการกลุ่มเทียบโอน</h1>
                <p className="text-sm text-slate-600 mt-2 max-w-xl">
                  เลือกรายวิชาจากคลังเพื่อจัดการกลุ่มเทียบ
                </p>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Link href="/teacher/uni-courses" className="btn">← คลังรายวิชา</Link>
            {uniIdParam && (
              <div className="text-right pl-2 border-l border-line">
                <div className="text-xs text-slate-500">กลุ่มเทียบ</div>
                <div className="text-2xl font-semibold text-brand-600">{loadingGroups ? '…' : groups.length}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* === No course selected === */}
      {!uniIdParam && (
        <section className="surface surface-pad-lg text-center">
          <div className="text-5xl mb-3">📚</div>
          <p className="font-medium">กรุณาเลือกรายวิชา</p>
          <p className="text-sm text-slate-500 mt-1">กลับไปที่คลังรายวิชาแล้วกด "📦 กลุ่มเทียบ"</p>
          <Link href="/teacher/uni-courses" className="btn btn-primary mt-4">← กลับไปคลังรายวิชา</Link>
        </section>
      )}

      {/* === Group management === */}
      {uniIdParam && courseInfo && (
        <>
          {!isReadOnly && (
            <section className="surface surface-pad animate-slideUp">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="section-title flex items-center gap-2">
                  ➕ เพิ่มกลุ่มเทียบ #{newGroup.groupNo}
                </h2>
                <button onClick={() => setShowForm(v => !v)} className="btn btn-sm">
                  {showForm ? '× ปิด' : '+ ฟอร์ม'}
                </button>
              </div>
              {showForm && (
                <div className="animate-slideDown">
                  <p className="text-xs text-slate-500 mb-3">หลายวิชาในกลุ่มเดียวกัน = ใช้รวมกันเทียบเป็นวิชามหาลัย 1 ตัว</p>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead><tr><th className="w-32">รหัสวิชา</th><th>ชื่อวิชา</th><th className="w-24">หน่วยกิต</th><th className="w-16"></th></tr></thead>
                      <tbody>
                        {newGroup.externalCourses.map((ex, i) => (
                          <tr key={i}>
                            <td><input className="input" value={ex.code} onChange={e => setExt(i, 'code', e.target.value.replace(/[^0-9\s-]/g, ''))} placeholder="เช่น 04-031-101" /></td>
                            <td><input className="input" value={ex.nameTh} onChange={e => setExt(i, 'nameTh', e.target.value)} placeholder="ชื่อวิชา" /></td>
                            <td><input className="input" value={ex.credits} onChange={e => setExt(i, 'credits', e.target.value.replace(/[^0-9()\-. ]/g, ''))} /></td>
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
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button onClick={addExtRow} className="btn btn-sm">+ เพิ่มแถว</button>
                    <button onClick={save} disabled={submitting} className="btn btn-sm btn-primary">
                      {submitting ? 'กำลังบันทึก...' : '💾 บันทึกกลุ่มเทียบ'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

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
              <div className="space-y-2">
                {groups.map(g => {
                  const editing = !isReadOnly && editId === g._id;
                  if (editing) {
                    return (
                      <div key={g._id} className="surface p-3 border-2 border-brand-400 animate-slideDown">
                        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">กลุ่มที่</span>
                            <input
                              type="number" min={1}
                              className="input w-20 py-1"
                              value={editF.groupNo}
                              onChange={e => setEditF({ ...editF, groupNo: Number(e.target.value) })}
                            />
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button onClick={() => saveEditGroup(g._id)} disabled={savingEdit}
                              className="btn btn-sm btn-primary">
                              {savingEdit ? '...' : '💾 บันทึก'}
                            </button>
                            <button onClick={cancelEditGroup} className="btn btn-sm btn-cancel">ยกเลิก</button>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="table text-sm">
                            <thead><tr><th className="w-36">รหัส</th><th>ชื่อวิชา</th><th className="w-20">หน่วยกิต</th><th className="w-12"></th></tr></thead>
                            <tbody>
                              {editF.externalCourses.map((ex, i) => (
                                <tr key={i}>
                                  <td><input className="input" value={ex.code}
                                    onChange={e => setEditExt(i, 'code', e.target.value.replace(/[^0-9\s-]/g, ''))} /></td>
                                  <td><input className="input" value={ex.nameTh}
                                    onChange={e => setEditExt(i, 'nameTh', e.target.value)} /></td>
                                  <td><input className="input" value={ex.credits}
                                    onChange={e => setEditExt(i, 'credits', e.target.value.replace(/[^0-9()\-. ]/g, ''))} /></td>
                                  <td>
                                    {editF.externalCourses.length > 1 && (
                                      <button onClick={() => rmEditExtRow(i)} className="btn btn-sm btn-danger">−</button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-2">
                          <button onClick={addEditExtRow} className="btn btn-sm">+ เพิ่มแถว</button>
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
                        {!isReadOnly && (
                          <div className="flex gap-2">
                            <button onClick={() => startEditGroup(g)} className="btn btn-sm">✏️ แก้ไข</button>
                            <button onClick={() => delGroup(g._id, g.groupNo)} className="btn btn-sm btn-danger">ลบ</button>
                          </div>
                        )}
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

      <ConfirmDialog
        open={confirmOpen}
        options={confirmOpts}
        onConfirm={() => { confirmAction?.(); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export default function Page() { return <Suspense><Inner /></Suspense>; }
