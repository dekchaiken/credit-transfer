'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

type Stat = { faculties: number; programs: number; users: number; teachers: number; students: number; admins: number };

const ADMIN_LINKS = [
  { href: '/admin/users', icon: '👤', label: 'จัดการผู้ใช้', desc: 'เพิ่ม/ลบ/รีเซ็ตรหัส อาจารย์-กรรมการ-นักศึกษา' },
  { href: '/admin/faculties', icon: '🏛️', label: 'คณะ', desc: 'จัดการรายชื่อคณะของมหาวิทยาลัย' },
  { href: '/admin/programs', icon: '🎓', label: 'สาขาวิชา', desc: 'จัดการสาขา ผูกกับคณะ' },
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

export default function AdminDashboard() {
  const { data } = useSession();
  const name = data?.user?.name;
  const [stat, setStat] = useState<Stat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    try {
      const [fs, ps, us] = await Promise.all([
        fetch('/api/faculties').then(r => r.json()).catch(() => []),
        fetch('/api/programs').then(r => r.json()).catch(() => []),
        fetch('/api/users').then(r => r.json()).catch(() => []),
      ]);
      const users = Array.isArray(us) ? us : [];
      setStat({
        faculties: Array.isArray(fs) ? fs.length : 0,
        programs: Array.isArray(ps) ? ps.length : 0,
        users: users.length,
        teachers: users.filter((u: any) => u.role === 'teacher' || u.role === 'committee').length,
        students: users.filter((u: any) => u.role === 'student').length,
        admins: users.filter((u: any) => u.role === 'admin').length,
      });
    } finally { setLoading(false); }
  })(); }, []);

  return (
    <div className="space-y-8 sm:space-y-10 pb-12">
      {/* Welcome hero */}
      <section className="page-hero surface-pad-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="page-eyebrow">ผู้ดูแลระบบ</div>
            <h1 className="text-2xl sm:text-3xl font-semibold mt-2 text-ink">
              สวัสดีครับ <span className="text-brand-700">{name}</span>
            </h1>
            <p className="text-sm text-slate-600 mt-2 max-w-xl">
              จัดการโครงสร้างพื้นฐานของระบบ: คณะ สาขาวิชา และบัญชีผู้ใช้ทุกระดับ
            </p>
          </div>
          <div className="hidden sm:block text-6xl opacity-20">⚙️</div>
        </div>
      </section>

      {/* Stats */}
      <section>
        <h2 className="section-title mb-4">📊 สถิติระบบ</h2>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {[1,2,3,4].map(i => <div key={i} className="surface p-6"><div className="skeleton h-4 w-16 mb-3" /><div className="skeleton h-8 w-12" /></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <StatCard icon="🏛️" label="คณะ" value={stat?.faculties || 0} color="bg-brand-500" href="/admin/faculties" />
            <StatCard icon="🎓" label="สาขาวิชา" value={stat?.programs || 0} color="bg-emerald-500" href="/admin/programs" />
            <StatCard icon="👨‍🏫" label="อาจารย์/กรรมการ" value={stat?.teachers || 0} color="bg-amber-500" href="/admin/users" />
            <StatCard icon="👨‍🎓" label="นักศึกษา" value={stat?.students || 0} color="bg-violet-500" href="/admin/users" />
          </div>
        )}
      </section>

      {/* Quick links */}
      <section>
        <h2 className="section-title mb-4">⚡ จัดการระบบ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {ADMIN_LINKS.map(q => (
            <Link key={q.href} href={q.href}
              className="surface p-5 sm:p-6 card-hover flex items-start gap-4 group">
              <div className="w-12 h-12 rounded-xl bg-brand-50 grid place-items-center text-2xl group-hover:bg-brand-100 transition shrink-0">
                {q.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink flex items-center gap-2">
                  {q.label}
                  <span className="text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition">→</span>
                </div>
                <div className="text-xs text-slate-500 mt-1 leading-relaxed">{q.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* System info */}
      <section className="surface surface-pad bg-gradient-to-br from-soft to-white">
        <h2 className="section-title mb-3">ℹ️ ข้อมูลระบบ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs text-slate-500">ระบบ</div>
            <div className="font-medium mt-0.5">ใบเทียบโอนรายวิชา</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">หน่วยงาน</div>
            <div className="font-medium mt-0.5">มทร.กรุงเทพ</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">แบบฟอร์ม</div>
            <div className="font-medium mt-0.5">สวท. 12-05</div>
          </div>
        </div>
      </section>
    </div>
  );
}
