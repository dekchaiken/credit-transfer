'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/Toast';
import ConfirmDialog, { type ConfirmOptions } from '@/components/ConfirmDialog';
import ApprovalPreviewModal from '@/components/ApprovalPreviewModal';

type Ext = { code: string; nameTh: string; credits: string };
type Group = { _id: string; uniCourseId: string; groupNo: number; externalCourses: Ext[]; requireAll?: boolean };
type Course = { _id: string; code: string; nameTh: string; nameEn?: string; creditHours?: string };
type Selection = { uniCourseId: string; groupNo: number; grade: string; outsideCE: boolean; selected: boolean; externalCourseCode?: string | null };
type Sheet = { _id?: string; selections: Selection[]; committee: { name: string; role?: string }[]; signMonthYear: string; status: string };
type Student = { _id: string; studentId: string; fullName: string; yearId: { year: number }; programId: { nameTh: string; faculty?: string }; level: string };

type Filter = 'all' | 'selected' | 'unselected';

// เกรดมาตรฐาน — ตัวเลขเท่านั้น ไม่มี .00/.50 ต่อท้าย ไม่มีตัวอักษร
const GRADE_OPTIONS = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0'];

// เกรดต่ำกว่า 2 เทียบโอนไม่ได้ → ติ๊ก "เลือก" ไม่ได้ (เกรดว่างไม่ถือว่าต่ำกว่า 2)
function gradeTooLow(grade: string | undefined): boolean {
  if (!grade) return false;
  const n = parseFloat(grade);
  return !isNaN(n) && n < 2;
}

function SkeletonCard() {
  return (
    <div className="surface p-4 mb-3 animate-pulseSoft">
      <div className="flex justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-3 w-2/3" />
        </div>
        <div className="skeleton h-6 w-16 rounded-full" />
      </div>
    </div>
  );
}

