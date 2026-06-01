'use client';
import { useEffect, useMemo, useState } from 'react';

type Year = {
  _id: string;
  year: number;
  level: string;
  programId: { _id: string; code: string; nameTh: string; faculty?: string };
};

type Offering = {
  _id: string;
  yearId: string;
  year: number;
  programId: string;
  programCode: string;
  programNameTh: string;
  order: number;
};

type Selection = {
  yearId: string;
  order: number;
};

export default function CourseUsageModal({
  open,
  course,
  onClose,
  onSaved,
}: {
  open: boolean;
  course: { _id: string; code: string; nameTh: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [years, setYears] = useState<Year[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // map yearId → Selection (presence = checked)
  const [selected, setSelected] = useState<Record<string, Selection>>({});

  useEffect(() => {
    if (!open || !course) return;
    setLoading(true);
    Promise.all([
      fetch('/api/years').then(r => r.json()),
      fetch(`/api/uni-courses/${course._id}/offerings`).then(r => r.json()),
    ])
      .then(([ys, offs]: [Year[], Offering[]]) => {
        setYears(ys);
        const map: Record<string, Selection> = {};
        for (const o of offs) {
          map[String(o.yearId)] = { yearId: String(o.yearId), order: o.order ?? 0 };
        }
        setSelected(map);
      })
      .finally(() => setLoading(false));
  }, [open, course]);

  // Group years by program for display
  const grouped = useMemo(() => {
    const m = new Map<string, { program: Year['programId']; years: Year[] }>();
    for (const y of years) {
      const key = String(y.programId?._id || '_none');
      if (!m.has(key)) m.set(key, { program: y.programId, years: [] });
      m.get(key)!.years.push(y);
    }
    // sort each program's years desc
    for (const g of m.values()) g.years.sort((a, b) => b.year - a.year);
    // sort programs by faculty + nameTh
    return [...m.values()].sort((a, b) => {
      const fa = a.program?.faculty || '';
      const fb = b.program?.faculty || '';
      return fa.localeCompare(fb) || (a.program?.nameTh || '').localeCompare(b.program?.nameTh || '');
    });
  }, [years]);

  function toggle(yearId: string, allYears: Year[]) {
    setSelected(prev => {
      const next = { ...prev };
      if (next[yearId]) {
        delete next[yearId];
      } else {
        // default order = max+1 within selected items of the same program
        const y = allYears.find(x => String(x._id) === yearId);
        const sameProgIds = new Set(
          allYears.filter(x => String(x.programId?._id) === String(y?.programId?._id)).map(x => String(x._id)),
        );
        const orders = Object.values(prev).filter(s => sameProgIds.has(s.yearId)).map(s => s.order);
        const nextOrder = orders.length === 0 ? 1 : Math.max(...orders) + 1;
        next[yearId] = { yearId, order: nextOrder };
      }
      return next;
    });
  }

  function setOrder(yearId: string, order: number) {
    setSelected(prev => ({ ...prev, [yearId]: { yearId, order } }));
  }

  async function save() {
    if (!course) return;
    setSaving(true);
    try {
      const items = Object.values(selected).map(s => ({ yearId: s.yearId, order: s.order }));
      const r = await fetch(`/api/uni-courses/${course._id}/offerings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j.error || 'บันทึกไม่สำเร็จ');
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !course) return null;

  const totalSelected = Object.keys(selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn p-4"
      onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lift w-full max-w-2xl max-h-[85vh] flex flex-col animate-slideUp"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-line">
          <div className="text-xs text-slate-500">🎯 ใช้ในหลักสูตรไหนบ้าง</div>
          <div className="font-semibold text-ink mt-1">
            <span className="font-mono text-brand-700 mr-2">{course.code}</span>
            {course.nameTh}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">กำลังโหลด...</div>
          ) : grouped.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              ยังไม่มีหลักสูตร/ปีในระบบ — ไปที่ "จัดการปีการศึกษา" เพื่อเพิ่มก่อน
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(g => (
                <div key={g.program?._id || '_none'} className="">
                  <div className="text-sm font-semibold text-ink mb-1">
                    <span className="font-mono text-xs text-brand-700 mr-2">{g.program?.code}</span>
                    {g.program?.nameTh}
                  </div>
                  {g.program?.faculty && (
                    <div className="text-[11px] text-slate-500 mb-2">{g.program.faculty}</div>
                  )}
                  <div className="space-y-1.5 pl-1">
                    {g.years.map(y => {
                      const sel = selected[String(y._id)];
                      const checked = !!sel;
                      return (
                        <label key={y._id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md border transition cursor-pointer
                            ${checked ? 'border-brand-300 bg-brand-50/40' : 'border-line hover:bg-soft'}`}>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggle(String(y._id), years)}
                            className="w-4 h-4 accent-brand-600" />
                          <div className="flex-1 text-sm">
                            <span className="font-medium">ปี {y.year}</span>
                            <span className="text-slate-500 ml-2 text-xs">· ระดับ {y.level}</span>
                          </div>
                          {checked && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-500">ลำดับ</span>
                              <input type="number" min={0} value={sel.order}
                                onChange={e => setOrder(String(y._id), Number(e.target.value) || 0)}
                                onClick={e => e.stopPropagation()}
                                className="w-16 px-2 py-1 text-sm text-center border border-line rounded focus:border-brand-400 focus:outline-none" />
                            </div>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-line flex items-center justify-between gap-3 bg-soft/30">
          <div className="text-xs text-slate-500">
            {totalSelected === 0 ? 'ยังไม่ได้เลือกหลักสูตรใด' : `เลือกแล้ว ${totalSelected} รายการ`}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-sm">ยกเลิก</button>
            <button onClick={save} disabled={saving || loading}
              className="btn btn-sm btn-primary">
              {saving ? 'กำลังบันทึก...' : '💾 บันทึก'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
