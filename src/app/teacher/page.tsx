'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useActiveYear } from '@/lib/useActiveYear';
import { useRouter } from 'next/navigation';
import YearPickerModal from '@/components/YearPickerModal';

type Stat = { faculties: number; programs: number; years: number; students: number; sheets: number; finalized: number; pending: number };
type Sheet = {
  _id: string; status: string; updatedAt: string;
  studentId: { studentId: string; fullName: string; programId: { nameTh: string }; yearId: { year: number } };
};

const QUICK_LINKS = [
  { href: '/teacher/years', icon: '📅', label: 'ปีการศึกษา', desc: 'เปิดปี/จัดการสาขา' },
  { href: '/teacher/uni-courses', icon: '📚', label: 'รายวิชามหาลัย', desc: 'วิชาในหลักสูตร' },
  { href: '/teacher/transfer-groups', icon: '📦', label: 'กลุ่มเทียบ', desc: 'จับคู่วิชานอก ↔ วิชาเรา' },
  { href: '/teacher/students', icon: '👥', label: 'นักศึกษา', desc: 'อัปโหลด CSV / รายชื่อ' },
  { href: '/teacher/sheets', icon: '📑', label: 'ใบเทียบโอน', desc: 'ดู/แก้/ออก PDF' },
];

function StatCard({ icon, label, value, color, href }: { icon: string; label: string; value: number | string; color: string; href?: string }) {
  const Wrap: any = href ? Link : 'div';
  return (
    <Wrap href={href} className={`surface p-5 sm:p-6 card-hover relative overflow-hidden ${href ? 'cursor-pointer' : ''}`}>
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -mr-8 -mt-8 ${color}`} />
      <div className="relative">
        <div className="text-2xl mb-2">{icon}</div>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
        <div className="text-3xl font-semibold text-ink mt-1">{value}</div>
      </div>
    </Wrap>
  );
}

export default function TeacherDashboard() {
  const { data } = useSession();
  const name = data?.user?.name;
  const role = (data?.user as any)?.role;
  const router = useRouter();
  const { loadingYears, yearOptions, selectedYear, selectedYearExists, canClosePicker, setYear, pickerOpen, openPicker, closePicker } = useActiveYear({ resolveFromYearId: false });
  const [allSheets, setAllSheets] = useState<Sheet[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [allYears, setAllYears] = useState<any[]>([]);
  const [allPrograms, setAllPrograms] = useState<any[]>([]);
  const [allFaculties, setAllFaculties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try {
      const [fs, ps, ys, ss, sh] = await Promise.all([
        fetch('/api/faculties').then(r => r.json()),
        fetch('/api/programs').then(r => r.json()),
        fetch('/api/years').then(r => r.json()),
        fetch('/api/students').then(r => r.json()).catch(() => []),
        fetch('/api/sheets').then(r => r.json()),
      ]);
      setAllFaculties(Array.isArray(fs) ? fs : []);
      setAllPrograms(Array.isArray(ps) ? ps : []);
      setAllYears(Array.isArray(ys) ? ys : []);
      setAllStudents(Array.isArray(ss) ? ss : []);
      setAllSheets(Array.isArray(sh) ? sh : []);
    } finally { setLoading(false); }
  })(); }, []);

  // Filter by selected year
  const yearSheets = selectedYear
    ? allSheets.filter(s => (s.studentId as any)?.yearId?.year === selectedYear)
    : allSheets;
  const yearStudents = selectedYear
    ? allStudents.filter((s: any) => s.yearId?.year === selectedYear)
    : allStudents;
  const yearCount = selectedYear
    ? allYears.filter((y: any) => y.year === selectedYear).length
    : allYears.length;

  const stat = {
    faculties: allFaculties.length,
    programs: allPrograms.length,
    years: yearCount,
    students: yearStudents.length,
    sheets: yearSheets.length,
    finalized: yearSheets.filter(x => x.status === 'finalized').length,
    pending: yearSheets.filter(x => x.status === 'pending_review').length,
  };

  const recent = [...yearSheets].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);

  return (
    <div className="space-y-8 sm:space-y-10 pb-12">
      {/* Welcome hero */}
      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="page-eyebrow">{role === 'committee' ? 'กรรมการ' : 'อาจารย์'}</div>
            <h1 className="text-2xl sm:text-3xl font-semibold mt-2 text-ink">
              สวัสดีครับ <span className="text-brand-700">{name}</span>
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-xl">
              {selectedYear ? `ข้อมูลปีการศึกษา ${selectedYear}` : 'ภาพรวมของระบบใบเทียบโอนรายวิชา'}
            </p>
          </div>
          <button onClick={openPicker} className="btn">📅 {selectedYear ? `ปีการศึกษา ${selectedYear}` : 'เลือกปี'}</button>
        </div>
      </section>

      {/* Stats grid */}
      <section>
        <h2 className="section-title mb-4">📊 สถิติระบบ</h2>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {[1,2,3,4].map(i => <div key={i} className="surface p-6"><div className="skeleton h-4 w-16 mb-3" /><div className="skeleton h-8 w-12" /></div>)}
          </div>
        ) : role === 'committee' ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            <StatCard icon="⏳" label="รอพิจารณา" value={stat?.pending || 0} color="bg-amber-500" href="/teacher/sheets" />
            <StatCard icon="✅" label="อนุมัติแล้ว" value={stat?.finalized || 0} color="bg-emerald-500" href="/teacher/sheets" />
            <StatCard icon="📑" label="ทั้งหมด" value={stat?.sheets || 0} color="bg-brand-500" href="/teacher/sheets" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatCard icon="📅" label="ปีการศึกษา" value={stat?.years || 0} color="bg-brand-500" href="/teacher/years" />
            <StatCard icon="🎓" label="สาขา" value={stat?.programs || 0} color="bg-emerald-500" href="/teacher/years" />
            <StatCard icon="👥" label="นักศึกษา" value={stat?.students || 0} color="bg-amber-500" href="/teacher/students" />
            <StatCard icon="📑" label="ใบเทียบโอน" value={`${stat?.finalized || 0}/${stat?.sheets || 0}`} color="bg-violet-500" href="/teacher/sheets" />
          </div>
        )}
      </section>

      {/* Quick actions — teacher only */}
      {role !== 'committee' && (
      <section>
        <h2 className="section-title mb-4">🚀 ทางลัดเมนูหลัก</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {QUICK_LINKS.map((q, i) => (
            <Link key={q.href} href={q.href}
              className="surface p-5 sm:p-6 card-hover flex items-center gap-4 group">
              <div className="w-12 h-12 rounded-xl bg-brand-50 grid place-items-center text-2xl group-hover:bg-brand-100 transition">
                {q.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink">{q.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{q.desc}</div>
              </div>
              <div className="text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition">→</div>
            </Link>
          ))}
        </div>
      </section>
      )}

      {/* Recent sheets */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">🕐 ใบเทียบโอนล่าสุด</h2>
          <Link href="/teacher/sheets" className="text-sm text-brand-600 hover:text-brand-700 font-medium">ดูทั้งหมด →</Link>
        </div>
        {loading ? (
          <div className="surface p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-6 w-full" />)}
          </div>
        ) : recent.length === 0 ? (
          <div className="surface p-10 text-center">
            <div className="text-5xl mb-3 opacity-50">📭</div>
            <p className="font-medium">ยังไม่มีใบเทียบโอน</p>
            <p className="text-sm text-slate-500 mt-1">ใบจะปรากฏที่นี่เมื่อนักศึกษาเริ่มกรอก</p>
          </div>
        ) : (
          <div className="surface overflow-hidden">
            <div className="divide-y divide-line">
              {recent.map(s => (
                <Link key={s._id} href={`/teacher/sheets/${(s.studentId as any)?._id}`}
                  className="flex items-center gap-4 px-5 py-3.5 hover:bg-soft transition">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center font-semibold text-sm shrink-0">
                    {s.studentId?.fullName?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{s.studentId?.fullName}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {s.studentId?.studentId} · {s.studentId?.programId?.nameTh} · ปี {s.studentId?.yearId?.year}
                    </div>
                  </div>
                  <span className={`badge ${s.status === 'finalized' ? 'badge-success' : s.status === 'pending_review' ? 'badge-warning' : 'badge-brand'} shrink-0`}>
                    {s.status === 'finalized' ? '✓ อนุมัติแล้ว' : s.status === 'pending_review' ? '⏳ รอพิจารณา' : '● ฉบับร่าง'}
                  </span>
                  <span className="text-xs text-slate-400 hidden sm:inline shrink-0">
                    {new Date(s.updatedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <YearPickerModal
        open={pickerOpen} loading={loadingYears} years={yearOptions}
        selectedYear={selectedYear ?? undefined} canClose={canClosePicker}
        onSelect={setYear}
        onClose={() => { closePicker(); if (!canClosePicker) router.push('/teacher'); }}
      />
    </div>
  );
}