export default function SheetEditPage({ params }: { params: { studentId: string } }) {
  const { studentId } = params;
  const { toast } = useToast();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role as string | undefined;

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sheet, setSheet] = useState<Sheet>({ selections: [], committee: [], signMonthYear: '', status: 'draft' });
  const [availableCommittee, setAvailableCommittee] = useState<{ _id: string; fullName: string; username: string }[]>([]);
  const [committeeLoading, setCommitteeLoading] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);
  const confirmActionRef = useRef<(() => void) | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  function askConfirm(opts: ConfirmOptions, action: () => void) {
    setConfirmOpts(opts);
    confirmActionRef.current = action;
    setConfirmOpen(true);
  }
  function handleConfirm() {
    const fn = confirmActionRef.current;
    setConfirmOpen(false);
    confirmActionRef.current = null;
    if (fn) fn();
  }

  // === Load ===
  async function load() {
    setLoading(true);
    try {
      const r = await (await fetch(`/api/sheets/${studentId}?byStudent=1`)).json();
      setStudent(r.student); setCourses(r.courses); setGroups(r.groups);
      const sel = (r.sheet?.selections || []).filter((s: any) => s.groupNo);

      // ดึง committee ของปีนั้น
      const studentYear = r.student?.yearId?.year;
      let yearCommittee: { _id: string; fullName: string; username: string }[] = [];
      if (studentYear) {
        try {
          setCommitteeLoading(true);
          const cr = await fetch(`/api/users/committee?year=${studentYear}`);
          if (cr.ok) yearCommittee = await cr.json();
        } catch {} finally { setCommitteeLoading(false); }
      }
      setAvailableCommittee(yearCommittee);

      // Auto-fill rules:
      //   - locked sheet (pending_review/finalized) → snapshot ที่ save ไว้ (อาจเป็นชื่อเก่าตอนปีนั้นยังมีกรรมการ)
      //   - draft sheet → reflect ปีปัจจุบันเสมอ (ถ้าปีไม่มีกรรมการ → ฟิลด์ว่าง + banner เตือน)
      const existing = r.sheet?.committee as { name: string; role?: string }[] | undefined;
      const status = r.sheet?.status || 'draft';
      const lockedSnapshot = status === 'pending_review' || status === 'finalized';
      const hasNonEmptyExisting = Array.isArray(existing) && existing.some(c => c?.name?.trim());
      const committeeToUse = lockedSnapshot && hasNonEmptyExisting
        ? existing!
        : yearCommittee.slice(0, 3).map(c => ({ name: c.fullName, role: 'กรรมการ' }));

      setSheet({
        _id: r.sheet?._id,
        selections: sel,
        committee: committeeToUse,
        signMonthYear: r.sheet?.signMonthYear || '',
        status: r.sheet?.status || 'draft',
      });
    } catch {
      toast({ type: 'error', message: 'โหลดข้อมูลไม่สำเร็จ' });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [studentId]);

  // === ดึงรายชื่อกรรมการของปีใหม่ + เขียนทับ committee ===
  async function refreshCommitteeFromYear() {
    if (!student?.yearId?.year) return;
    setCommitteeLoading(true);
    try {
      const cr = await fetch(`/api/users/committee?year=${student.yearId.year}`);
      if (!cr.ok) { toast({ type: 'error', message: 'ดึงรายชื่อกรรมการไม่สำเร็จ' }); return; }
      const list: { _id: string; fullName: string; username: string }[] = await cr.json();
      setAvailableCommittee(list);
      const next = list.slice(0, 3).map(c => ({ name: c.fullName, role: 'กรรมการ' }));
      setSheet(s => ({ ...s, committee: next }));
      toast({
        type: list.length === 0 ? 'error' : 'success',
        message: list.length === 0
          ? `ปี ${student.yearId.year} ยังไม่มีกรรมการ — ติดต่อ admin ให้กำหนด`
          : `อัปเดตกรรมการปี ${student.yearId.year} แล้ว (${list.length} ท่าน)`,
      });
    } finally { setCommitteeLoading(false); }
  }

  // === Selection helpers (per external course) ===
  function findExtSel(uniId: string, groupNo: number, extCode: string) {
    return sheet.selections.find(s => String(s.uniCourseId) === uniId && s.groupNo === groupNo && s.externalCourseCode === extCode);
  }
  function toggleExt(uniId: string, groupNo: number, extCode: string) {
    if (sheet.status === 'finalized') {
      toast({ type: 'error', message: '🔒 ใบนี้ยืนยันแล้ว — กด "ยกเลิกการยืนยัน" ก่อนแก้ไข' });
      return;
    }
    const exists = findExtSel(uniId, groupNo, extCode);
    setSheet(s => ({
      ...s,
      selections: exists
        ? s.selections.filter(x => !(String(x.uniCourseId) === uniId && x.groupNo === groupNo && x.externalCourseCode === extCode))
        : [...s.selections, { uniCourseId: uniId, groupNo, grade: '', outsideCE: false, selected: false, externalCourseCode: extCode }],
    }));
  }
  function patchExt(uniId: string, groupNo: number, extCode: string, patch: Partial<Selection>) {
    if (sheet.status === 'finalized') return;
    setSheet(s => ({
      ...s,
      selections: s.selections.map(x =>
        String(x.uniCourseId) === uniId && x.groupNo === groupNo && x.externalCourseCode === extCode ? { ...x, ...patch } : x
      ),
    }));
  }
  function groupsOf(uniId: string) { return groups.filter(g => String(g.uniCourseId) === uniId); }

  // === Auto-save (debounced) ===
  const dirtyRef = useRef(false);
  const firstRef = useRef(true);
  useEffect(() => {
    if (loading || firstRef.current) { firstRef.current = false; return; }
    dirtyRef.current = true;
    const t = setTimeout(async () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setSavingState('saving');
      try {
        const r = await fetch(`/api/sheets/${studentId}?byStudent=1`, {
          method: 'PATCH', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            selections: sheet.selections, committee: sheet.committee,
            signMonthYear: sheet.signMonthYear,
          }),
        });
        const r2 = await r.json();
        setSheet(s => ({ ...s, _id: r2._id }));
        setSavingState('saved');
        setTimeout(() => setSavingState('idle'), 1200);
      } catch {
        setSavingState('idle');
        toast({ type: 'error', message: 'บันทึกอัตโนมัติไม่สำเร็จ' });
      }
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line
  }, [sheet]);

  async function openPdf() {
    setSavingState('saving');
    const r = await fetch(`/api/sheets/${studentId}?byStudent=1`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ selections: sheet.selections, committee: sheet.committee, signMonthYear: sheet.signMonthYear }),
    });
    const r2 = await r.json();
    setSavingState('saved');
    setTimeout(() => setSavingState('idle'), 1200);
    if (r2._id) window.open(`/api/sheets/${r2._id}/pdf`, '_blank');
  }

  // === Filter / search ===
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter(c => {
      const has = sheet.selections.some(s => String(s.uniCourseId) === c._id);
      if (filter === 'selected' && !has) return false;
      if (filter === 'unselected' && has) return false;
      if (!q) return true;
      return c.code.toLowerCase().includes(q) || c.nameTh.toLowerCase().includes(q) || (c.nameEn || '').toLowerCase().includes(q);
    });
  }, [courses, sheet.selections, search, filter]);

  // === Stats ===
  function groupPasses(g: Group, uniId: string): boolean {
    const gSels = sheet.selections.filter(s => String(s.uniCourseId) === uniId && s.groupNo === g.groupNo);
    const extSels = gSels.filter(s => s.externalCourseCode);
    if (extSels.length === 0) return gSels.some(s => s.selected);
    if (g.requireAll) return g.externalCourses.every(ex => extSels.find(s => s.externalCourseCode === ex.code)?.selected === true);
    return extSels.some(s => s.selected);
  }
  const courseTransferCount = courses.filter(c =>
    groups.filter(g => String(g.uniCourseId) === c._id).some(g => groupPasses(g, c._id))
  ).length;
  const groupSelectedCount = new Set(sheet.selections.map(s => `${s.uniCourseId}|${s.groupNo}`)).size;
  const progress = courses.length === 0 ? 0 : Math.round((courseTransferCount / courses.length) * 100);
  const isFinalized = sheet.status === 'finalized';
  const isPendingReview = sheet.status === 'pending_review';
  // teacher: locked when pending_review or finalized; committee: locked when finalized only
  const isLocked = userRole === 'committee' ? isFinalized : (isFinalized || isPendingReview);

  async function changeStatus(newStatus: string) {
    const r = await fetch(`/api/sheets/${studentId}?byStudent=1`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      toast({ type: 'error', message: `บันทึกไม่สำเร็จ: ${err.error || r.status}` });
      return;
    }
    setSheet(s => ({ ...s, status: newStatus }));
  }

  function finalize() {
    if (courseTransferCount === 0) {
      toast({ type: 'error', message: 'ยังไม่ได้ติ๊ก "เลือก" สักวิชา — ยืนยันไม่ได้' });
      return;
    }
    // Open preview modal instead of direct confirm
    setPreviewOpen(true);
  }

  async function confirmFinalize() {
    setPreviewOpen(false);
    await changeStatus('finalized');
    toast({ type: 'success', message: '✓ ยืนยันใบเทียบแล้ว' });
  }
  function unfinalize() {
    askConfirm({
      title: 'ยกเลิกการยืนยัน?',
      message: 'สถานะจะกลับเป็น "ฉบับร่าง" และสามารถแก้ไขได้อีกครั้ง',
      confirmText: '↩ ยกเลิกการยืนยัน',
      cancelText: 'ปิด',
      variant: 'warning',
    }, async () => {
      await changeStatus('draft');
      toast({ type: 'info', message: 'กลับเป็นฉบับร่างแล้ว' });
    });
  }
  function submitForReview() {
    if (courseTransferCount === 0) {
      toast({ type: 'error', message: 'ยังไม่ได้ติ๊ก "เลือก" สักวิชา — ส่งพิจารณาไม่ได้' });
      return;
    }
    askConfirm({
      title: 'ส่งให้กรรมการพิจารณา?',
      message: `ส่งใบเทียบของ ${student?.fullName} (${courseTransferCount} วิชา) ให้กรรมการตรวจสอบ`,
      confirmText: '📤 ส่งพิจารณา',
      cancelText: 'ยกเลิก',
      variant: 'success',
    }, async () => {
      await changeStatus('pending_review');
      toast({ type: 'success', message: '📤 ส่งให้กรรมการพิจารณาแล้ว' });
    });
  }

  // === Bulk expand/collapse ===
  function toggleAll(state: boolean) {
    const next: Record<string, boolean> = {};
    courses.forEach(c => next[c._id] = state);
    setOpen(next);
  }

  // === Render ===
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="surface p-5">
          <div className="skeleton h-5 w-1/3 mb-2" />
          <div className="skeleton h-3 w-2/3" />
        </div>
        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }
  if (!student) return <p className="text-sm text-muted">ไม่พบข้อมูลนักศึกษา</p>;

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* === Header card === */}
      <section className={`surface p-5 animate-slideDown ${isFinalized ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200' : isPendingReview ? 'bg-gradient-to-br from-amber-50 to-white border-amber-200' : 'bg-gradient-to-br from-brand-50 to-white'}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className={`text-xs font-medium uppercase tracking-wide flex items-center gap-2 ${isFinalized ? 'text-emerald-700' : isPendingReview ? 'text-amber-700' : 'text-brand-700'}`}>
              ใบเทียบโอนรายวิชา
              <span className={`badge ${isFinalized ? 'badge-success' : isPendingReview ? 'badge-warning' : 'badge-brand'}`}>
                {isFinalized ? '✓ อนุมัติแล้ว' : isPendingReview ? '⏳ รอพิจารณา' : '● ฉบับร่าง'}
              </span>
            </div>
            <h1 className="text-xl font-semibold mt-1">{student.fullName}</h1>
            <div className="text-sm text-muted mt-0.5">รหัส {student.studentId} · {student.programId?.nameTh}</div>
            <div className="text-xs text-muted mt-1">ปีการศึกษา {student.yearId?.year} · ระดับ {student.level}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted">ความคืบหน้า</div>
            <div className="text-2xl font-semibold text-brand-600">{courseTransferCount}<span className="text-base text-muted">/{courses.length}</span></div>
            <div className="text-xs text-muted">วิชาที่เทียบโอน</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 bg-soft rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-500 ${isFinalized ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : isPendingReview ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-brand-500 to-emerald-500'}`}
              style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-muted">
            <span>{progress}% ของรายวิชาทั้งหมด</span>
            <span>{groupSelectedCount} กลุ่มเทียบที่เลือกไว้</span>
          </div>
        </div>
        {isFinalized && (
          <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            🔒 ใบเทียบนี้ได้รับการยืนยันแล้ว
          </div>
        )}
        {isPendingReview && userRole === 'teacher' && (
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⏳ ส่งให้กรรมการพิจารณาแล้ว — กด "ดึงกลับ" หากต้องการแก้ไข
          </div>
        )}
      </section>

      {/* === Sticky toolbar === */}
      <section className="surface p-3 sticky top-16 md:top-[112px] z-20 shadow-soft no-print">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <input className="input pl-9" placeholder="ค้นหารหัส/ชื่อวิชา..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">🔍</span>
          </div>
          <div className="flex items-center gap-1 bg-soft rounded-lg p-1">
            {(['all', 'selected', 'unselected'] as Filter[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded transition ${filter === f ? 'bg-white shadow-soft font-medium' : 'text-muted hover:text-ink'}`}>
                {f === 'all' ? 'ทั้งหมด' : f === 'selected' ? 'เลือกแล้ว' : 'ยังไม่เลือก'}
              </button>
            ))}
          </div>
          <button onClick={() => toggleAll(true)} className="btn btn-sm btn-ghost">↓ เปิดทั้งหมด</button>
          <button onClick={() => toggleAll(false)} className="btn btn-sm btn-ghost">↑ ปิดทั้งหมด</button>
          <div className="flex-1" />
          <div className="text-xs text-muted min-w-[80px] text-right">
            {savingState === 'saving' && <span className="text-brand-600 animate-pulseSoft">● บันทึก...</span>}
            {savingState === 'saved' && <span className="text-emerald-600">✓ บันทึกแล้ว</span>}
            {savingState === 'idle' && <span className="text-muted">บันทึกอัตโนมัติ</span>}
          </div>
          {isFinalized && (
            <button onClick={openPdf} className="btn btn-primary">
              🖨 เปิด PDF / ปริ้น
            </button>
          )}
        </div>
      </section>

      {/* === Course cards === */}
      <section className="space-y-3">
        {filtered.length === 0 && (
          <div className="surface p-8 text-center">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-sm text-muted">ไม่พบรายวิชาที่ตรงกับเงื่อนไข</p>
          </div>
        )}
        {filtered.map(c => {
          const gs = groupsOf(c._id);
          const selectedHere = sheet.selections.filter(s => String(s.uniCourseId) === c._id);
          // unique groupNos that have at least one selection
          const selectedGroups = [...new Set(selectedHere.map(s => s.groupNo))].sort((a, b) => a - b);
          const isOpen = !!open[c._id];
          const hasSelection = selectedGroups.length > 0;
          return (
            <div key={c._id} className={`surface card-hover overflow-hidden transition
              ${hasSelection ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
              {/* Card header — clickable */}
              <button onClick={() => setOpen(o => ({ ...o, [c._id]: !o[c._id] }))}
                className="w-full text-left px-4 py-3 hover:bg-soft transition flex items-center gap-3">
                <span className={`chev ${isOpen ? 'open' : ''} text-muted`}>▶</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted">{c.code}</span>
                    <span className="font-medium text-sm">{c.nameTh}</span>
                    {c.nameEn && <span className="text-xs text-muted">({c.nameEn})</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="badge">หน่วยกิต {c.creditHours || '-'}</span>
                    <span className="badge">{gs.length} กลุ่มเทียบ</span>
                    {hasSelection && <span className="badge badge-success">✓ เลือก {selectedGroups.length} กลุ่ม</span>}
                  </div>
                </div>
              </button>

              {/* Selected groups summary (visible when collapsed) */}
              {!isOpen && hasSelection && (
                <div className="px-4 pb-3 pt-1 border-t border-line/50">
                  <div className="flex flex-wrap gap-1.5">
                    {selectedGroups.map(gNo => (
                      <span key={gNo} className="badge badge-brand">กลุ่ม {gNo}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Expanded — group list */}
              {isOpen && (
                <div className="border-t border-line animate-slideDown">
                  {gs.length === 0 && (
                    <p className="text-xs text-muted px-4 py-3">ยังไม่มีกลุ่มเทียบ — เพิ่มได้ที่หน้า "กลุ่มเทียบ"</p>
                  )}
                  {gs.map(g => {
                    const groupChecked = g.externalCourses.some(ex => !!findExtSel(c._id, g.groupNo, ex.code));
                    return (
                      <div key={g._id} className={`border-t border-line/50 transition ${groupChecked ? 'bg-emerald-50/40' : ''}`}>
                        {/* Group header — label only, no checkbox */}
                        <div className="px-4 pt-2 pb-1 flex items-center gap-2">
                          <span className={`text-sm font-semibold ${groupChecked ? 'text-emerald-700' : 'text-slate-600'}`}>
                            กลุ่ม {g.groupNo}
                          </span>
                          {groupChecked && <span className="text-xs text-emerald-600">● เลือกแล้ว</span>}
                        </div>
                        {/* Per-external-course rows */}
                        {g.externalCourses.map((ex, i) => {
                          const extSel = findExtSel(c._id, g.groupNo, ex.code);
                          const extChecked = !!extSel;
                          return (
                            <div key={i}
                              className={`px-4 py-2 border-t border-line/30 transition
                                ${extChecked ? 'bg-emerald-50/60' : 'hover:bg-soft'}
                                ${isLocked ? 'opacity-90' : ''}`}>
                              <div className="flex items-start gap-3">
                                <input type="checkbox" className="mt-1 w-4 h-4 accent-brand-500 shrink-0 disabled:cursor-not-allowed"
                                  checked={extChecked} disabled={isLocked}
                                  onChange={() => toggleExt(c._id, g.groupNo, ex.code)} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline gap-2 text-xs">
                                    <span className="font-mono text-brand-700 font-semibold w-24 shrink-0">{ex.code}</span>
                                    <span className="flex-1">{ex.nameTh}</span>
                                    <span className="text-muted shrink-0">{ex.credits} หน่วยกิต</span>
                                  </div>
                                  {extChecked && (
                                    <div className="mt-2 flex flex-wrap gap-3 items-center text-xs animate-slideDown"
                                      onClick={e => e.stopPropagation()}>
                                      <label className="flex items-center gap-2">
                                        <span className="text-muted">เกรด</span>
                                        <select className="input w-24 py-1 text-xs disabled:bg-soft disabled:cursor-not-allowed"
                                          value={extSel?.grade || ''} disabled={isLocked}
                                          onChange={e => {
                                            const grade = e.target.value;
                                            // เกรดต่ำกว่า 2 → เทียบโอนไม่ได้ ปลดติ๊ก "เลือก" อัตโนมัติ
                                            patchExt(c._id, g.groupNo, ex.code,
                                              gradeTooLow(grade) ? { grade, selected: false } : { grade });
                                          }}>
                                          <option value="">—</option>
                                          {GRADE_OPTIONS.map(gr => <option key={gr} value={gr}>{gr}</option>)}
                                        </select>
                                      </label>
                                      {(() => {
                                        const tooLow = gradeTooLow(extSel?.grade);
                                        const disabledSelect = isLocked || tooLow;
                                        return (
                                          <label className={`flex items-center gap-1.5 px-2 py-1 rounded ${extSel?.selected ? 'bg-emerald-50 border border-emerald-200' : tooLow ? 'bg-rose-50 border border-rose-200' : 'bg-amber-50 border border-amber-200'} ${disabledSelect ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                            title={tooLow ? 'เกรดต่ำกว่า 2 เทียบโอนไม่ได้' : ''}>
                                            <input type="checkbox" className="w-3.5 h-3.5 accent-brand-500 disabled:cursor-not-allowed"
                                              checked={!!extSel?.selected} disabled={disabledSelect}
                                              onChange={e => patchExt(c._id, g.groupNo, ex.code, { selected: e.target.checked })} />
                                            <span className={`font-medium ${extSel?.selected ? 'text-emerald-700' : tooLow ? 'text-rose-600' : 'text-amber-700'}`}>
                                              {tooLow ? '🚫 เกรดต่ำกว่า 2' : `✓ เลือก ${extSel?.selected ? '' : '(ยังไม่ติ๊ก)'}`}
                                            </span>
                                          </label>
                                        );
                                      })()}
                                      <label className={`flex items-center gap-1.5 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                        <input type="checkbox" className="w-3.5 h-3.5 accent-brand-500 disabled:cursor-not-allowed"
                                          checked={!!extSel?.outsideCE} disabled={isLocked}
                                          onChange={e => patchExt(c._id, g.groupNo, ex.code, { outsideCE: e.target.checked })} />
                                        <span>นอกระบบ CE</span>
                                      </label>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* === Committee === */}
      <section className="surface p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <span>👥</span> กรรมการ (3 ท่าน) + เดือน/ปีที่ลงนาม
            {isLocked && <span className="badge badge-success text-xs">🔒 ล็อก</span>}
          </h2>
          {!isLocked && (
            <button
              type="button"
              onClick={refreshCommitteeFromYear}
              disabled={committeeLoading}
              title={`ดึงรายชื่อกรรมการของปี ${student?.yearId?.year || ''} ใหม่`}
              className="btn btn-sm btn-ghost border border-line"
            >
              {committeeLoading ? '⏳' : '🔄'} รีเฟรชจากปี {student?.yearId?.year || ''}
            </button>
          )}
        </div>

        {/* Info banner */}
        {!isLocked && availableCommittee.length === 0 && (
          <div className="mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
            <span>⚠️</span>
            <div>
              ปี <b>{student?.yearId?.year}</b> ยังไม่มีกรรมการที่รับผิดชอบ —
              ขอให้ admin มอบหมายปีนี้ให้กรรมการก่อน จึงจะเลือกชื่อในใบเทียบได้
            </div>
          </div>
        )}
        {!isLocked && availableCommittee.length > 0 && (
          <div className="mb-3 text-xs text-slate-600 bg-soft border border-line rounded-lg px-3 py-2 flex items-start gap-2">
            <span>ℹ️</span>
            <div>
              รายชื่อนี้ดึงจากกรรมการที่ admin มอบหมายให้ดูแลปี <b>{student?.yearId?.year}</b> ({availableCommittee.length} คน) —
              หากต้องการเปลี่ยนรายชื่อ ให้ admin มอบหมายปีนี้ให้กรรมการคนอื่น แล้วกด "🔄 รีเฟรช"
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => {
            // ใบ locked → แสดงเป็น input disabled (snapshot ที่ save ไว้)
            if (isLocked) {
              return (
                <div key={i}>
                  <label className="label">กรรมการ {i + 1}</label>
                  <input
                    className="input disabled:bg-soft disabled:cursor-not-allowed"
                    value={sheet.committee[i]?.name || ''}
                    disabled
                  />
                </div>
              );
            }
            // ใบ draft + ไม่มี committee → ฟิลด์ disable เป็น placeholder
            if (availableCommittee.length === 0) {
              return (
                <div key={i}>
                  <label className="label">กรรมการ {i + 1}</label>
                  <input
                    className="input disabled:bg-soft disabled:cursor-not-allowed"
                    value=""
                    disabled
                    placeholder="— ยังไม่มีกรรมการในปีนี้ —"
                  />
                </div>
              );
            }
            // ใบ draft + มี committee → dropdown
            return (
              <div key={i}>
                <label className="label">กรรมการ {i + 1}</label>
                <select
                  className="input"
                  value={sheet.committee[i]?.name || ''}
                  onChange={e => {
                    const c = [...sheet.committee];
                    c[i] = { ...(c[i] || { role: 'กรรมการ' }), name: e.target.value };
                    setSheet({ ...sheet, committee: c });
                  }}
                >
                  <option value="">— เลือกกรรมการ —</option>
                  {availableCommittee.map(cm => (
                    <option key={cm._id} value={cm.fullName}>{cm.fullName}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        <div className="mt-3 max-w-xs">
          <label className="label">เดือน/ปีที่ลงนาม</label>
          <input className="input disabled:bg-soft disabled:cursor-not-allowed" value={sheet.signMonthYear}
            disabled={isLocked}
            onChange={e => setSheet({ ...sheet, signMonthYear: e.target.value })} placeholder="เช่น เมษายน 2569" />
        </div>
      </section>

      {/* === Bottom summary === */}
      <section className={`surface p-4 ${isFinalized ? 'bg-gradient-to-r from-emerald-50 to-emerald-100' : isPendingReview ? 'bg-gradient-to-r from-amber-50 to-amber-100' : 'bg-gradient-to-r from-brand-50 to-emerald-50'}`}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm">
            สรุป: เทียบโอนได้ <b className="text-brand-700 text-lg">{courseTransferCount}</b> วิชา
            <span className="text-muted"> (รวม {groupSelectedCount} กลุ่มเทียบ)</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Teacher actions */}
            {userRole === 'teacher' && !isFinalized && (
              isPendingReview ? (
                <button onClick={async () => { await changeStatus('draft'); toast({ type: 'info', message: 'ดึงกลับเป็นฉบับร่างแล้ว' }); }} className="btn btn-ghost border border-line">↩ ดึงกลับ</button>
              ) : (
                <button onClick={submitForReview} className="btn btn-success">📤 ส่งพิจารณา</button>
              )
            )}
            {/* Committee actions */}
            {userRole === 'committee' && isPendingReview && (
              <>
                <button onClick={async () => { await changeStatus('draft'); toast({ type: 'info', message: 'ส่งกลับร่างแล้ว' }); }} className="btn btn-ghost border border-line">↩ ส่งกลับร่าง</button>
                <button onClick={finalize} className="btn btn-success">✓ อนุมัติ</button>
              </>
            )}
            {/* Admin or finalized unfinalize */}
            {(userRole === 'admin' || (userRole === 'committee' && isFinalized)) && (
              <>
                <button onClick={() => askConfirm({
                  title: 'ส่งกลับร่าง?',
                  message: 'ใบเทียบจะกลับไปเป็น "ฉบับร่าง" — อาจารย์จะสามารถแก้ไขและส่งพิจารณาใหม่ได้',
                  confirmText: '↩ ส่งกลับร่าง',
                  cancelText: 'ยกเลิก',
                  variant: 'warning',
                }, async () => { await changeStatus('draft'); toast({ type: 'info', message: 'ส่งกลับร่างแล้ว' }); })}
                  className="btn btn-ghost border border-line">↩ ส่งกลับร่าง</button>
                <button onClick={() => askConfirm({
                  title: 'ส่งกลับรอพิจารณา?',
                  message: 'ใบเทียบจะกลับมาเป็น "รอพิจารณา" — กรรมการสามารถรีวิวและแก้ไขได้อีกครั้ง',
                  confirmText: '↩ ส่งกลับพิจารณา',
                  cancelText: 'ยกเลิก',
                  variant: 'warning',
                }, async () => { await changeStatus('pending_review'); toast({ type: 'info', message: 'ส่งกลับรอพิจารณาแล้ว' }); })}
                  className="btn btn-ghost border border-line">↩ ส่งกลับพิจารณา</button>
              </>
            )}
            {isFinalized && (
              <button onClick={openPdf} className="btn btn-primary">🖨 เปิด PDF / ปริ้น</button>
            )}
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        options={confirmOpts}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      <ApprovalPreviewModal
        open={previewOpen}
        student={student}
        courses={courses}
        groups={groups}
        selections={sheet.selections}
        onConfirm={confirmFinalize}
        onCancel={() => setPreviewOpen(false)}
      />
    </div>
  );
}
