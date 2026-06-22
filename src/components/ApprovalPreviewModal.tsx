'use client';
import { useEffect, useRef } from 'react';

type Ext = { code: string; nameTh: string; credits: string };
type Group = { _id: string; uniCourseId: string; groupNo: number; externalCourses: Ext[] };
type Course = { _id: string; code: string; nameTh: string; nameEn?: string; creditHours?: string };
type Selection = { uniCourseId: string; groupNo: number; grade: string; outsideCE: boolean; selected: boolean; externalCourseCode?: string | null };
type Student = { _id: string; studentId: string; fullName: string; yearId: { year: number }; programId: { nameTh: string; faculty?: string }; level: string };

type Props = {
  open: boolean;
  student: Student | null;
  courses: Course[];
  groups: Group[];
  selections: Selection[];
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ApprovalPreviewModal({ open, student, courses, groups, selections, onConfirm, onCancel }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onCancel]);

  if (!open || !student) return null;

  // Group selections by course
  const selectedCourses = courses
    .map(c => {
      const sels = selections.filter(s => String(s.uniCourseId) === c._id);
      if (sels.length === 0) return null;
      return { course: c, selections: sels };
    })
    .filter(Boolean) as { course: Course; selections: Selection[] }[];

  const transferredCourses = selectedCourses.filter(sc => sc.selections.some(s => s.selected));
  const notTransferredCourses = selectedCourses.filter(sc => !sc.selections.some(s => s.selected));

  // วิชาที่ไม่ผ่าน = มีการกรอกข้อมูล (เกรดหรือ outsideCE) แต่ไม่ติ๊ก "เลือก"
  const rejectedCourses = notTransferredCourses.filter(sc =>
    sc.selections.some(s => s.grade || s.outsideCE)
  );

  const totalTransferred = transferredCourses.length;
  const totalGroups = new Set(selections.map(s => `${s.uniCourseId}|${s.groupNo}`)).size;
  const totalSelected = new Set(selections.filter(s => s.selected).map(s => `${s.uniCourseId}|${s.groupNo}`)).size;
  const totalRejected = rejectedCourses.length;

  return (
    <div ref={backdropRef} onClick={e => { if (e.target === backdropRef.current) onCancel(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slideUp flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span>📋</span> พรีวิวก่อนอนุมัติ
              </h2>
              <p className="text-sm text-emerald-100 mt-1">ตรวจสอบรายละเอียดการเทียบโอนก่อนยืนยัน</p>
            </div>
            <button onClick={onCancel} className="text-white/80 hover:text-white text-2xl leading-none">×</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Student info */}
          <section className="bg-gradient-to-br from-slate-50 to-white border border-line rounded-lg p-4">
            <h3 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2">
              <span>👤</span> ข้อมูลนักศึกษา
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">ชื่อ-นามสกุล:</span>
                <div className="font-medium">{student.fullName}</div>
              </div>
              <div>
                <span className="text-slate-500">รหัสนักศึกษา:</span>
                <div className="font-medium font-mono">{student.studentId}</div>
              </div>
              <div>
                <span className="text-slate-500">สาขาวิชา:</span>
                <div className="font-medium">{student.programId?.nameTh}</div>
              </div>
              <div>
                <span className="text-slate-500">ปีการศึกษา:</span>
                <div className="font-medium">{student.yearId?.year} · ระดับ {student.level}</div>
              </div>
            </div>
          </section>

          {/* Summary stats */}
          <section className="grid grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-emerald-600">{totalTransferred}</div>
              <div className="text-xs text-slate-600 mt-1">วิชาที่เทียบโอนได้</div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-white border border-red-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{totalRejected}</div>
              <div className="text-xs text-slate-600 mt-1">วิชาที่ไม่ผ่าน</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{totalSelected}</div>
              <div className="text-xs text-slate-600 mt-1">กลุ่มเทียบที่เลือก</div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-amber-600">{totalGroups}</div>
              <div className="text-xs text-slate-600 mt-1">กลุ่มเทียบทั้งหมด</div>
            </div>
          </section>

          {/* Transferred courses detail */}
          <section>
            <h3 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2">
              <span>✅</span> รายวิชาที่เทียบโอนได้ ({totalTransferred} วิชา)
            </h3>
            {transferredCourses.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-500 bg-slate-50 rounded-lg">
                ⚠️ ยังไม่มีวิชาที่ติ๊ก "เลือก" — ไม่สามารถอนุมัติได้
              </div>
            ) : (
              <div className="space-y-3">
                {transferredCourses.map(({ course, selections: sels }) => {
                  const selectedSels = sels.filter(s => s.selected);
                  return (
                    <div key={course._id} className="border border-emerald-200 bg-emerald-50/30 rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <span className="text-emerald-600 text-xl">✓</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-slate-600 font-semibold">{course.code}</span>
                            <span className="font-medium text-sm">{course.nameTh}</span>
                            <span className="badge badge-success text-xs">{course.creditHours || '-'} หน่วยกิต</span>
                          </div>
                          <div className="mt-2 space-y-2">
                            {/* dedupe by groupNo */}
                            {[...new Set(selectedSels.map(s => s.groupNo))].map(groupNo => {
                              const group = groups.find(g => String(g.uniCourseId) === course._id && g.groupNo === groupNo);
                              if (!group) return null;
                              const groupSels = selectedSels.filter(s => s.groupNo === groupNo);
                              const tickedCodes = new Set(groupSels.map(s => s.externalCourseCode).filter(Boolean));
                              const extToShow = tickedCodes.size > 0
                                ? group.externalCourses.filter(ex => tickedCodes.has(ex.code))
                                : group.externalCourses;
                              const grade = groupSels.find(s => s.grade)?.grade;
                              const outsideCE = groupSels.some(s => s.outsideCE);
                              return (
                                <div key={groupNo} className="bg-white border border-emerald-200 rounded p-2">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="badge badge-brand text-xs">กลุ่ม {groupNo}</span>
                                    {grade && <span className="text-xs text-slate-600">เกรด: <b>{grade}</b></span>}
                                    {outsideCE && <span className="badge text-xs">นอกระบบ CE</span>}
                                  </div>
                                  <div className="space-y-1">
                                    {extToShow.map((ex, i) => (
                                      <div key={i} className="flex items-baseline gap-2 text-xs">
                                        <span className="font-mono text-slate-500 w-24 shrink-0">{ex.code}</span>
                                        <span className="flex-1 text-slate-700">{ex.nameTh}</span>
                                        <span className="text-slate-500">{ex.credits} หน่วยกิต</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Rejected courses (มีข้อมูลแต่ไม่ติ๊ก "เลือก") */}
          {rejectedCourses.length > 0 && (
            <section>
              <h3 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2">
                <span>❌</span> รายวิชาที่ไม่ผ่านการเทียบโอน ({rejectedCourses.length} วิชา)
              </h3>
              <p className="text-xs text-slate-600 mb-3">
                วิชาเหล่านี้มีการกรอกข้อมูล (เกรด/นอกระบบ CE) แต่ไม่ได้ติ๊ก "เลือก" = ไม่ผ่านการเทียบโอน
              </p>
              <div className="space-y-3">
                {rejectedCourses.map(({ course, selections: sels }) => (
                  <div key={course._id} className="border border-red-200 bg-red-50/30 rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <span className="text-red-600 text-xl">✗</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-600 font-semibold">{course.code}</span>
                          <span className="font-medium text-sm">{course.nameTh}</span>
                          <span className="badge text-xs">{course.creditHours || '-'} หน่วยกิต</span>
                        </div>
                        <div className="mt-2 space-y-2">
                          {[...new Set(sels.map(s => s.groupNo))].map(groupNo => {
                            const group = groups.find(g => String(g.uniCourseId) === course._id && g.groupNo === groupNo);
                            if (!group) return null;
                            const groupSels = sels.filter(s => s.groupNo === groupNo);
                            const tickedCodes = new Set(groupSels.map(s => s.externalCourseCode).filter(Boolean));
                            const extToShow = tickedCodes.size > 0
                              ? group.externalCourses.filter(ex => tickedCodes.has(ex.code))
                              : group.externalCourses;
                            const grade = groupSels.find(s => s.grade)?.grade;
                            const outsideCE = groupSels.some(s => s.outsideCE);
                            return (
                              <div key={groupNo} className="bg-white border border-red-200 rounded p-2">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="badge text-xs">กลุ่ม {groupNo}</span>
                                  {grade && <span className="text-xs text-slate-600">เกรด: <b>{grade}</b></span>}
                                  {outsideCE && <span className="badge text-xs">นอกระบบ CE</span>}
                                  <span className="text-xs text-red-600 font-medium">● ไม่ได้ติ๊ก "เลือก"</span>
                                </div>
                                <div className="space-y-1">
                                  {extToShow.map((ex, i) => (
                                    <div key={i} className="flex items-baseline gap-2 text-xs">
                                      <span className="font-mono text-slate-500 w-24 shrink-0">{ex.code}</span>
                                      <span className="flex-1 text-slate-700">{ex.nameTh}</span>
                                      <span className="text-slate-500">{ex.credits} หน่วยกิต</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Not transferred courses (ยังไม่มีข้อมูลอะไรเลย) */}
          {selectedCourses.filter(sc => !sc.selections.some(s => s.selected) && !sc.selections.some(s => s.grade || s.outsideCE)).length > 0 && (
            <section>
              <h3 className="font-semibold text-sm text-slate-700 mb-3 flex items-center gap-2">
                <span>⏸</span> รายวิชาที่เลือกกลุ่มเทียบไว้แต่ยังไม่มีข้อมูล ({selectedCourses.filter(sc => !sc.selections.some(s => s.selected) && !sc.selections.some(s => s.grade || s.outsideCE)).length} วิชา)
              </h3>
              <div className="space-y-2">
                {selectedCourses
                  .filter(sc => !sc.selections.some(s => s.selected) && !sc.selections.some(s => s.grade || s.outsideCE))
                  .map(({ course, selections: sels }) => (
                    <div key={course._id} className="border border-slate-200 bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-600">{course.code}</span>
                        <span className="text-sm text-slate-700">{course.nameTh}</span>
                        <span className="badge text-xs">{sels.length} กลุ่ม</span>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex gap-3">
              <span className="text-amber-600 text-xl">⚠️</span>
              <div className="flex-1 text-sm">
                <div className="font-medium text-amber-900 mb-1">โปรดตรวจสอบให้แน่ใจก่อนอนุมัติ</div>
                <ul className="text-amber-800 space-y-1 text-xs">
                  <li>• ตรวจสอบว่ากลุ่มเทียบที่เลือกถูกต้องครบถ้วน</li>
                  <li>• เกรดและข้อมูลเพิ่มเติมครบถ้วน</li>
                  <li>• หลังอนุมัติแล้วสามารถกลับมาแก้ไขได้โดยกด "ส่งกลับร่าง"</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-line bg-slate-50 px-6 py-4 flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600">
            เทียบโอนได้ <b className="text-emerald-600 text-lg">{totalTransferred}</b> วิชา
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="btn btn-ghost">
              ยกเลิก
            </button>
            <button onClick={onConfirm} disabled={totalTransferred === 0}
              className="btn btn-success disabled:opacity-50 disabled:cursor-not-allowed">
              ✓ ยืนยันอนุมัติ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
