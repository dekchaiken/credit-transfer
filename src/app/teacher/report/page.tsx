'use client';
import { useEffect, useState, Suspense } from 'react';
import { useActiveYear } from '@/lib/useActiveYear';
import YearPickerModal from '@/components/YearPickerModal';
import { useRouter } from 'next/navigation';

type StudentEntry = { studentId: string; fullName: string; grade: string; passed: boolean };
type CourseRow = { code: string; nameTh: string; passed: number; failed: number; students: StudentEntry[] };
type StudentRow = { _id: string; studentId: string; fullName: string; program: string; faculty: string; passed: number; failed: number; total: number };

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="surface surface-pad flex flex-col gap-1">
      <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function MiniBar({ passed, total }: { passed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((passed / total) * 100);
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

function CourseModal({ course, onClose }: { course: CourseRow; onClose: () => void }) {
  const passed = course.students.filter(s => s.passed);
  const failed = course.students.filter(s => !s.passed);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 animate-fadeIn" />
      <div className="relative bg-white rounded-2xl shadow-lift w-full max-w-lg animate-slideDown" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-line">
          <div className="font-mono text-xs text-slate-400">{course.code}</div>
          <div className="font-semibold text-ink mt-0.5">{course.nameTh}</div>
          <div className="flex gap-3 mt-2 text-sm">
            <span className="text-emerald-600 font-medium">ผ่าน {course.passed} คน</span>
            <span className="text-slate-300">·</span>
            <span className="text-red-500 font-medium">ไม่ผ่าน {course.failed} คน</span>
          </div>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {passed.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">✓ ผ่าน ({passed.length} คน)</div>
              <div className="space-y-1">
                {passed.map((s, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 text-sm">
                    <span>{s.fullName} <span className="text-xs text-slate-400 font-mono">({s.studentId})</span></span>
                    <span className="badge badge-success">{s.grade}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {failed.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">✗ ไม่ผ่าน ({failed.length} คน)</div>
              <div className="space-y-1">
                {failed.map((s, i) => (
                  <div key={i} className="flex items-center px-3 py-2 rounded-lg bg-red-50 text-sm text-slate-700">
                    {s.fullName} <span className="text-xs text-slate-400 font-mono ml-1">({s.studentId})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-line text-right">
          <button onClick={onClose} className="btn">ปิด</button>
        </div>
      </div>
    </div>
  );
}

function RateBadge({ pct }: { pct: number }) {
  const cls = pct >= 70 ? 'bg-emerald-100 text-emerald-700' : pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{pct}%</span>;
}

function CourseTabContent({ byCourse, onSelect }: { byCourse: CourseRow[]; onSelect: (c: CourseRow) => void }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'alpha' | 'rate_asc' | 'rate_desc'>('alpha');
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'zero'>('all');

  const avgRate = byCourse.length === 0 ? 0 : Math.round(byCourse.reduce((s, c) => {
    const t = c.passed + c.failed; return s + (t === 0 ? 0 : c.passed / t);
  }, 0) / byCourse.length * 100);
  const zeroCourses = byCourse.filter(c => c.passed === 0 && (c.passed + c.failed) > 0).length;
  const fullPass = byCourse.filter(c => c.failed === 0 && c.passed > 0).length;

  const sorted = [...byCourse]
    .filter(c => {
      const t = c.passed + c.failed;
      if (filterStatus === 'passed' && c.passed === 0) return false;
      if (filterStatus === 'zero' && (c.passed > 0 || t === 0)) return false;
      if (q && !c.code.toLowerCase().includes(q.toLowerCase()) && !c.nameTh.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'alpha') return a.code.localeCompare(b.code);
      const ra = a.passed + a.failed === 0 ? 0 : a.passed / (a.passed + a.failed);
      const rb = b.passed + b.failed === 0 ? 0 : b.passed / (b.passed + b.failed);
      return sort === 'rate_asc' ? ra - rb : rb - ra;
    });

  return (
    <div className="space-y-4">
      {/* Mini summary */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xl font-bold text-brand-600">{avgRate}%</div>
          <div className="text-xs text-slate-500 mt-0.5">อัตราผ่านเฉลี่ย</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3">
          <div className="text-xl font-bold text-emerald-600">{fullPass}</div>
          <div className="text-xs text-slate-500 mt-0.5">วิชาผ่าน 100%</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <div className="text-xl font-bold text-red-500">{zeroCourses}</div>
          <div className="text-xs text-slate-500 mt-0.5">วิชาไม่มีผ่านเลย</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap items-center">
        <input className="input flex-1 min-w-[180px]" placeholder="🔍 ค้นหารหัส / ชื่อวิชา..."
          value={q} onChange={e => setQ(e.target.value)} />
        <select className="input w-40" value={sort} onChange={e => setSort(e.target.value as any)}>
          <option value="alpha">เรียง: รหัส A-Z</option>
          <option value="rate_desc">อัตราผ่าน ↓ สูง</option>
          <option value="rate_asc">อัตราผ่าน ↑ ต่ำ</option>
        </select>
        <select className="input w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
          <option value="all">ทั้งหมด</option>
          <option value="passed">มีผ่านบ้าง</option>
          <option value="zero">ไม่มีผ่านเลย</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[55vh] rounded-lg border border-line">
        <table className="table">
          <thead className="sticky top-0 bg-white z-10">
            <tr>
              <th>รหัสวิชา</th>
              <th>ชื่อวิชา</th>
              <th className="text-center w-16">ผ่าน</th>
              <th className="text-center w-16">ไม่ผ่าน</th>
              <th className="text-center w-16">รวม</th>
              <th className="w-28">อัตราผ่าน</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-8">ไม่พบรายวิชาที่ตรงกับเงื่อนไข</td></tr>
            ) : sorted.map(c => {
              const total = c.passed + c.failed;
              const pct = total === 0 ? 0 : Math.round(c.passed / total * 100);
              return (
                <tr key={c.code} className="hover:bg-soft cursor-pointer" onClick={() => onSelect(c)}>
                  <td className="font-mono text-xs text-slate-500">{c.code}</td>
                  <td className="font-medium text-brand-700 hover:underline max-w-xs truncate">{c.nameTh}</td>
                  <td className="text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-sm">{c.passed}</span>
                  </td>
                  <td className="text-center">
                    {c.failed > 0
                      ? <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-600 font-semibold text-sm">{c.failed}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="text-center text-slate-500 text-sm">{total}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <MiniBar passed={c.passed} total={total} />
                      <RateBadge pct={pct} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-400 text-right">{sorted.length}/{byCourse.length} วิชา · คลิกเพื่อดูรายชื่อ</div>
    </div>
  );
}


  const router = useRouter();
  const { loadingYears, yearOptions, selectedYear, selectedYearExists, canClosePicker, setYear, pickerOpen, openPicker, closePicker } = useActiveYear({ resolveFromYearId: false });
  const [tab, setTab] = useState<'course' | 'student'>('course');
  const [byCourse, setByCourse] = useState<CourseRow[]>([]);
  const [byStudent, setByStudent] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseRow | null>(null);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterProgram, setFilterProgram] = useState('');
  const [filterResult, setFilterResult] = useState<'all' | 'passed' | 'failed'>('all');
  const [searchQ, setSearchQ] = useState('');

  useEffect(() => {
    if (!selectedYear) return;
    setLoading(true);
    fetch(`/api/report?year=${selectedYear}`)
      .then(r => r.json())
      .then(d => { setByCourse(d.byCourse || []); setByStudent(d.byStudent || []); })
      .finally(() => setLoading(false));
  }, [selectedYear]);

  const ready = !loading && !loadingYears && selectedYear != null && selectedYearExists;
  const totalPassed = byStudent.reduce((s, r) => s + r.passed, 0);
  const totalFailed = byStudent.reduce((s, r) => s + r.failed, 0);
  const passedStudents = byStudent.filter(s => s.passed > 0).length;

  const faculties = [...new Set(byStudent.map(s => s.faculty).filter(Boolean))].sort();
  const programs = [...new Set(byStudent.filter(s => !filterFaculty || s.faculty === filterFaculty).map(s => s.program).filter(Boolean))].sort();
  const filteredStudents = byStudent.filter(s => {
    if (filterFaculty && s.faculty !== filterFaculty) return false;
    if (filterProgram && s.program !== filterProgram) return false;
    if (filterResult === 'passed' && s.passed === 0) return false;
    if (filterResult === 'failed' && s.failed === 0) return false;
    if (searchQ && !s.studentId?.includes(searchQ) && !s.fullName?.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="page-eyebrow">📊 รายงาน</div>
            <h1 className="page-title">สรุปผลการเทียบโอน{selectedYear ? ` ปี ${selectedYear}` : ''}</h1>
            <p className="text-sm text-slate-500 mt-1">เฉพาะใบเทียบที่อนุมัติแล้ว</p>
          </div>
          {selectedYear && selectedYearExists && (
            <button onClick={openPicker} className="btn">🔄 เปลี่ยนปี</button>
          )}
        </div>
      </section>

      {ready && byStudent.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-slideDown">
          <StatCard label="นักศึกษาทั้งหมด" value={byStudent.length} sub="ที่มีใบเทียบอนุมัติ" color="text-brand-600" />
          <StatCard label="มีวิชาผ่าน" value={passedStudents} sub={`จาก ${byStudent.length} คน`} color="text-emerald-600" />
          <StatCard label="วิชาผ่านรวม" value={totalPassed} sub="ทุกนักศึกษา" color="text-emerald-600" />
          <StatCard label="วิชาไม่ผ่านรวม" value={totalFailed} sub="ทุกนักศึกษา" color="text-red-500" />
        </div>
      )}

      {ready && (
        <div className="space-y-4 animate-slideUp">
          <div className="flex gap-1 bg-soft rounded-xl p-1 w-fit border border-line">
            {(['course', 'student'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-2 text-sm rounded-lg transition font-medium ${tab === t ? 'bg-white shadow-soft text-brand-700' : 'text-slate-500 hover:text-ink'}`}>
                {t === 'course' ? '📚 รายวิชา' : '👤 รายชื่อ'}
              </button>
            ))}
          </div>

          {tab === 'course' && (
            <section className="surface surface-pad">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="section-title">สรุปผลรายวิชา</h2>
                <span className="badge badge-brand">{byCourse.length} วิชา</span>
              </div>
              {byCourse.length === 0 ? (
                <div className="text-center py-12"><div className="text-4xl mb-2">📭</div><p className="text-sm text-slate-500">ยังไม่มีข้อมูล — ต้องมีใบเทียบที่อนุมัติแล้ว</p></div>
              ) : (
                <CourseTabContent byCourse={byCourse} onSelect={setSelectedCourse} />
              )}
            </section>
          )}

          {tab === 'student' && (
            <section className="surface surface-pad">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-title">สรุปผลรายชื่อ</h2>
                <span className="badge badge-brand">{filteredStudents.length}/{byStudent.length} คน</span>
              </div>
              {byStudent.length === 0 ? (
                <div className="text-center py-12"><div className="text-4xl mb-2">📭</div><p className="text-sm text-slate-500">ยังไม่มีข้อมูล — ต้องมีใบเทียบที่อนุมัติแล้ว</p></div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div>
                      <label className="label">คณะ</label>
                      <select className="input" value={filterFaculty} onChange={e => { setFilterFaculty(e.target.value); setFilterProgram(''); }}>
                        <option value="">— ทุกคณะ —</option>
                        {faculties.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">สาขา</label>
                      <select className="input" value={filterProgram} onChange={e => setFilterProgram(e.target.value)}>
                        <option value="">— ทุกสาขา —</option>
                        {programs.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">ผลการเทียบโอน</label>
                      <select className="input" value={filterResult} onChange={e => setFilterResult(e.target.value as any)}>
                        <option value="all">— ทั้งหมด —</option>
                        <option value="passed">มีวิชาผ่าน</option>
                        <option value="failed">มีวิชาไม่ผ่าน</option>
                      </select>
                    </div>
                  </div>
                  <div className="relative mb-4">
                    <input className="input pl-9" placeholder="🔍 ค้นหารหัส นศ. หรือชื่อ..."
                      value={searchQ} onChange={e => setSearchQ(e.target.value)} />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
                  </div>
                  <div className="overflow-auto max-h-[45vh]">
                    <table className="table">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr><th>รหัส นศ.</th><th>ชื่อ</th><th>สาขา</th><th className="text-center">ผ่าน</th><th className="text-center">ไม่ผ่าน</th><th>ความคืบหน้า</th></tr>
                      </thead>
                      <tbody>
                        {filteredStudents.map(s => (
                          <tr key={s._id} className="hover:bg-soft cursor-pointer" onClick={() => setPreviewStudentId(s._id)}>
                            <td className="font-mono text-xs text-slate-500">{s.studentId}</td>
                            <td className="font-medium text-brand-700">{s.fullName}</td>
                            <td className="text-xs text-slate-500 max-w-[160px] truncate">{s.program}</td>
                            <td className="text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-sm">{s.passed}</span></td>
                            <td className="text-center">{s.failed > 0 ? <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-50 text-red-600 font-semibold text-sm">{s.failed}</span> : <span className="text-slate-300">—</span>}</td>
                            <td><MiniBar passed={s.passed} total={s.total} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      )}

      {(loading || loadingYears) && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="surface p-5 animate-pulseSoft"><div className="skeleton h-8 w-16 mb-1" /><div className="skeleton h-3 w-24" /></div>)}
          </div>
          <div className="surface p-5 animate-pulseSoft space-y-2">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-4 w-full" />)}
          </div>
        </div>
      )}

      {selectedCourse && <CourseModal course={selectedCourse} onClose={() => setSelectedCourse(null)} />}

      {/* PDF Preview Modal */}
      {previewStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreviewStudentId(null)}>
          <div className="absolute inset-0 bg-black/60 animate-fadeIn" />
          <div className="relative bg-white rounded-2xl shadow-lift w-full max-w-5xl h-[90vh] flex flex-col animate-slideDown" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-line flex items-center justify-between">
              <h3 className="font-semibold text-ink">ตัวอย่างใบเทียบโอน</h3>
              <div className="flex gap-2">
                <a
                  href={`/api/sheets/${previewStudentId}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-primary"
                >
                  📄 เปิดในแท็บใหม่
                </a>
                <button onClick={() => setPreviewStudentId(null)} className="btn btn-sm">✕ ปิด</button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={`/api/sheets/${previewStudentId}/pdf`}
                className="w-full h-full border-0"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      <YearPickerModal
        open={pickerOpen} loading={loadingYears} years={yearOptions}
        selectedYear={selectedYear ?? undefined} canClose={canClosePicker}
        onSelect={setYear}
        onClose={() => { closePicker(); if (!canClosePicker) router.push('/teacher'); }}
      />
    </div>
  );
}

export default function Page() {
  return <Suspense><ReportInner /></Suspense>;
}
